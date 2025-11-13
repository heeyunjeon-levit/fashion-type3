"""
Process a single user from the Excel file and generate a shareable HTML page.
Perfect for testing before processing all 41 users.
"""

import pandas as pd
import requests
import time
import json
import os
import sys
from datetime import datetime
from typing import Dict, Optional

# Import the MVP HTML generator
sys.path.insert(0, os.path.dirname(__file__))
from html_generator import generate_html_page

EXCEL_FILE_PATH = '/Users/levit/Desktop/file+phonenumber.xlsx'
# Use Next.js frontend URL (defaults to local dev server)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

def download_image(url: str, phone: str, output_dir: str = './single_user_test') -> Optional[str]:
    """Download image from Typeform URL"""
    os.makedirs(output_dir, exist_ok=True)
    try:
        print(f"📥 Downloading image...")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        local_path = os.path.join(output_dir, f"{phone}_original.jpg")
        with open(local_path, 'wb') as f:
            f.write(response.content)
        
        print(f"✅ Downloaded: {local_path}")
        return local_path
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return None

def upload_to_frontend(image_path: str) -> Optional[str]:
    """Upload image to frontend (which uploads to Supabase)"""
    try:
        print(f"📤 Uploading image...")
        with open(image_path, 'rb') as f:
            files = {'file': (os.path.basename(image_path), f, 'image/jpeg')}
            response = requests.post(
                f"{FRONTEND_URL}/api/upload",
                files=files,
                timeout=60
            )
            response.raise_for_status()
            data = response.json()
            image_url = data.get('imageUrl')
            print(f"✅ Uploaded: {image_url}")
            return image_url
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        return None

def analyze_and_crop(image_url: str) -> Optional[Dict]:
    """Analyze image and crop items (calls GPU backend via frontend)"""
    try:
        print(f"✂️  Analyzing and cropping items (this may take 15-30s)...")
        response = requests.post(
            f"{FRONTEND_URL}/api/analyze",
            json={'imageUrl': image_url},
            timeout=120
        )
        response.raise_for_status()
        data = response.json()
        items = data.get('items', [])
        categories = [item['category'] for item in items]
        print(f"✅ Found {len(items)} items: {', '.join(categories)}")
        
        # Convert to format expected by search
        # API expects: {"tops": "url_string", "bag": "url_string"}
        # NOT: {"tops": {"url": "...", "description": "..."}}
        cropped_images = {}
        seen_categories = set()
        for item in items:
            category = item['category']
            if category not in seen_categories:
                # Just pass the URL string, not an object!
                cropped_images[category] = item.get('croppedImageUrl', '')
                seen_categories.add(category)
        
        return {'items': items, 'croppedImages': cropped_images}
    except Exception as e:
        print(f"❌ Analysis/cropping failed: {e}")
        return None

def search_items(cropped_data: Dict, original_url: str) -> Optional[Dict]:
    """Search for products"""
    try:
        categories = list(cropped_data.get('croppedImages', {}).keys())
        if not categories:
            print(f"⚠️  No categories to search")
            return None
        
        print(f"🔍 Searching for products (this may take 20-30s)...")
        response = requests.post(
            f"{FRONTEND_URL}/api/search",
            json={
                'categories': categories,
                'croppedImages': cropped_data.get('croppedImages', {}),
                'originalImageUrl': original_url
            },
            timeout=180
        )
        response.raise_for_status()
        data = response.json()
        
        results_count = sum(len(items) for items in data.get('results', {}).values())
        print(f"✅ Found {results_count} shopping links")
        return data
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return None

