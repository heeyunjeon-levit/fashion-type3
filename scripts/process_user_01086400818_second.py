#!/usr/bin/env python3
"""
Process second image for user 01086400818
Image: TikTok screenshot with fashion items
"""
import requests
import json
import time
from pathlib import Path
from datetime import datetime
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))
from phone_hasher import hash_phone
from html_generator_mobile import generate_html_page

# Configuration
PHONE = '01086400818'
# Image URL from user
IMAGE_URL = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1763615577375_Screenshot_20251107_023643_TikTok-Lite.jpg'
FRONTEND_URL = 'https://fashionsource.vercel.app'
OUTPUT_DIR = Path('./single_user_results')
OUTPUT_DIR.mkdir(exist_ok=True)

print(f'\n{"="*80}')
print(f'Processing Second Image for User: {PHONE}')
print(f'Image: TikTok Screenshot')
print(f'{"="*80}\n')

# Step 1: Analyze and crop items from the already-uploaded image
print('✂️  Step 1: Analyzing and cropping items from uploaded image...')
try:
    analyze_response = requests.post(
        f'{FRONTEND_URL}/api/analyze',
        json={'imageUrl': IMAGE_URL},
        timeout=120
    )
    analyze_response.raise_for_status()
    
    analyze_data = analyze_response.json()
    items = analyze_data.get('items', [])
    
    print(f'✅ Detected {len(items)} items:')
    for item in items:
        print(f'   - {item.get("category")}: {item.get("groundingdino_prompt")}')
    print()
    
except Exception as e:
    print(f'❌ Analysis failed: {e}')
    print(f'   Error details: {str(e)}')
    sys.exit(1)

# Step 2: Search for products
print('🔍 Step 2: Searching for products...')
try:
    # Prepare search request
    categories = []
    cropped_images = {}
    
    for idx, item in enumerate(items):
        category = item.get('category', 'unknown')
        key = f"{category}_{idx + 1}"
        categories.append(category)
        cropped_images[key] = item.get('croppedImageUrl', '')
    
    search_response = requests.post(
        f'{FRONTEND_URL}/api/search',
        json={
            'categories': categories,
            'croppedImages': cropped_images,
            'originalImageUrl': IMAGE_URL
        },
        timeout=180
    )
    search_response.raise_for_status()
    
    search_data = search_response.json()
    total_links = sum(len(links) for links in search_data.get('results', {}).values())
    
    print(f'✅ Found {total_links} shopping links\n')
    
except Exception as e:
    print(f'❌ Search failed: {e}')
    print(f'   Error details: {str(e)}')
    sys.exit(1)

# Step 3: Save results and generate HTML
print('📄 Step 3: Generating result page...')
try:
    result_data = {
        'phone': PHONE,
        'original_url': IMAGE_URL,
        'items': items,
        'search_results': search_data,
        'status': 'success'
    }
    
    # Save JSON
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    json_file = OUTPUT_DIR / f'{PHONE}_second_result_{timestamp}.json'
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(result_data, f, indent=2, ensure_ascii=False)
    print(f'✅ Saved JSON: {json_file}')
    
    # Generate HTML with hashed filename
    # For second result, we'll append _2 to differentiate
    hashed_id = hash_phone(PHONE) + '_2'
    html_content = generate_html_page(PHONE, result_data)
    
    # Save to public/results with hashed name
    public_dir = Path('./public/results')
    public_dir.mkdir(parents=True, exist_ok=True)
    html_file = public_dir / f'{hashed_id}.html'
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f'✅ Saved HTML: {html_file}')
    
    # Also save backup with phone number
    backup_html = OUTPUT_DIR / f'{PHONE}_second_result_{timestamp}.html'
    with open(backup_html, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f'✅ Backup HTML: {backup_html}')
    
except Exception as e:
    print(f'❌ HTML generation failed: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Print final results
print(f'\n{"="*80}')
print(f'✅ SUCCESS! Second Result Created 🎉')
print(f'{"="*80}\n')
print(f'📱 Phone: {PHONE}')
print(f'🔒 Secure ID: {hashed_id}')
print(f'📊 Items detected: {len(items)}')
print(f'🔗 Shopping links: {total_links}')
print()
print(f'🌐 Result Link:')
print(f'   {FRONTEND_URL}/results/{hashed_id}.html')
print()
print(f'💬 SMS Message (Korean):')
print(f'   안녕하세요! 두 번째 이미지 분석 결과입니다: {FRONTEND_URL}/results/{hashed_id}.html')
print()
print(f'📊 Files created:')
print(f'   - {json_file}')
print(f'   - {html_file}')
print(f'   - {backup_html}')
print()
print(f'💡 To deploy to Vercel:')
print(f'   cd /Users/levit/Desktop/mvp && vercel --prod')
print()






