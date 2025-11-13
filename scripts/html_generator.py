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
    
    # Build bottom sheets for each category
    bottom_sheets_html = ""
    
    for category, product_links in search_results.items():
        if not product_links or len(product_links) == 0:
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
        
        bottom_sheets_html += f"""
        <div class="bottom-sheet">
            <div class="sheet-handle"></div>
            <div class="sheet-content">
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
        
    </style>
</head>
<body>
    <img src="{original_url}" alt="Original" class="background-image" />
    
    {bottom_sheets_html}
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

