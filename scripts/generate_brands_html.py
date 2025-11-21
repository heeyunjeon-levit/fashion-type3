#!/usr/bin/env python3
"""
Generate HTML report for brand batch processing results
"""

import json
import os
from datetime import datetime

# Paths
RESULTS_FILE = "/Users/levit/Desktop/mvp/brands_results/brands_batch_20251121_084948.json"
RETRY_FILE = "/Users/levit/Desktop/mvp/brands_results/brands_retry_20251121_090022.json"
OUTPUT_FILE = "/Users/levit/Desktop/mvp/brands_results/brands_report.html"

def load_results():
    """Load both batch and retry results"""
    with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
        batch_data = json.load(f)
    
    with open(RETRY_FILE, 'r', encoding='utf-8') as f:
        retry_data = json.load(f)
    
    # Combine successful results
    all_results = []
    
    # Add batch results
    for result in batch_data['results']:
        if result.get('success'):
            all_results.append(result)
    
    # Add retry results
    for result in retry_data['results']:
        if result.get('success'):
            all_results.append(result)
    
    return all_results, batch_data, retry_data

def generate_html():
    """Generate comprehensive HTML report"""
    
    all_results, batch_data, retry_data = load_results()
    
    total_images = batch_data['total_images']
    successful = len(all_results)
    
    # Count total items and products
    total_items = 0
    total_products = 0
    category_counts = {}
    
    for result in all_results:
        items = result.get('analysis', {}).get('items', [])
        total_items += len(items)
        
        search_results = result.get('search', {}).get('results', {})
        for category, products in search_results.items():
            total_products += len(products)
            cat_name = category.split('_')[0]
            category_counts[cat_name] = category_counts.get(cat_name, 0) + 1
    
    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Brand Images Processing Results</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        .header {{
            background: white;
            border-radius: 20px;
            padding: 40px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }}
        
        .header h1 {{
            font-size: 2.5em;
            color: #2d3748;
            margin-bottom: 20px;
        }}
        
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }}
        
        .stat-card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
        }}
        
        .stat-number {{
            font-size: 3em;
            font-weight: bold;
            margin-bottom: 5px;
        }}
        
        .stat-label {{
            font-size: 0.9em;
            opacity: 0.9;
        }}
        
        .category-breakdown {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 20px;
        }}
        
        .category-badge {{
            background: #e2e8f0;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            color: #4a5568;
        }}
        
        .results-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 25px;
        }}
        
        .result-card {{
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }}
        
        .result-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 15px 50px rgba(0,0,0,0.15);
        }}
        
        .image-container {{
            position: relative;
            width: 100%;
            height: 300px;
            overflow: hidden;
            background: #f7fafc;
        }}
        
        .image-container img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
        }}
        
        .image-number {{
            position: absolute;
            top: 15px;
            left: 15px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9em;
        }}
        
        .content {{
            padding: 25px;
        }}
        
        .filename {{
            font-size: 0.8em;
            color: #718096;
            margin-bottom: 15px;
            word-break: break-all;
        }}
        
        .items-section {{
            margin-bottom: 20px;
        }}
        
        .section-title {{
            font-size: 1.1em;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        
        .item {{
            background: #f7fafc;
            padding: 15px;
            border-radius: 12px;
            margin-bottom: 10px;
            border-left: 4px solid #667eea;
        }}
        
        .item-category {{
            font-weight: bold;
            color: #667eea;
            text-transform: capitalize;
            margin-bottom: 5px;
        }}
        
        .item-description {{
            color: #4a5568;
            font-size: 0.9em;
            line-height: 1.5;
        }}
        
        .products-section {{
            margin-top: 20px;
        }}
        
        .products-grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }}
        
        .product-card {{
            background: #fff;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            overflow: hidden;
            transition: all 0.3s ease;
            cursor: pointer;
        }}
        
        .product-card:hover {{
            border-color: #667eea;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
        }}
        
        .product-image {{
            width: 100%;
            height: 120px;
            background: #f7fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }}
        
        .product-image img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
        }}
        
        .product-image.no-image {{
            color: #cbd5e0;
            font-size: 2em;
        }}
        
        .product-title {{
            padding: 10px;
            font-size: 0.75em;
            color: #4a5568;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }}
        
        .no-products {{
            text-align: center;
            padding: 20px;
            color: #a0aec0;
            font-style: italic;
        }}
        
        .processing-time {{
            display: inline-block;
            background: #48bb78;
            color: white;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            margin-top: 10px;
        }}
        
        .footer {{
            background: white;
            border-radius: 20px;
            padding: 30px;
            margin-top: 30px;
            text-align: center;
            color: #718096;
        }}
        
        @media (max-width: 768px) {{
            .results-grid {{
                grid-template-columns: 1fr;
            }}
            
            .products-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Brand Images Processing Results</h1>
            <p style="color: #718096; font-size: 1.1em; margin-top: 10px;">
                Processed {total_images} images through AI fashion detection pipeline
            </p>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">{successful}</div>
                    <div class="stat-label">Successful Images</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{total_items}</div>
                    <div class="stat-label">Fashion Items Detected</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{total_products}</div>
                    <div class="stat-label">Product Links Found</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{(successful/total_images*100):.1f}%</div>
                    <div class="stat-label">Success Rate</div>
                </div>
            </div>
            
            <div class="category-breakdown">
                <span style="color: #2d3748; font-weight: bold;">Categories detected:</span>
"""
    
    for category, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
        html += f'                <span class="category-badge">{category.title()}: {count}</span>\n'
    
    html += """            </div>
        </div>
        
        <div class="results-grid">
"""
    
    # Add each result
    for idx, result in enumerate(all_results, 1):
        image_name = result.get('image_name', 'Unknown')
        image_url = result.get('image_url', '')
        processing_time = result.get('processing_time_seconds', 0)
        
        items = result.get('analysis', {}).get('items', [])
        search_results = result.get('search', {}).get('results', {})
        
        html += f"""
            <div class="result-card">
                <div class="image-container">
                    <img src="{image_url}" alt="{image_name}">
                    <div class="image-number">#{idx}</div>
                </div>
                <div class="content">
                    <div class="filename">{image_name}</div>
                    
                    <div class="items-section">
                        <div class="section-title">
                            🔍 {len(items)} Item{"s" if len(items) != 1 else ""} Detected
                        </div>
"""
        
        # Add detected items
        for item in items:
            category = item.get('category', 'unknown')
            description = item.get('description', item.get('groundingdino_prompt', 'No description'))
            
            html += f"""
                        <div class="item">
                            <div class="item-category">{category}</div>
                            <div class="item-description">{description}</div>
                        </div>
"""
        
        html += """
                    </div>
                    
                    <div class="products-section">
                        <div class="section-title">
                            🛍️ Product Matches
                        </div>
"""
        
        # Add products for each category
        if search_results:
            for category_key, products in search_results.items():
                html += f"""
                        <div style="margin-bottom: 20px;">
                            <div style="font-size: 0.9em; color: #667eea; font-weight: bold; margin-bottom: 10px;">
                                {category_key.replace('_', ' ').title()}
                            </div>
                            <div class="products-grid">
"""
                
                for product in products[:3]:  # Max 3 products
                    link = product.get('link', '#')
                    title = product.get('title', 'Product')
                    thumbnail = product.get('thumbnail')
                    
                    html += f"""
                                <a href="{link}" target="_blank" class="product-card">
                                    <div class="product-image{'no-image' if not thumbnail else ''}">
"""
                    
                    if thumbnail:
                        html += f'                                        <img src="{thumbnail}" alt="{title}">\n'
                    else:
                        html += '                                        📦\n'
                    
                    html += f"""
                                    </div>
                                    <div class="product-title">{title if title else 'View Product'}</div>
                                </a>
"""
                
                html += """
                            </div>
                        </div>
"""
        else:
            html += """
                        <div class="no-products">No products found</div>
"""
        
        html += f"""
                    </div>
                    
                    <div class="processing-time">⏱️ {processing_time:.1f}s</div>
                </div>
            </div>
"""
    
    html += f"""
        </div>
        
        <div class="footer">
            <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p style="margin-top: 10px;">AI Fashion Detection Pipeline • GPT-4o + GroundingDINO + Serper + GPT-4 Turbo</p>
        </div>
    </div>
</body>
</html>
"""
    
    # Write HTML file
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"✅ HTML report generated: {OUTPUT_FILE}")
    print(f"📊 Total successful images: {successful}/{total_images}")
    print(f"🎯 Total items detected: {total_items}")
    print(f"🛍️ Total products found: {total_products}")

if __name__ == "__main__":
    generate_html()

