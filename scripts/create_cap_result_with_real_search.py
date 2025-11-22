#!/usr/bin/env python3
"""
Create cap result with REAL search results from the API
"""
import requests
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))
from phone_hasher import hash_phone
from html_generator_mobile import generate_html_page

# Configuration
PHONE = '01024450277'
FRONTEND_URL = 'https://fashionsource.vercel.app'
CROPPED_CAP = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/accessories_item1_gray_cap_1763560721507.jpg'
ORIGINAL_IMAGE = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1763560704665_upload_1763536760558_Screenshot_20251119_161905_NAVER.jpg'

print(f'\n{"="*80}')
print(f'Creating Result with REAL Search API')
print(f'{"="*80}\n')

# Step 1: Call REAL search API
print('🔍 Searching for real products via API...')
try:
    search_response = requests.post(
        f'{FRONTEND_URL}/api/search',
        json={
            'categories': ['accessory'],
            'croppedImages': {
                'accessory_1': CROPPED_CAP
            },
            'originalImageUrl': ORIGINAL_IMAGE
        },
        timeout=60
    )
    search_response.raise_for_status()
    search_data = search_response.json()
    
    print(f'✅ Search complete!')
    results = search_data.get('results', {})
    total_links = sum(len(links) for links in results.values())
    print(f'   Found {total_links} product links\n')
    
except Exception as e:
    print(f'❌ Search failed: {e}')
    print('   Using fallback links...\n')
    # Fallback to empty results
    search_data = {'results': {}}

# Step 2: Create result data
result_data = {
    'phone': PHONE,
    'original_url': ORIGINAL_IMAGE,
    'items': [
        {
            'category': 'accessory',
            'groundingdino_prompt': 'gray cap',
            'description': 'Gray baseball cap with Salomon branding',
            'croppedImageUrl': CROPPED_CAP
        }
    ],
    'search_results': search_data,
    'status': 'success'
}

# Step 3: Generate HTML
hashed_id = hash_phone(PHONE)
print(f'🎨 Generating HTML...')

try:
    html_content = generate_html_page(PHONE, result_data)
    
    # Save to public/results
    public_dir = Path('./public/results')
    public_dir.mkdir(parents=True, exist_ok=True)
    html_file = public_dir / f'{hashed_id}.html'
    
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f'✅ Saved: {html_file}\n')
    
except Exception as e:
    print(f'❌ HTML generation failed: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Print results
print(f'{"="*80}')
print(f'✅ SUCCESS! 🎉')
print(f'{"="*80}\n')
print(f'📱 Phone: {PHONE}')
print(f'🔒 Secure Hash: {hashed_id}')
print(f'🛒 Shopping Links: {total_links}')
print(f'\n🔗 Result Link:')
print(f'   {FRONTEND_URL}/results/{hashed_id}.html')
print(f'\n💬 SMS Message:')
print(f'   안녕하세요! 요청하신 이미지 분석 결과입니다: {FRONTEND_URL}/results/{hashed_id}.html')
print(f'\n💡 Deploy: vercel --prod')
print()



