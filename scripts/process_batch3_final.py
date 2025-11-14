#!/usr/bin/env python3
"""
Process Batch 3 Final - 58 users
Uses deployed API at fashionsource.vercel.app
"""
import pandas as pd
import requests
import json
import time
from pathlib import Path
from datetime import datetime
import sys
sys.path.insert(0, str(Path(__file__).parent))
from phone_hasher import hash_phone
from html_generator_mobile import generate_html_page

# Configuration
EXCEL_FILE = '/Users/levit/Desktop/final_file+phonenumber3.xlsx'
API_BASE = 'https://fashionsource.vercel.app'
OUTPUT_DIR = Path('./batch3_results')
OUTPUT_DIR.mkdir(exist_ok=True)

print('\n' + '='*80)
print('BATCH 3 FINAL - PROCESSING 58 USERS')
print('='*80)
print(f'API: {API_BASE}')
print('='*80 + '\n')

# Load users
df = pd.read_excel(EXCEL_FILE)
print(f'📊 Total users: {len(df)}\n')

def process_user(phone, image_url):
    """Process a single user"""
    try:
        print(f'\n{"="*80}')
        print(f'User {phone}')
        print(f'{"="*80}')
        
        # Step 1: Upload image
        print(f'  📥 Downloading image...')
        img_response = requests.get(image_url, timeout=30)
        img_response.raise_for_status()
        
        filename = image_url.split('/')[-1] or 'image.jpg'
        print(f'  📤 Uploading to API...')
        
        files = {'file': (filename, img_response.content, 'image/jpeg')}
        upload_response = requests.post(
            f'{API_BASE}/api/upload',
            files=files,
            timeout=60
        )
        upload_response.raise_for_status()
        uploaded_url = upload_response.json().get('imageUrl')
        
        if not uploaded_url:
            raise Exception('No imageUrl in response')
        
        print(f'  ✅ Uploaded')
        
        # Step 2: Analyze and crop
        print(f'  🤖 Analyzing with AI...')
        analyze_response = requests.post(
            f'{API_BASE}/api/analyze',
            json={'imageUrl': uploaded_url},
            timeout=300  # 5 minutes for cold starts
        )
        analyze_response.raise_for_status()
        analyze_data = analyze_response.json()
        items = analyze_data.get('items', [])
        
        print(f'  ✅ Found {len(items)} items')
        for item in items:
            print(f'     - {item.get("category")}: {item.get("groundingdino_prompt")}')
        
        # Step 3: Search products
        search_data = {'results': {}}
        total_links = 0
        
        if items:
            print(f'  🔍 Searching products...')
            categories = []
            cropped_images = {}
            
            for idx, item in enumerate(items):
                category = item.get('category', 'unknown')
                key = f"{category}_{idx + 1}"
                categories.append(category)
                cropped_images[key] = item.get('croppedImageUrl', '')
            
            search_response = requests.post(
                f'{API_BASE}/api/search',
                json={
                    'categories': categories,
                    'croppedImages': cropped_images,
                    'originalImageUrl': uploaded_url
                },
                timeout=300
            )
            search_response.raise_for_status()
            search_data = search_response.json()
            
            total_links = sum(len(links) for links in search_data.get('results', {}).values())
            print(f'  ✅ Found {total_links} shopping links')
        
        # Step 4: Save results
        result_data = {
            'status': 'success',
            'phone': phone,
            'original_url': uploaded_url,
            'items': items,
            'search_results': search_data
        }
        
        # Save JSON
        json_file = OUTPUT_DIR / f'{phone}_result.json'
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False)
        
        # Step 5: Generate HTML with hashed filename
        hashed_id = hash_phone(phone)
        html_content = generate_html_page(phone, result_data)
        
        # Save to public/results
        public_dir = Path('./public/results')
        public_dir.mkdir(parents=True, exist_ok=True)
        html_file = public_dir / f'{hashed_id}.html'
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Also save to batch3_results for backup
        backup_html = OUTPUT_DIR / f'{phone}_result.html'
        with open(backup_html, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        url = f'https://fashionsource.vercel.app/results/{hashed_id}.html'
        
        print(f'\n  ✅ SUCCESS')
        print(f'     Items: {len(items)}')
        print(f'     Links: {total_links}')
        print(f'     ID: {hashed_id}')
        print(f'     URL: {url}')
        
        return {
            'phone': phone,
            'status': 'success',
            'items_detected': len(items),
            'total_links': total_links,
            'hashed_id': hashed_id,
            'url': url
        }
        
    except Exception as e:
        print(f'\n  ❌ FAILED: {str(e)}')
        return {
            'phone': phone,
            'status': 'failed',
            'error': str(e)
        }

# Process all users
results = []
successful = 0
failed = 0

for idx, row in df.iterrows():
    phone = str(int(row['phone number']))
    image_url = row['file']
    
    print(f'\nProgress: {idx + 1}/{len(df)}')
    result = process_user(phone, image_url)
    results.append(result)
    
    if result['status'] == 'success':
        successful += 1
    else:
        failed += 1
    
    # Small delay between requests
    time.sleep(2)

# Save summary
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
summary = {
    'batch': 'batch3_final',
    'timestamp': timestamp,
    'total_processed': len(results),
    'successful': successful,
    'failed': failed,
    'results': results
}

summary_file = OUTPUT_DIR / f'batch3_final_summary_{timestamp}.json'
with open(summary_file, 'w', encoding='utf-8') as f:
    json.dump(summary, f, indent=2, ensure_ascii=False)

# Print final summary
print('\n' + '='*80)
print('BATCH 3 FINAL - COMPLETE')
print('='*80)
print(f'✅ Successful: {successful}')
print(f'❌ Failed: {failed}')
print(f'📊 Total: {len(results)}')
print(f'\n📁 Summary: {summary_file}')
print('='*80 + '\n')

# Show failed users if any
if failed > 0:
    print('\n⚠️  Failed users:')
    for result in results:
        if result['status'] == 'failed':
            print(f'   - {result["phone"]}: {result["error"]}')
    print()

# Show successful links
if successful > 0:
    print(f'\n✅ {successful} successful links ready!')
    print('Sample links:')
    count = 0
    for result in results:
        if result['status'] == 'success' and count < 5:
            print(f'   - {result["phone"]}: {result["url"]}')
            count += 1
    print()

print('🎉 Batch 3 processing complete!')
print('📤 Ready to deploy HTML files and send links to users\n')

