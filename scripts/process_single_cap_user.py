#!/usr/bin/env python3
"""
Process single user with cap image
Phone: 01024450277
"""
import requests
import json
import time
from pathlib import Path
from datetime import datetime
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))
from phone_hasher import hash_phone
from html_generator_mobile import generate_html_page

# Configuration
PHONE = '01024450277'
# Using a test cap image (or the user can upload their own)
IMAGE_URL = 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80'  
FRONTEND_URL = 'https://fashionsource.vercel.app'  # Your deployed frontend
OUTPUT_DIR = Path('./single_user_results')
OUTPUT_DIR.mkdir(exist_ok=True)

print(f'\n⚠️  NOTE: Using test image. To use a different image:')
print(f'   1. Upload your image at {FRONTEND_URL}')
print(f'   2. Check the session in Supabase for the result link')
print(f'   OR provide a direct image URL\n')

print(f'\n{"="*80}')
print(f'Processing User: {PHONE}')
print(f'Image: Salomon Cap')
print(f'{"="*80}\n')

# Step 1: Upload image to frontend
print('📤 Step 1: Uploading image to frontend...')
try:
    # Download image first
    img_response = requests.get(IMAGE_URL, timeout=30, headers={
        'User-Agent': 'Mozilla/5.0'
    })
    img_response.raise_for_status()
    
    # Upload to frontend
    files = {'file': ('cap.jpg', img_response.content, 'image/jpeg')}
    upload_response = requests.post(
        f'{FRONTEND_URL}/api/upload',
        files=files,
        timeout=60
    )
    upload_response.raise_for_status()
    
    upload_data = upload_response.json()
    uploaded_url = upload_data['url']
    print(f'✅ Uploaded: {uploaded_url}\n')
    
except Exception as e:
    print(f'❌ Upload failed: {e}')
    sys.exit(1)

# Step 2: Analyze and crop items
print('✂️  Step 2: Analyzing and cropping items...')
try:
    analyze_response = requests.post(
        f'{FRONTEND_URL}/api/analyze',
        json={'imageUrl': uploaded_url},
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
    sys.exit(1)

# Step 3: Search for products
print('🔍 Step 3: Searching for products...')
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
            'originalImageUrl': uploaded_url
        },
        timeout=180
    )
    search_response.raise_for_status()
    
    search_data = search_response.json()
    total_links = sum(len(links) for links in search_data.get('results', {}).values())
    
    print(f'✅ Found {total_links} shopping links\n')
    
except Exception as e:
    print(f'❌ Search failed: {e}')
    sys.exit(1)

# Step 4: Save results and generate HTML
print('📄 Step 4: Generating result page...')
try:
    result_data = {
        'phone': PHONE,
        'original_url': uploaded_url,
        'items': items,
        'search_results': search_data,
        'status': 'success'
    }
    
    # Save JSON
    json_file = OUTPUT_DIR / f'{PHONE}_result.json'
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(result_data, f, indent=2, ensure_ascii=False)
    print(f'✅ Saved JSON: {json_file}')
    
    # Generate HTML with hashed filename
    hashed_id = hash_phone(PHONE)
    html_content = generate_html_page(PHONE, result_data)
    
    # Save to public/results with hashed name
    public_dir = Path('./public/results')
    public_dir.mkdir(parents=True, exist_ok=True)
    html_file = public_dir / f'{hashed_id}.html'
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f'✅ Saved HTML: {html_file}')
    
    # Also save backup with phone number
    backup_html = OUTPUT_DIR / f'{PHONE}_result.html'
    with open(backup_html, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f'✅ Backup HTML: {backup_html}')
    
except Exception as e:
    print(f'❌ HTML generation failed: {e}')
    sys.exit(1)

# Print final results
print(f'\n{"="*80}')
print(f'✅ SUCCESS! 🎉')
print(f'{"="*80}\n')
print(f'Phone: {PHONE}')
print(f'Secure ID: {hashed_id}')
print(f'Items detected: {len(items)}')
print(f'Shopping links: {total_links}')
print()
print(f'🔗 Result Link:')
print(f'   {FRONTEND_URL}/results/{hashed_id}.html')
print()
print(f'📱 SMS Message:')
print(f'   안녕하세요! 요청하신 이미지 분석 결과입니다: {FRONTEND_URL}/results/{hashed_id}.html')
print()
print(f'📊 Files created:')
print(f'   - {json_file}')
print(f'   - {html_file}')
print(f'   - {backup_html}')
print()
print(f'💡 To deploy to Vercel:')
print(f'   cd /Users/levit/Desktop/mvp && vercel --prod')
print()

