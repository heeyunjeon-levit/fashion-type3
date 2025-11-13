"""
Generate shareable HTML pages matching the MVP design exactly.
"""

import json
import os
from pathlib import Path
from datetime import datetime
from typing import Dict

def generate_html_page(phone: str, results: Dict) -> str:
    """Generate HTML page matching the MVP design exactly"""
    
    if results['status'] != 'success':
        return f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>이미지 분석 결과</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f9fafb;
            margin: 0;
            padding: 20px;
        }}
        .container {{
            max-width: 800px;
            margin: 32px auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            padding: 48px;
            text-align: center;
        }}
        .error {{
            color: #dc2626;
            font-size: 18px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>이미지 분석 결과</h1>
        <p class="error">죄송합니다. 이미지 처리 중 오류가 발생했습니다.</p>
    </div>
</body>
</html>
        """
    
    search_results = results.get('search_results', {}).get('results', {})
    cropped_data = results.get('cropped_data', {})
    items = cropped_data.get('items', [])
    
    category_names = {
        'tops': '상의',
        'bottoms': '하의',
        'dress': '드레스',
        'shoes': '신발',
        'bag': '가방',
        'accessory': '악세사리'
    }
    
    # Build cropped images section (matching MVP design)
    cropped_images_html = ""
    if items and len(items) > 0:
        cropped_images_html = f"""
        <div class="section">
            <h2 class="section-title">
                <span>✂️</span>
                <span>Cropped Images ({len(items)}):</span>
            </h2>
            <div class="cropped-grid">
        """
        for item in items:
            img_url = item.get('croppedImageUrl', '')
            category = item.get('category', 'item')
            if img_url:
                cropped_images_html += f"""
                <div class="cropped-image">
                    <img src="{img_url}" alt="Cropped {category}" />
                </div>
                """
        cropped_images_html += """
            </div>
        </div>
        """
    
    # Build product sections (matching MVP design exactly)
    products_html = ""
    if not search_results or len(search_results) == 0:
        products_html = """
        <div class="section">
            <p class="no-results">결과를 찾을 수 없습니다.</p>
        </div>
        """
    else:
        for category, product_links in search_results.items():
            if not product_links or len(product_links) == 0:
                continue
                
            category_key = category.split('_')[0]
            category_ko = category_names.get(category_key, category_key)
            num_products = len(product_links)
            
            products_html += f"""
        <div class="section">
            <h2 class="category-title">
                {category_ko.upper()} ({num_products} products)
            </h2>
            <div class="products-grid">
            """
            
            for idx, product in enumerate(product_links[:3], 1):
                title = product.get('title', '상품')
                link = product.get('link', '#')
                thumbnail = product.get('thumbnail', '')
                
                # Truncate title if too long
                if len(title) > 60:
                    title = title[:60] + '...'
                
                img_html = ""
                if thumbnail:
                    img_html = f'<img src="{thumbnail}" alt="{title}" />'
                else:
                    img_html = '<div class="no-image">No Image</div>'
                
                products_html += f"""
                <div class="product-card">
                    <div class="product-image">
                        {img_html}
                    </div>
                    <div class="product-title">
                        <p>{title}</p>
                    </div>
                    <div class="product-button">
                        <a href="{link}" target="_blank" rel="noopener noreferrer">
                            View Product →
                        </a>
                    </div>
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background: #f9fafb;
            padding: 20px 16px;
        }}
        
        .container {{
            max-width: 1536px;
            margin: 32px auto;
        }}
        
        .section {{
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            padding: 32px;
            margin-bottom: 48px;
        }}
        
        .section-title {{
            font-size: 24px;
            font-weight: 700;
            color: #4f46e5;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        
        .category-title {{
            font-size: 30px;
            font-weight: 700;
            color: #4f46e5;
            margin-bottom: 32px;
        }}
        
        .cropped-grid {{
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
        }}
        
        .cropped-image {{
            width: 180px;
            height: 180px;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }}
        
        .cropped-image img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
        }}
        
        .products-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 24px;
        }}
        
        @media (min-width: 768px) {{
            .products-grid {{
                grid-template-columns: repeat(3, 1fr);
            }}
        }}
        
        .product-card {{
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: all 0.3s ease;
        }}
        
        .product-card:hover {{
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }}
        
        .product-image {{
            aspect-ratio: 4 / 3;
            overflow: hidden;
            background: #f9fafb;
        }}
        
        .product-image img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s ease;
        }}
        
        .product-card:hover .product-image img {{
            transform: scale(1.05);
        }}
        
        .no-image {{
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #9ca3af;
        }}
        
        .product-title {{
            padding: 16px;
            flex-grow: 1;
            display: flex;
            align-items: center;
        }}
        
        .product-title p {{
            font-size: 14px;
            color: #1f2937;
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            min-height: 2.5rem;
        }}
        
        .product-button {{
            padding: 0 16px 16px 16px;
        }}
        
        .product-button a {{
            display: block;
            width: 100%;
            background: #4f46e5;
            color: white;
            text-align: center;
            padding: 12px 16px;
            border-radius: 8px;
            font-weight: 600;
            text-decoration: none;
            transition: background 0.2s ease;
        }}
        
        .product-button a:hover {{
            background: #4338ca;
        }}
        
        .no-results {{
            text-align: center;
            color: #6b7280;
            font-size: 18px;
            padding: 32px;
        }}
        
        @media (max-width: 768px) {{
            .container {{
                padding: 0;
            }}
            
            .section {{
                padding: 24px 16px;
                margin-bottom: 32px;
            }}
            
            .category-title {{
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
        {cropped_images_html}
        {products_html}
    </div>
</body>
</html>"""
    
    return html


def main():
    results_dir = './single_user_test'
    output_dir = './single_user_test'
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all result JSON files
    result_files = list(Path(results_dir).glob('*_result.json'))
    
    if not result_files:
        print("❌ No result files found in ./single_user_test/")
        print("Run process_single_user.py first to generate results.")
        return
    
    print(f"📄 Found {len(result_files)} result files")
    print(f"Generating HTML pages with MVP design...\n")
    
    for result_file in result_files:
        phone = result_file.stem.replace('_result', '')
        
        with open(result_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        
        html = generate_html_page(phone, results)
        
        output_file = os.path.join(output_dir, f"{phone}_result.html")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"✅ Generated: {output_file}")
    
    # Also copy to public/results for deployment
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
        
        print(f"📁 Copied to: {dst}")
    
    print(f"\n{'='*60}")
    print(f"✅ Generated {len(result_files)} HTML pages with MVP design")
    print(f"📁 Location: {output_dir}")
    print(f"📁 Public: {public_dir}")
    print(f"\nOpen locally: open {output_dir}/{phone}_result.html")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()