def generate_html(phone: str, results: Dict, output_dir: str = './single_user_test') -> str:
    """Generate HTML page"""
    
    search_results = results.get('search_results', {}).get('results', {})
    gpt_reasoning = results.get('search_results', {}).get('gptReasoning', {})
    
    category_names = {
        'tops': '상의',
        'bottoms': '하의',
        'dress': '드레스',
        'shoes': '신발',
        'bag': '가방',
        'accessory': '악세사리'
    }
    
    products_html = ""
    for category, items in search_results.items():
        if not items or len(items) == 0:
            continue
        
        category_ko = category_names.get(category, category)
        reasoning = gpt_reasoning.get(category, {})
        description = reasoning.get('description', '')
        
        products_html += f"""
        <div class="category-section">
            <h2>{category_ko}</h2>
            {f'<p class="description">{description}</p>' if description else ''}
            <div class="products-grid">
        """
        
        for idx, item in enumerate(items[:3], 1):
            title = item.get('title', '상품')
            link = item.get('link', '#')
            thumbnail = item.get('thumbnail', '')
            
            img_tag = f'<img src="{thumbnail}" alt="{title}" onerror="this.style.display=' + "'none'" + '" />' if thumbnail else ''
            title_display = title[:80] + ('...' if len(title) > 80 else '')
            
            products_html += f"""
            <div class="product-card">
                {img_tag}
                <h3>{title_display}</h3>
                <a href="{link}" target="_blank" class="buy-button">
                    구매하러 가기 →
                </a>
            </div>
            """
        
        products_html += """
            </div>
        </div>
        """
    
    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>이미지 분석 결과 - {phone}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }}
        
        header {{
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f3f4f6;
        }}
        
        h1 {{
            font-size: 32px;
            color: #1f2937;
            margin-bottom: 10px;
        }}
        
        .subtitle {{
            color: #6b7280;
            font-size: 16px;
        }}
        
        .category-section {{
            margin-bottom: 50px;
        }}
        
        .category-section h2 {{
            font-size: 24px;
            color: #1f2937;
            margin-bottom: 15px;
            padding-left: 15px;
            border-left: 4px solid #667eea;
        }}
        
        .description {{
            color: #6b7280;
            margin-bottom: 20px;
            padding: 15px;
            background: #f9fafb;
            border-radius: 10px;
            font-size: 14px;
            line-height: 1.6;
        }}
        
        .products-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 25px;
        }}
        
        .product-card {{
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 15px;
            overflow: hidden;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
        }}
        
        .product-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }}
        
        .product-card img {{
            width: 100%;
            height: 280px;
            object-fit: cover;
            background: #f9fafb;
        }}
        
        .product-card h3 {{
            padding: 15px;
            font-size: 15px;
            color: #374151;
            line-height: 1.4;
            min-height: 80px;
            flex-grow: 1;
        }}
        
        .buy-button {{
            display: block;
            margin: 0 15px 15px 15px;
            padding: 12px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            transition: all 0.3s ease;
        }}
        
        .buy-button:hover {{
            transform: scale(1.05);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }}
        
        .footer {{
            text-align: center;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #f3f4f6;
            color: #9ca3af;
            font-size: 14px;
        }}
        
        @media (max-width: 768px) {{
            .container {{
                padding: 20px;
            }}
            
            h1 {{
                font-size: 24px;
            }}
            
            .products-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎉 이미지 분석 결과</h1>
            <p class="subtitle">회원님의 이미지에서 찾은 유사 상품들입니다</p>
        </header>
        
        {products_html}
        
        <div class="footer">
            <p>분석 완료 시간: {datetime.now().strftime('%Y년 %m월 %d일 %H:%M')}</p>
            <p style="margin-top: 10px; font-size: 12px;">이 페이지는 모든 기기에서 확인하실 수 있습니다</p>
        </div>
    </div>
</body>
</html>"""
    
    html_path = os.path.join(output_dir, f"{phone}_result.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    return html_path

def main():
    print("="*60)
    print("Single User Test - Process One User")
    print("="*60)
    print(f"\nFrontend URL: {FRONTEND_URL}")
    print(f"(Backend GPU: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run)")
    print("")
    
    # Read Excel
    try:
        df = pd.read_excel(EXCEL_FILE_PATH)
        df.columns = ['image_url', 'phone']
        print(f"✅ Excel loaded: {len(df)} users")
    except Exception as e:
        print(f"❌ Failed to read Excel: {e}")
        return
    
    # Get first user
    first_user = df.iloc[0]
    phone = str(first_user['phone']).strip()
    image_url = str(first_user['image_url']).strip()
    
    print(f"\n{'='*60}")
    print(f"Processing User: {phone}")
    print(f"{'='*60}\n")
    
    start_time = time.time()
    result = {
        'phone': phone,
        'original_url': image_url,
        'status': 'processing',
        'timestamp': datetime.now().isoformat()
    }
    
    # Step 1: Download
    local_path = download_image(image_url, phone)
    if not local_path:
        print("\n❌ Failed at download step")
        return
    
    # Step 2: Upload
    uploaded_url = upload_to_frontend(local_path)
    if not uploaded_url:
        print("\n❌ Failed at upload step")
        return
    result['uploaded_url'] = uploaded_url
    
    # Step 3: Analyze and Crop
    crop_data = analyze_and_crop(uploaded_url)
    if not crop_data:
        print("\n❌ Failed at analyze/crop step")
        return
    result['cropped_data'] = crop_data
    
    # Step 4: Search
    search_data = search_items(crop_data, uploaded_url)
    if not search_data:
        print("\n❌ Failed at search step")
        return
    result['search_results'] = search_data
    result['status'] = 'success'
    
    elapsed = time.time() - start_time
    print(f"\n✅ Processing complete in {elapsed:.1f}s")
    
    # Save JSON
    json_path = './single_user_test/' + f"{phone}_result.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"📄 Saved JSON: {json_path}")
    
    # Generate HTML with MVP design
    print(f"\n🎨 Generating HTML page with MVP design...")
    html_content = generate_html_page(phone, result)
    html_path = os.path.join('./single_user_test', f"{phone}_result.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"✅ HTML created: {html_path}")
    
    # Also copy to public/results
    import shutil
    public_dir = './public/results'
    os.makedirs(public_dir, exist_ok=True)
    public_path = os.path.join(public_dir, f"{phone}.html")
    shutil.copy(html_path, public_path)
    print(f"📁 Copied to: {public_path}")
    
    print(f"\n{'='*60}")
    print(f"SUCCESS! 🎉")
    print(f"{'='*60}")
    print(f"\nHTML file created: {html_path}")
    print(f"\nTo view locally:")
    print(f"  open {html_path}")
    print(f"\nTo make it accessible from any device, choose one option:")
    print(f"\n1. Quick test (local network only):")
    print(f"   cd single_user_test && python3 -m http.server 8000")
    print(f"   Then visit: http://localhost:8000/{phone}_result.html")
    print(f"\n2. Share publicly (recommended):")
    print(f"   Run: python3 scripts/host_result.py")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()

