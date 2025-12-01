#!/usr/bin/env python3
"""
Enhanced Hybrid Pipeline V3.1 for MVP Integration
Combines OCR brand detection + Visual image search + Priority Text Search + GPT selection

Adapted from standalone version to work with FastAPI and Modal deployment.
"""

import os
import json
import requests
import base64
import time
from typing import List, Dict, Optional
from openai import OpenAI
from bs4 import BeautifulSoup
from urllib.parse import urljoin

class EnhancedHybridPipelineV2:
    """
    Production-ready pipeline with visual image search + GPT selection.
    Accuracy-first, image-matching-first, product-pages-only.
    """
    
    def __init__(self, progress_callback=None):
        """Initialize with API keys from environment variables
        
        Args:
            progress_callback: Optional function(progress, message) to report progress (0-100)
        """
        # Load API keys from environment
        self.GCLOUD_API_KEY = os.environ.get('GCLOUD_API_KEY')
        self.serper_api_key = os.environ.get('SERPER_API_KEY')
        self.openai_api_key = os.environ.get('OPENAI_API_KEY')
        self.supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
        self.supabase_key = os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_KEY')
        self.progress_callback = progress_callback
        
        if not self.GCLOUD_API_KEY:
            raise ValueError("GCLOUD_API_KEY environment variable not set")
        if not self.serper_api_key:
            raise ValueError("SERPER_API_KEY environment variable not set")
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase credentials not set")
        
        self.openai_client = OpenAI(api_key=self.openai_api_key)
        
        # Initialize Supabase client
        from supabase import create_client
        self.supabase = create_client(self.supabase_url, self.supabase_key)
        
        # Korean e-commerce platforms (priority order)
        self.korean_platforms = [
            'musinsa.com',
            '29cm.co.kr',
            'zigzag.kr',
            'ably.com',
            'coupang.com',
            'shopping.naver.com',
            'wconcept.co.kr',
            'kream.co.kr',
            'balaan.co.kr'
        ]
        
        # Blocked domains (social media, non-product sites)
        self.blocked_domains = [
            # Social media
            'instagram.com', 'www.instagram.com', 'ig.me', 'instagr.am',
            'tiktok.com', 'www.tiktok.com', 'vt.tiktok.com',
            'youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com',
            'pinterest.com', 'www.pinterest.com', 'pin.it',
            'facebook.com', 'www.facebook.com', 'fb.com', 'fb.me',
            'twitter.com', 'x.com', 'www.twitter.com', 't.co',
            'reddit.com', 'www.reddit.com',
            'tumblr.com', 'weibo.com',
            # Image search engines
            'images.google.com', 'google.com/images',
            # Korean forums/blogs
            'blog.naver.com', 'tistory.com', 'theqoo.net',
            'pann.nate.com', 'dcinside.com'
        ]
        
        # Platform brands to skip (not actual products)
        self.platform_brands = [
            'KREAM', 'ABLY', 'TEMU', 'NAVER', 'Instagram', 'Temu',
            'ABLY', 'Coupang', 'Gmarket', 'Musinsa'
        ]
        
        print("✅ Enhanced Hybrid Pipeline V3.1 initialized!")
        print("   Features: OCR + Visual /lens + Priority Text Search + GPT Selection")
        print("   Priority: Platforms (Musinsa/29cm) → Brand Site → General\n")
    
    def extract_text_from_url(self, image_url: str) -> Dict:
        """Step 1: Extract text from image URL with Google Cloud Vision OCR"""
        try:
            # Download image (longer timeout for large images)
            response = requests.get(image_url, timeout=60)
            response.raise_for_status()
            image_content = base64.b64encode(response.content).decode('utf-8')
            
            url = f"https://vision.googleapis.com/v1/images:annotate?key={self.GCLOUD_API_KEY}"
            
            request_body = {
                "requests": [{
                    "image": {"content": image_content},
                    "features": [{"type": "TEXT_DETECTION", "maxResults": 100}]
                }]
            }
            
            ocr_response = requests.post(url, json=request_body, timeout=120)
            ocr_response.raise_for_status()
            result = ocr_response.json()
            
            if 'responses' not in result or len(result['responses']) == 0:
                return {'full_text': '', 'segments': []}
            
            text_annotations = result['responses'][0].get('textAnnotations', [])
            
            if not text_annotations:
                return {'full_text': '', 'segments': []}
            
            full_text = text_annotations[0].get('description', '')
            segments = [ann.get('description', '') for ann in text_annotations[1:]]
            
            return {
                'full_text': full_text,
                'segments': segments
            }
            
        except Exception as e:
            print(f"   ❌ OCR error: {e}")
            return {'full_text': '', 'segments': []}
    
    def map_brands_to_products(self, ocr_result: Dict) -> Dict:
        """Step 2: Intelligent brand-product mapping with GPT-4o"""
        full_text = ocr_result.get('full_text', '')
        
        if not full_text:
            return {'products': [], 'websites': [], 'image_has_multiple_products': False}
        
        prompt = f"""You are analyzing OCR text extracted from a product image.

TASK: Identify ALL brands and their products visible in this image.

OCR TEXT:
{full_text}

INSTRUCTIONS:
1. Find ALL brand names (clothing brands, not platform names like Instagram/Musinsa/Coupang)
2. For EACH brand, identify the specific product being shown
3. Preserve EXACT Korean product names (do NOT translate or paraphrase)
4. Extract model numbers, colors, and key details EXACTLY as shown
5. Identify if multiple distinct products are shown

Return JSON:
{{
  "products": [
    {{
      "brand": "BRAND_NAME",
      "exact_ocr_text": "exact product name/description from OCR",
      "product_type": "tops/bottoms/bag/shoes/accessory",
      "model_number": "if visible",
      "confidence": "high/medium/low"
    }}
  ],
  "websites": ["brand_website1.com", "brand_website2.kr"],
  "image_has_multiple_products": true/false
}}

CRITICAL RULES:
- Preserve EXACT Korean text for product names
- Exclude platform brands (Musinsa, Coupang, Instagram, Ably, Kream, Temu)
- confidence=high if brand name + detailed product info visible
- If unsure about brand, skip it (quality over quantity)"""
        
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "Extract brands and products from OCR text. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0
            )
            
            result_text = response.choices[0].message.content
            result_text = result_text.replace('```json', '').replace('```', '').strip()
            
            result = json.loads(result_text)
            return result
            
        except Exception as e:
            print(f"   ❌ Mapping error: {e}")
            return {'products': [], 'websites': [], 'image_has_multiple_products': False}
    
    def upload_to_supabase(self, image_url: str) -> Optional[str]:
        """Upload image to Supabase for use with Serper /lens"""
        try:
            # If image is already in Supabase, just return it!
            if 'supabase.co' in image_url:
                print(f"   ✅ Image already in Supabase, using directly")
                return image_url
            
            # Otherwise, download and upload
            # Download image (longer timeout)
            response = requests.get(image_url, timeout=60)
            response.raise_for_status()
            image_bytes = response.content
            
            # Generate unique filename
            timestamp = int(time.time() * 1000)
            import hashlib
            file_hash = hashlib.md5(image_url.encode()).hexdigest()[:8]
            filename = f"ocr_search_{timestamp}_{file_hash}.jpg"
            
            # Upload to Supabase storage
            upload_response = self.supabase.storage.from_("images").upload(
                filename,
                image_bytes,
                {"content-type": "image/jpeg", "upsert": "false"}
            )
            
            # Check for errors
            if isinstance(upload_response, dict) and 'error' in upload_response:
                print(f"   ❌ Supabase error: {upload_response.get('error')}")
                return None
            
            # Get public URL
            public_url = self.supabase.storage.from_("images").get_public_url(filename)
            return public_url
                
        except Exception as e:
            print(f"   ❌ Supabase upload error: {e}")
        
        return None
    
    def visual_search_with_lens(self, image_url: str, query_hint: str = "") -> List[Dict]:
        """Execute visual image search with /lens endpoint (with retry logic)"""
        all_results = []
        
        # Call Serper /lens API (reduced to 1 run for speed optimization)
        for i in range(1):
            max_retries = 2
            for attempt in range(max_retries):
                try:
                    response = requests.post(
                        "https://google.serper.dev/lens",
                        json={"url": image_url, "gl": "kr", "hl": "ko"},
                        headers={"X-API-KEY": self.serper_api_key},
                        timeout=15
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        organic = result.get('organic', [])
                        all_results.extend(organic)
                        break  # Success, exit retry loop
                    
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"   ⚠️  Visual search attempt {attempt + 1} failed, retrying...")
                        time.sleep(2)  # Wait before retry
                    else:
                        print(f"   ❌ Visual search error after {max_retries} attempts: {e}")
            
            time.sleep(0.5)  # Small delay between calls
        
        # Deduplicate by link
        seen = set()
        unique_results = []
        for item in all_results:
            link = item.get('link')
            if link and link not in seen:
                seen.add(link)
                unique_results.append(item)
        
        return unique_results[:30]  # Top 30 for GPT
    
    def extract_thumbnail_from_url(self, url: str) -> Optional[str]:
        """Extract product image from page Open Graph tags or first image"""
        try:
            response = requests.get(url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            })
            
            if response.status_code != 200:
                print(f"         ⚠️  {url[:50]}... returned {response.status_code}")
                return None
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Try Open Graph image (best quality, set by site for sharing)
            og_image = soup.find('meta', property='og:image')
            if og_image and og_image.get('content'):
                image_url = og_image['content']
                # Make absolute URL if relative
                result = urljoin(url, image_url)
                print(f"         ✅ OG image: {url[:40]}...")
                return result
            
            # Try Twitter card image
            twitter_image = soup.find('meta', attrs={'name': 'twitter:image'})
            if twitter_image and twitter_image.get('content'):
                image_url = twitter_image['content']
                result = urljoin(url, image_url)
                print(f"         ✅ Twitter image: {url[:40]}...")
                return result
            
            # Try first product image (common class names)
            for class_name in ['product-image', 'product-img', 'main-image', 'item-image', 'goods-img']:
                img = soup.find('img', class_=class_name)
                if img and img.get('src'):
                    result = urljoin(url, img['src'])
                    print(f"         ✅ Class image: {url[:40]}...")
                    return result
            
            # Fallback: First large image on page
            for img in soup.find_all('img', src=True)[:15]:
                src = img['src']
                # Skip small images, icons, logos
                if any(skip in src.lower() for skip in ['icon', 'logo', 'banner', 'sprite', '1x1', 'blank']):
                    continue
                # Skip data URIs
                if src.startswith('data:'):
                    continue
                result = urljoin(url, src)
                print(f"         ✅ Fallback image: {url[:40]}...")
                return result
            
            print(f"         ⚠️  No image found: {url[:50]}...")
                
        except Exception as e:
            print(f"         ❌ Error extracting from {url[:40]}...: {str(e)[:50]}")
        
        return None
    
    def enrich_results_with_thumbnails(self, results: List[Dict], max_fetch: int = 10) -> List[Dict]:
        """Fetch thumbnails for results that don't have them"""
        enriched = []
        fetch_count = 0
        
        for item in results:
            # If already has thumbnail, keep it
            if item.get('thumbnail') and item['thumbnail']:
                enriched.append(item)
                continue
            
            # Try to fetch thumbnail (but limit to avoid slowdown)
            if fetch_count < max_fetch:
                url = item.get('link')
                if url:
                    thumbnail = self.extract_thumbnail_from_url(url)
                    if thumbnail:
                        item['thumbnail'] = thumbnail
                        fetch_count += 1
            
            enriched.append(item)
        
        return enriched
    
    def filter_social_media(self, results: List[Dict]) -> List[Dict]:
        """Filter out social media, news, blogs, and non-product sites"""
        filtered = []
        
        for item in results:
            link = item.get('link', '').lower()
            title = item.get('title', '').lower()
            
            # Check blocked domains (social media)
            if any(domain in link for domain in self.blocked_domains):
                continue
            
            # Block magazine/editorial/travel/POI sites
            blocked_sites = [
                'vogue.co.kr', 'elle.co.kr', 'harpersbazaar.co.kr', 'cosmopolitan.co.kr',
                'gq.co.kr', 'marie.co.kr', 'allure.co.kr', 'esquire.co.kr',
                'tripinfo.co.kr', 'tripadvisor', 'booking.com', 'expedia',
                'storelocator', '/stores/', '/store-locator', '/find-store',
                '/locations/', '/location/', 'maps.', 'directions.'
            ]
            
            if any(site in link for site in blocked_sites):
                continue
            
            # Check for news/blog/editorial sites
            news_patterns = [
                '/article/', '/news/', '/post/', '/blog/',
                'news.', 'blog.', 'magazine.', 'editorial.',
                '/story/', '/press/', '/media/', '/column/',
                'journalist', 'reporter', '/review/',
                '.mk.co.kr/', 'naver.com/now', '/read/',
                'tistory.com', 'brunch.co.kr', 'velog.io',
                'medium.com', 'notion.site', '/articles/',
                'daum.net/news', 'nate.com/news', '/magazine/',
                '/editorial/', '/lookbook/', '/collection-',
                '/trend/', '/fashion-week', '/runway/'
            ]
            
            if any(pattern in link for pattern in news_patterns):
                continue
            
            # Check for category/search/list/store locator pages
            if any(pattern in link for pattern in [
                '/search?', '/search.', '/list?', '/list.', '/list_',
                '/category?', '/category.', '/category_',
                'query=', 'keyword=', '/collections?',
                'cate_no=', '/category/', '/categories/',
                '/shop?', '/browse?', '/filter?',
                '/stores?', '/locations?', 'storedetails',
                'storeID=', '/boutiques/', '/boutique-locator'
            ]):
                continue
            
            # Must have strong shopping indicators (be more strict!)
            has_product_indicator = any(indicator in link for indicator in [
                '/product/', '/products/', '/item/', '/items/',
                '/goods/', '/detail/', '/pd/', '/p/',
                'smartstore.naver', '/shop/product', '/en/product'
            ])
            
            # Korean e-commerce platforms are safe
            is_korean_ecommerce = any(platform in link for platform in [
                'musinsa.com', '29cm.co.kr', 'zigzag.kr', 'ably.com',
                'coupang.com', 'shopping.naver.com', 'wconcept.co.kr',
                'kream.co.kr', 'balaan.co.kr', 'a-land.co.kr',
                'ssfshop.com', 'lotteon.com', '11st.co.kr'
            ])
            
            # Accept if strong product indicator OR trusted Korean platform
            if has_product_indicator or is_korean_ecommerce:
                filtered.append(item)
        
        return filtered
    
    def gpt_select_best_matches(self, brand: str, product_text: str, 
                                results: List[Dict], product_type: str = "") -> List[Dict]:
        """Use GPT-4o to select 3 best visual + contextual matches"""
        
        if not results:
            return []
        
        # Prepare results for GPT (include title, link, thumbnail)
        results_for_gpt = []
        for r in results[:30]:  # Limit to top 30
            results_for_gpt.append({
                'link': r.get('link'),
                'title': r.get('title', ''),
                'thumbnail': r.get('thumbnail', r.get('image', '')),
                'snippet': r.get('snippet', '')
            })
        
        prompt = f"""You are selecting the BEST 3 PRODUCT PURCHASE PAGES from search results.

TARGET PRODUCT:
- Brand: {brand}
- Description: {product_text}
- Type: {product_type}

CRITICAL RULES - MUST FOLLOW:
1. ✅ ONLY select links where you can BUY/PURCHASE the actual product
2. ❌ REJECT magazines (Vogue, Elle, Harper's Bazaar, GQ, Cosmopolitan, etc.)
3. ❌ REJECT travel/POI sites (TripInfo, TripAdvisor, booking sites)
4. ❌ REJECT store locators (storeID=, /locations/, /stores/, /boutiques/)
5. ❌ REJECT news articles, blog posts, editorials, lookbooks
6. ❌ REJECT category/collection/list pages
7. ❌ REJECT brand homepage or generic shop pages
8. ❌ REJECT if link doesn't contain product-specific info

ACCEPT ONLY IF:
- URL contains: /product/, /item/, /goods/, /detail/, /p/, /pd/
- OR from trusted platforms: Musinsa, 29cm, Zigzag, Ably, Coupang, Naver Shopping, W Concept, Kream, Balaan
- AND brand matches: {brand}
- AND product type matches: {product_type}

AVAILABLE RESULTS:
{json.dumps(results_for_gpt, ensure_ascii=False, indent=2)}

TASK:
Select ONLY the BEST 3 actual product purchase pages.
- If you see magazine/editorial/travel sites → REJECT them
- If you see store locators → REJECT them
- If URL doesn't look like a product page → REJECT it
- Return fewer than 3 if not enough REAL product pages exist
- Return [] if NO valid product pages found

Return JSON:
{{
  "selected": [
    {{
      "link": "url",
      "title": "title",
      "thumbnail": "image_url",
      "reason": "why this is a VALID PRODUCT PAGE (one sentence)"
    }}
  ]
}}"""
        
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "You select best product matches from search results. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0
            )
            
            result_text = response.choices[0].message.content
            result_text = result_text.replace('```json', '').replace('```', '').strip()
            
            result = json.loads(result_text)
            selected = result.get('selected', [])
            
            # Ensure thumbnails are preserved from original results
            for item in selected:
                if not item.get('thumbnail'):
                    # Try to find thumbnail from original results by matching link
                    for original in results:
                        if original.get('link') == item.get('link'):
                            item['thumbnail'] = original.get('thumbnail') or original.get('image')
                            break
            
            return selected
            
        except Exception as e:
            print(f"   ❌ GPT selection error: {e}")
            # Fallback: return top 3 filtered results
            return [
                {
                    'link': r.get('link'),
                    'title': r.get('title'),
                    'thumbnail': r.get('thumbnail', r.get('image')),
                    'reason': 'fallback selection'
                }
                for r in results[:3]
            ]
    
    def priority_text_search(self, brand: str, product_text: str, brand_websites: List[str] = None) -> Dict:
        """
        Execute priority-based text search (from V1)
        
        Priority 1: Korean platforms (Musinsa, 29cm, etc.)
        Priority 2: Brand website (from OCR or discovery) + site search
        Priority 3: General search (fallback)
        """
        all_results = []
        search_log = []
        
        # Use OCR-extracted websites if available
        if not brand_websites:
            brand_websites = []
        
        # Priority 1: Korean Platforms
        print(f"      🔍 Priority 1: Korean platforms...")
        
        for platform in self.korean_platforms[:5]:  # Top 5 platforms for better coverage
            query = f"site:{platform} {brand} {product_text}"
            
            try:
                response = requests.post(
                    "https://google.serper.dev/search",
                    json={"q": query, "gl": "kr", "hl": "ko", "num": 5},
                    headers={"X-API-KEY": self.serper_api_key},
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    organic = result.get('organic', [])
                    
                    if organic:
                        print(f"         ✅ {platform}: {len(organic)} results")
                        for item in organic:
                            if 'thumbnail' not in item:
                                item['thumbnail'] = ''
                            item['source'] = f'platform_{platform}'
                        all_results.extend(organic)
                        search_log.append({'platform': platform, 'found': len(organic)})
                    
                time.sleep(0.3)  # Rate limiting
                    
            except Exception as e:
                print(f"         ❌ {platform} error: {e}")
        
        # Priority 2: Brand Website (Use OCR-extracted websites first!)
        print(f"      🔍 Priority 2: Brand website...")
        
        brand_domain = None
        
        # Step 1: Try OCR-extracted websites first
        if brand_websites:
            from urllib.parse import urlparse
            for website in brand_websites:
                # Clean up website (remove www., m., http/https)
                cleaned = website.replace('www.', '').replace('m.', '').replace('http://', '').replace('https://', '').strip('/')
                if cleaned and not any(ex in cleaned for ex in ['instagram.com', 'facebook.com', 'tiktok.com']):
                    brand_domain = cleaned
                    print(f"         ✅ Using OCR website: {brand_domain}")
                    break
        
        # Step 2: If no OCR website, try discovery
        if not brand_domain:
            try:
                discovery_query = f"{brand} site:*.co.kr OR site:*.com 공식 홈페이지"
                response = requests.post(
                    "https://google.serper.dev/search",
                    json={"q": discovery_query, "gl": "kr", "hl": "ko", "num": 5},
                    headers={"X-API-KEY": self.serper_api_key},
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    organic = result.get('organic', [])
                    
                    # Extract domain from first result
                    for item in organic[:3]:
                        link = item.get('link', '')
                        try:
                            from urllib.parse import urlparse
                            parsed = urlparse(link)
                            domain = parsed.netloc.replace('www.', '').replace('m.', '')
                            
                            # Exclude known platforms and social media
                            excluded = ['instagram.com', 'facebook.com', 'naver.com', 
                                      'youtube.com', 'tiktok.com'] + self.korean_platforms
                            
                            if domain and not any(ex in domain for ex in excluded):
                                brand_domain = domain
                                print(f"         Discovered: {brand_domain}")
                                break
                        except:
                            continue
                    
                    time.sleep(0.3)
                    
            except Exception as e:
                print(f"         ❌ Brand discovery error: {e}")
        
        # Step 3: Search on brand domain (if found)
        if brand_domain:
            try:
                site_query = f"site:{brand_domain} {product_text}"
                response = requests.post(
                    "https://google.serper.dev/search",
                    json={"q": site_query, "gl": "kr", "hl": "ko", "num": 5},
                    headers={"X-API-KEY": self.serper_api_key},
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    organic = result.get('organic', [])
                    
                    if organic:
                        print(f"         ✅ Brand site: {len(organic)} results")
                        for item in organic:
                            if 'thumbnail' not in item:
                                item['thumbnail'] = ''
                            item['source'] = f'brand_website_{brand_domain}'
                        all_results.extend(organic)
                        search_log.append({'brand_site': brand_domain, 'found': len(organic)})
                
                time.sleep(0.3)
                
            except Exception as e:
                print(f"         ❌ Brand site search error: {e}")
        
        # Priority 3: General Search (Fallback)
        print(f"      🔍 Priority 3: General search...")
        
        try:
            query = f"{brand} {product_text}"
            response = requests.post(
                "https://google.serper.dev/search",
                json={"q": query, "gl": "kr", "hl": "ko", "num": 10},
                headers={"X-API-KEY": self.serper_api_key},
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                organic = result.get('organic', [])
                
                if organic:
                    print(f"         ✅ General: {len(organic)} results")
                    for item in organic:
                        if 'thumbnail' not in item:
                            item['thumbnail'] = ''
                        item['source'] = 'general_search'
                    all_results.extend(organic)
                    search_log.append({'general': len(organic)})
                    
        except Exception as e:
            print(f"         ❌ General search error: {e}")
        
        return {
            'results': all_results,
            'search_log': search_log
        }
    
    def search_for_product(self, brand: str, product_text: str, 
                          product_type: str, image_url: str, brand_websites: List[str] = None) -> Dict:
        """
        V3 HYBRID search: Visual + Priority Text Search
        
        Steps:
        1. Visual search /lens (for image matching)
        2. Priority text search (platforms → brand site → general)
        3. Combine & deduplicate both result sets
        4. Filter out social media
        5. GPT selects 3 best matches from combined pool
        """
        
        result = {
            'success': False,
            'selected_results': [],
            'method': None,
            'total_visual_candidates': 0,
            'total_priority_text_candidates': 0,
            'total_combined_candidates': 0,
            'search_breakdown': {}
        }
        
        all_raw_results = []
        
        # Step 1: Upload image for visual search
        print(f"      📤 Uploading image to Supabase...")
        supabase_url = self.upload_to_supabase(image_url)
        
        # Step 2a: Visual search
        if supabase_url:
            print(f"      🔍 Visual search /lens (3 runs)...")
            visual_results = self.visual_search_with_lens(supabase_url, f"{brand} {product_text}")
            result['total_visual_candidates'] = len(visual_results)
            print(f"      📊 Visual: {len(visual_results)} results")
            all_raw_results.extend(visual_results)
        else:
            print(f"      ⚠️  Image upload failed, skipping visual search")
        
        # Step 2b: Priority-based text search (using OCR-extracted websites!)
        print(f"      🔍 Priority text search (platforms → brand → general)...")
        priority_search = self.priority_text_search(brand, product_text, brand_websites)
        text_results = priority_search['results']
        result['total_priority_text_candidates'] = len(text_results)
        result['search_breakdown'] = priority_search['search_log']
        print(f"      📊 Priority Text: {len(text_results)} results")
        all_raw_results.extend(text_results)
        
        if not all_raw_results:
            print(f"      ⚠️  No results from either search method")
            return result
        
        # Step 3: Deduplicate combined results by link
        seen_links = set()
        combined_results = []
        for item in all_raw_results:
            link = item.get('link')
            if link and link not in seen_links:
                seen_links.add(link)
                combined_results.append(item)
        
        result['total_combined_candidates'] = len(combined_results)
        print(f"      📊 Combined: {len(combined_results)} unique results")
        
        # Step 4: Filter social media
        print(f"      🚫 Filtering social media...")
        filtered_results = self.filter_social_media(combined_results)
        print(f"      📊 After filtering: {len(filtered_results)} results")
        
        if not filtered_results:
            print(f"      ⚠️  All results were social media/non-product")
            return result
        
        # Step 4.5: Enrich with thumbnails (fetch from product pages)
        print(f"      🖼️  Fetching thumbnails from product pages...")
        filtered_results = self.enrich_results_with_thumbnails(filtered_results, max_fetch=30)
        thumbnails_found = sum(1 for r in filtered_results if r.get('thumbnail'))
        print(f"      📊 Thumbnails: {thumbnails_found}/{len(filtered_results)} results")
        
        # Step 5: GPT selects best 3 from COMBINED results
        print(f"      🧠 GPT selecting best 3 from combined pool...")
        selected = self.gpt_select_best_matches(brand, product_text, filtered_results, product_type)
        
        if selected:
            result['success'] = True
            result['selected_results'] = selected
            result['method'] = 'v3_hybrid_visual_priority_text'
            print(f"      ✅ Selected {len(selected)} best matches")
        else:
            # Fallback: If GPT returns empty but we have candidates, use top 3 filtered results
            print(f"      ⚠️  GPT found no perfect matches")
            if filtered_results:
                print(f"      🔄 Fallback: Using top 3 filtered results")
                fallback_results = []
                for item in filtered_results[:3]:
                    fallback_results.append({
                        'link': item.get('link'),
                        'title': item.get('title'),
                        'thumbnail': item.get('thumbnail', item.get('image', '')),
                        'reason': 'Fallback selection (GPT found no perfect match but this is a relevant result)'
                    })
                result['success'] = True
                result['selected_results'] = fallback_results
                result['method'] = 'v3_hybrid_with_fallback'
                print(f"      ✅ Using {len(fallback_results)} fallback results")
            else:
                print(f"      ❌ No results available")
        
        return result
    
    def process_image_url(self, image_url: str) -> Dict:
        """
        Main pipeline: OCR → Brand mapping → Visual search → GPT selection
        Works with image URLs (for MVP integration)
        """
        print(f"\n{'='*80}")
        print(f"🎯 Processing image from URL")
        print(f"{'='*80}")
        
        start_time = time.time()
        
        # Report progress: Starting
        if self.progress_callback:
            self.progress_callback(5, "텍스트 추출 중...")
        
        # Step 1: OCR
        print(f"\n📖 Step 1: OCR Text Extraction...")
        ocr_result = self.extract_text_from_url(image_url)
        
        if not ocr_result.get('full_text'):
            print(f"   ⚠️  No text detected")
            return {
                'success': False,
                'reason': 'No OCR text',
                'image_url': image_url
            }
        
        print(f"   ✅ Extracted {len(ocr_result['segments'])} text segments")
        
        # Report progress: OCR complete
        if self.progress_callback:
            self.progress_callback(20, "브랜드 분석 중...")
        
        # Step 2: Brand-Product Mapping
        print(f"\n🧠 Step 2: Brand-Product Mapping...")
        mapping = self.map_brands_to_products(ocr_result)
        
        products = mapping.get('products', [])
        products = [p for p in products if p.get('brand') not in self.platform_brands]
        
        if not products:
            print(f"   ⚠️  No products identified")
            return {
                'success': False,
                'reason': 'No products identified',
                'ocr_text': ocr_result['full_text'],
                'image_url': image_url
            }
        
        print(f"   ✅ Identified {len(products)} product(s)")
        
        # Report progress: Mapping complete
        if self.progress_callback:
            self.progress_callback(35, f"{len(products)}개 상품 검색 중...")
        
        # Step 3: Search for each product
        print(f"\n🔍 Step 3: Searching for Products...\n")
        
        # Get brand websites from OCR mapping
        brand_websites = mapping.get('websites', [])
        
        product_results = []
        
        for i, product in enumerate(products, 1):
            brand = product.get('brand', 'Unknown')
            text = product.get('exact_ocr_text', '')
            product_type = product.get('product_type', '')
            
            print(f"   Product {i}/{len(products)}: {brand}")
            print(f"   Text: {text[:100]}...")
            
            # Report progress: Searching product i/total (35% to 85%)
            if self.progress_callback:
                progress = 35 + int((i / len(products)) * 50)
                self.progress_callback(progress, f"{brand} 검색 중... ({i}/{len(products)})")
            
            # Pass OCR-extracted websites to search
            search_result = self.search_for_product(brand, text, product_type, image_url, brand_websites)
            
            product_results.append({
                'product': product,
                'search_result': search_result
            })
            
            time.sleep(1)  # Rate limiting
        
        # Summary
        processing_time = time.time() - start_time
        successful_searches = sum(1 for pr in product_results if pr['search_result']['success'])
        
        # Report progress: Complete
        if self.progress_callback:
            self.progress_callback(95, "결과 정리 중...")
        
        print(f"\n{'='*80}")
        print(f"✅ Processing Complete")
        print(f"{'='*80}")
        print(f"⏱️  Time: {processing_time:.1f}s")
        print(f"📦 Products: {len(products)}")
        print(f"✅ Found: {successful_searches}/{len(products)}\n")
        
        # Final progress
        if self.progress_callback:
            self.progress_callback(100, "완료!")
        
        return {
            'success': True,
            'image_url': image_url,
            'processing_time': processing_time,
            'ocr_result': ocr_result,
            'mapping': mapping,
            'product_results': product_results,
            'summary': {
                'total_products': len(products),
                'successful_searches': successful_searches
            }
        }

