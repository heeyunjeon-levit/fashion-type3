"""
Generate shareable HTML pages for each user's results.
This is an alternative to SMS - you can send users a link to their results page.
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
    gpt_reasoning = results.get('search_results', {}).get('gptReasoning', {})
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
    
    # Build product sections
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
        
        for idx, item in enumerate(items[:3], 1):  # Show top 3
            title = item.get('title', '상품')
            link = item.get('link', '#')
            thumbnail = item.get('thumbnail', '')
            
            products_html += f"""
            <div class="product-card">
                {f'<img src="{thumbnail}" alt="{title}" />' if thumbnail else ''}
                <h3>{title[:60]}...</h3>
                <a href="{link}" target="_blank" class="buy-button">
                    구매하러 가기 →
                </a>
            </div>
            """
        
        products_html += """
            </div>
        </div>
        """
    
    html = f"""
<!DOCTYPE html>
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
        </div>
    </div>
</body>
</html>
    """
    
    return html


def main():
    results_dir = './batch_user_results'
    output_dir = './batch_user_results/html_pages'
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all result JSON files
    result_files = list(Path(results_dir).glob('*_results.json'))
    
    if not result_files:
        print("❌ No result files found in ./batch_user_results/")
        print("Run process_and_send_results.py first to generate results.")
        return
    
    print(f"📄 Found {len(result_files)} result files")
    print(f"Generating HTML pages...\n")
    
    for result_file in result_files:
        phone = result_file.stem.replace('_results', '')
        
        with open(result_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        
        html = generate_html_page(phone, results)
        
        output_file = os.path.join(output_dir, f"{phone}.html")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"✅ Generated: {output_file}")
    
    print(f"\n{'='*60}")
    print(f"✅ Generated {len(result_files)} HTML pages")
    print(f"📁 Location: {output_dir}")
    print(f"\nYou can:")
    print(f"1. Host these files on a web server")
    print(f"2. Share the URLs via SMS/KakaoTalk")
    print(f"3. Open locally: open {output_dir}/[phone].html")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()

