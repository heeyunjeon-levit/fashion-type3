"""
Generate HTML matching the mobile bottom sheet design from the MVP.
"""

import json
import os
from pathlib import Path
from datetime import datetime
from typing import Dict

def generate_html_page(phone: str, results: Dict) -> str:
    """Generate HTML page matching the mobile bottom sheet design"""
    
    if results['status'] != 'success':
        return f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>이미지 분석 결과</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }}
        .error {{
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 16px;
            color: #dc2626;
        }}
    </style>
</head>
<body>
    <div class="error">
        <h2>죄송합니다</h2>
        <p>이미지 처리 중 오류가 발생했습니다.</p>
    </div>
</body>
</html>
        """
    
    search_results = results.get('search_results', {}).get('results', {})
    cropped_data = results.get('cropped_data', {})
    items = cropped_data.get('items', [])
    original_url = results.get('uploaded_url', '')
    
    category_names = {
        'tops': '상의',
        'bottoms': '하의',
        'dress': '드레스',
        'shoes': '신발',
        'bag': '가방',
        'accessory': '악세사리'
    }
    
    # Build category sections (all in one bottom sheet)
    categories_html = ""
    
    for category, product_links in search_results.items():
        if not product_links or len(product_links) == 0:
            continue
        
        # Skip numbered variants (e.g., "tops_1", "tops_2") - only show base categories
        if '_' in category and category.split('_')[-1].isdigit():
            continue
        
        category_key = category.split('_')[0]
        category_ko = category_names.get(category_key, category_key)
        num_products = len(product_links)
        
        # Find the cropped image for this category
        cropped_img = ""
        for item in items:
            if item.get('category') == category_key:
                cropped_img = item.get('croppedImageUrl', '')
                break
        
        # Build product cards (horizontal scroll) - show ALL products
        products_html = ""
        for idx, product in enumerate(product_links, 1):  # Show all products, not just 3
            title = product.get('title', '상품')
            link = product.get('link', '#')
            thumbnail = product.get('thumbnail', '')
            
            if len(title) > 30:
                title = title[:30] + '...'
            
            img_html = f'<img src="{thumbnail}" alt="{title}" />' if thumbnail else '<div class="no-img">No Image</div>'
            
            products_html += f"""
                <a href="{link}" target="_blank" class="product-card">
                    <div class="product-img">
                        {img_html}
                    </div>
                </a>
            """
        
        # Add this category section
        categories_html += f"""
                <div class="category-section">
                    <div class="category-header">
                        <img src="{cropped_img}" alt="{category_ko}" class="cropped-thumb" />
                        <div class="category-info">
                            <h2>{category_ko}</h2>
                            <p>{num_products}개 상품</p>
                        </div>
                    </div>
                    <div class="products-scroll">
                        {products_html}
                    </div>
                </div>
        """
    
    # Add a button to search more images at the bottom
    more_search_button = """
                <div class="more-search-section">
                    <a href="https://mvp-nu-six.vercel.app/" class="more-search-btn">
                        다른 이미지도 찾아보기
                    </a>
                </div>
    """
    
    # Wrap all categories in ONE bottom sheet
    bottom_sheets_html = f"""
        <div class="bottom-sheet">
            <div class="sheet-handle"></div>
            <div class="sheet-content">
                {categories_html}
                {more_search_button}
            </div>
        </div>
    """
    
    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>이미지 분석 결과</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
            background: #000;
            overflow: hidden;
            width: 100vw;
            height: 100vh;
            position: fixed;
        }}
        
        .background-image {{
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 0;
        }}
        
        .bottom-sheet {{
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            border-radius: 20px 20px 0 0;
            z-index: 50;
            max-height: 65vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }}
        
        .sheet-handle {{
            width: 36px;
            height: 5px;
            background: #e0e0e0;
            border-radius: 3px;
            margin: 12px auto 8px;
            flex-shrink: 0;
        }}
        
        .sheet-content {{
            padding: 0 20px 30px;
            overflow-y: auto;
            overflow-x: hidden;
            flex: 1;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            min-height: 0;
        }}
        
        .category-section {{
            margin-bottom: 32px;
        }}
        
        .category-section:last-child {{
            margin-bottom: 0;
        }}
        
        .category-header {{
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 20px;
        }}
        
        .cropped-thumb {{
            width: 72px;
            height: 72px;
            border-radius: 12px;
            object-fit: cover;
            background: #f5f5f5;
        }}
        
        .category-info h2 {{
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 4px;
            color: #000;
        }}
        
        .category-info p {{
            font-size: 14px;
            color: #666;
        }}
        
        .products-scroll {{
            display: flex;
            gap: 10px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            margin-bottom: 16px;
            padding-bottom: 8px;
            padding-right: 20px;
        }}
        
        .products-scroll::-webkit-scrollbar {{
            display: none;
        }}
        
        .product-card {{
            flex: 0 0 130px;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            text-decoration: none;
            display: block;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }}
        
        .product-img {{
            width: 130px;
            height: 170px;
            position: relative;
        }}
        
        .product-img img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
        }}
        
        .no-img {{
            width: 100%;
            height: 100%;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            font-size: 12px;
        }}
        
        .more-search-section {{
            margin-top: 40px;
            padding: 20px 0 10px;
            display: flex;
            justify-content: center;
        }}
        
        .more-search-btn {{
            display: inline-block;
            padding: 16px 32px;
            background: #000;
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }}
        
        .more-search-btn:active {{
            transform: scale(0.95);
            background: #333;
        }}
        
        /* Feedback Modal */
        .feedback-overlay {{
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 1000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }}
        
        .feedback-overlay.show {{
            display: flex;
        }}
        
        .feedback-modal {{
            background: white;
            border-radius: 16px;
            padding: 24px;
            max-width: 400px;
            width: 100%;
            position: relative;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }}
        
        .feedback-close {{
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 4px;
            color: #666;
        }}
        
        .feedback-title {{
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 8px;
            text-align: center;
            color: #000;
        }}
        
        .feedback-subtitle {{
            font-size: 14px;
            color: #666;
            margin-bottom: 24px;
            text-align: center;
        }}
        
        .feedback-buttons {{
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
        }}
        
        .feedback-btn {{
            flex: 1;
            padding: 16px;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }}
        
        .feedback-btn.selected {{
            border-color: #4A90E2;
            background: #EBF5FF;
        }}
        
        .feedback-icon {{
            font-size: 32px;
        }}
        
        .feedback-label {{
            font-size: 14px;
            font-weight: 600;
            color: #333;
        }}
        
        .feedback-input {{
            width: 100%;
            padding: 12px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 14px;
            font-family: inherit;
            resize: vertical;
            min-height: 80px;
        }}
        
        .feedback-submit {{
            width: 100%;
            padding: 16px;
            background: #4A90E2;
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }}
        
        .feedback-submit:disabled {{
            background: #ccc;
            cursor: not-allowed;
        }}
        
        .feedback-submit:active:not(:disabled) {{
            transform: scale(0.98);
            background: #3A7BC8;
        }}
        
        /* Feedback Tab Button (appears after closing modal) */
        .feedback-tab {{
            position: fixed;
            right: 0;
            top: 50%;
            transform: translateY(-50%) translateX(100%);
            background: #4A90E2;
            color: white;
            padding: 12px 8px;
            border-radius: 8px 0 0 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            z-index: 999;
            box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease;
            writing-mode: vertical-rl;
            text-orientation: mixed;
        }}
        
        .feedback-tab.show {{
            transform: translateY(-50%) translateX(0);
        }}
        
        .feedback-tab:active {{
            background: #3A7BC8;
        }}
        
        .feedback-close-text {{
            font-size: 14px;
            color: #4A90E2;
            font-weight: 600;
            cursor: pointer;
            padding: 8px;
            text-align: center;
            margin-top: 8px;
        }}
        
    </style>
</head>
<body>
    <img src="{original_url}" alt="Original" class="background-image" />
    
    {bottom_sheets_html}
    
    <!-- Feedback Modal -->
    <div class="feedback-overlay" id="feedbackOverlay">
        <div class="feedback-modal">
            <h2 class="feedback-title">설문 조사</h2>
            <p class="feedback-subtitle">만족/불만족 체크</p>
            
            <div class="feedback-buttons">
                <button class="feedback-btn" id="satisfiedBtn" onclick="selectSatisfaction('만족')">
                    <div class="feedback-icon">😊</div>
                    <div class="feedback-label">만족</div>
                </button>
                <button class="feedback-btn" id="unsatisfiedBtn" onclick="selectSatisfaction('불만족')">
                    <div class="feedback-icon">😞</div>
                    <div class="feedback-label">불만족</div>
                </button>
            </div>
            
            <textarea 
                class="feedback-input" 
                id="feedbackComment" 
                placeholder="의견을 입력해주세요"
            ></textarea>
            
            <button class="feedback-submit" id="submitBtn" onclick="submitFeedback()" disabled>
                확인
            </button>
            
            <div class="feedback-close-text" onclick="closeFeedbackWithTab()">
                아직 결과를 다 못봤어요!
            </div>
        </div>
    </div>
    
    <!-- Feedback Tab (appears after closing modal) -->
    <div class="feedback-tab" id="feedbackTab" onclick="reopenFeedback()">
        피드백
    </div>
    
    <script>
        // Feedback state
        let selectedSatisfaction = null;
        let feedbackShown = false;
        const pageLoadTime = Date.now();
        const phoneNumber = '{phone}';
        const API_URL = 'https://mvp-nu-six.vercel.app/api/feedback';
        
        // Check if feedback already submitted for this user
        const feedbackKey = 'feedback_submitted_' + phoneNumber;
        if (localStorage.getItem(feedbackKey)) {{
            feedbackShown = true; // Don't show again
        }}
        
        function showFeedback() {{
            if (feedbackShown) return;
            feedbackShown = true;
            document.getElementById('feedbackOverlay').classList.add('show');
            document.getElementById('feedbackTab').classList.remove('show');
        }}
        
        function closeFeedbackWithTab() {{
            // Close modal and show the tab button
            document.getElementById('feedbackOverlay').classList.remove('show');
            document.getElementById('feedbackTab').classList.add('show');
        }}
        
        function reopenFeedback() {{
            // Hide tab and reopen modal
            document.getElementById('feedbackTab').classList.remove('show');
            document.getElementById('feedbackOverlay').classList.add('show');
        }}
        
        function selectSatisfaction(satisfaction) {{
            selectedSatisfaction = satisfaction;
            
            // Update button styles
            const satisfiedBtn = document.getElementById('satisfiedBtn');
            const unsatisfiedBtn = document.getElementById('unsatisfiedBtn');
            
            satisfiedBtn.classList.remove('selected');
            unsatisfiedBtn.classList.remove('selected');
            
            if (satisfaction === '만족') {{
                satisfiedBtn.classList.add('selected');
            }} else {{
                unsatisfiedBtn.classList.add('selected');
            }}
            
            // Enable submit button
            document.getElementById('submitBtn').disabled = false;
        }}
        
        async function submitFeedback() {{
            if (!selectedSatisfaction) return;
            
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = '전송 중...';
            
            const comment = document.getElementById('feedbackComment').value;
            const timeElapsed = Math.floor((Date.now() - pageLoadTime) / 1000);
            
            try {{
                const response = await fetch(API_URL, {{
                    method: 'POST',
                    headers: {{
                        'Content-Type': 'application/json',
                    }},
                    body: JSON.stringify({{
                        phoneNumber: phoneNumber,
                        satisfaction: selectedSatisfaction,
                        comment: comment,
                        resultPageUrl: window.location.href,
                        pageLoadTime: timeElapsed
                    }})
                }});
                
                if (response.ok) {{
                    // Mark as submitted
                    localStorage.setItem(feedbackKey, 'true');
                    feedbackShown = true; // Prevent modal from showing again
                    submitBtn.textContent = '감사합니다!';
                    setTimeout(function() {{
                        const overlay = document.getElementById('feedbackOverlay');
                        const tab = document.getElementById('feedbackTab');
                        if (overlay) overlay.classList.remove('show');
                        if (tab) tab.classList.remove('show');
                    }}, 1500);
                }} else {{
                    throw new Error('Failed to submit');
                }}
            }} catch (error) {{
                console.error('Error submitting feedback:', error);
                submitBtn.textContent = '전송 실패';
                submitBtn.disabled = false;
                setTimeout(() => {{
                    submitBtn.textContent = '확인';
                }}, 2000);
            }}
        }}
        
        // Enable smooth scrolling on iOS
        document.addEventListener('DOMContentLoaded', function() {{
            const sheetContent = document.querySelector('.sheet-content');
            const productsScroll = document.querySelector('.products-scroll');
            
            let hasEngaged = false;
            let hasClickedProduct = false;
            let hasReachedBottom = false;
            let feedbackTimer = null;
            
            // Check if user clicked product in previous session
            const clickedProductKey = 'clicked_product_' + phoneNumber;
            const previouslyClickedProduct = localStorage.getItem(clickedProductKey);
            
            // Show feedback after 45 seconds (fallback if user doesn't engage)
            feedbackTimer = setTimeout(function() {{
                if (!feedbackShown) {{
                    showFeedback();
                }}
            }}, 45000);
            
            // Track product clicks
            const productCards = document.querySelectorAll('.product-card');
            productCards.forEach(function(card) {{
                card.addEventListener('click', function() {{
                    // Mark that user clicked a product
                    localStorage.setItem(clickedProductKey, Date.now().toString());
                    hasClickedProduct = true;
                }});
            }});
            
            // If user previously clicked product and returned, show feedback after delay
            if (previouslyClickedProduct && !feedbackShown) {{
                const timeClicked = parseInt(previouslyClickedProduct);
                const timeSince = Date.now() - timeClicked;
                
                // If they clicked within last 5 minutes, show feedback after 3 seconds
                if (timeSince < 5 * 60 * 1000) {{
                    clearTimeout(feedbackTimer);
                    setTimeout(function() {{
                        if (!feedbackShown) {{
                            showFeedback();
                            // Clear the flag so we don't show again on future visits
                            localStorage.removeItem(clickedProductKey);
                        }}
                    }}, 3000);
                }} else {{
                    // Old click, clear it
                    localStorage.removeItem(clickedProductKey);
                }}
            }}
            
            // Track scrolling to bottom
            if (sheetContent) {{
                sheetContent.addEventListener('scroll', function() {{
                    const scrollPosition = sheetContent.scrollTop + sheetContent.clientHeight;
                    const bottomPosition = sheetContent.scrollHeight - 50; // 50px threshold
                    
                    if (scrollPosition >= bottomPosition && !hasReachedBottom && !feedbackShown) {{
                        hasReachedBottom = true;
                        clearTimeout(feedbackTimer);
                        // Show feedback 3 seconds after reaching bottom
                        setTimeout(function() {{
                            if (!feedbackShown) {{
                                showFeedback();
                            }}
                        }}, 3000);
                    }}
                }}, {{ passive: true }});
            }}
            
            // Prevent body scroll, allow sheet scroll
            document.body.addEventListener('touchmove', function(e) {{
                if (!sheetContent.contains(e.target)) {{
                    e.preventDefault();
                }}
            }}, {{ passive: false }});
            
            // Enable horizontal scroll for products
            if (productsScroll) {{
                let isDown = false;
                let startX;
                let scrollLeft;
                
                productsScroll.addEventListener('touchstart', function(e) {{
                    isDown = true;
                    startX = e.touches[0].pageX - productsScroll.offsetLeft;
                    scrollLeft = productsScroll.scrollLeft;
                }});
                
                productsScroll.addEventListener('touchmove', function(e) {{
                    if (!isDown) return;
                    e.stopPropagation();
                    const x = e.touches[0].pageX - productsScroll.offsetLeft;
                    const walk = (x - startX) * 2;
                    productsScroll.scrollLeft = scrollLeft - walk;
                }});
                
                productsScroll.addEventListener('touchend', function() {{
                    isDown = false;
                }});
            }}
        }});
    </script>
</body>
</html>"""
    
    return html


def main():
    results_dir = './single_user_test'
    output_dir = './single_user_test'
    os.makedirs(output_dir, exist_ok=True)
    
    result_files = list(Path(results_dir).glob('*_result.json'))
    
    if not result_files:
        print("❌ No result files found")
        return
    
    print(f"📄 Generating mobile bottom sheet design for {len(result_files)} users...\n")
    
    for result_file in result_files:
        phone = result_file.stem.replace('_result', '')
        
        with open(result_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        
        html = generate_html_page(phone, results)
        
        output_file = os.path.join(output_dir, f"{phone}_result.html")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"✅ Generated: {output_file}")
    
    # Copy to public/results
    public_dir = './public/results'
    os.makedirs(public_dir, exist_ok=True)
    
    for result_file in result_files:
        phone = result_file.stem.replace('_result', '')
        src = os.path.join(output_dir, f"{phone}_result.html")
        dst = os.path.join(public_dir, f"{phone}.html")
        
        with open(src, 'r', encoding='utf-8') as f:
            content = f.read()
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(content)
    
    print(f"\n✅ Mobile design generated!")
    print(f"Open: open {output_dir}/{phone}_result.html")


if __name__ == '__main__':
    main()

