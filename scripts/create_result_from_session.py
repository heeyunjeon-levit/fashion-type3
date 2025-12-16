#!/usr/bin/env python3
"""
Create result page from existing Supabase session
For user: 01024450277 (cap image)
"""
import os
import sys
from pathlib import Path
from supabase import create_client, Client
import json

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))
from phone_hasher import hash_phone
from html_generator_mobile import generate_html_page

# Configuration
PHONE = '01024450277'
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print('❌ Error: Supabase credentials not found in environment')
    print('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    sys.exit(1)

print(f'\n{"="*80}')
print(f'Creating Result Page for User: {PHONE}')
print(f'{"="*80}\n')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch most recent session for this user
print(f'📊 Fetching session from Supabase...')
try:
    response = supabase.table('sessions').select('*').eq('phone_number', PHONE).order('created_at', desc=True).limit(1).execute()
    
    if not response.data:
        print(f'❌ No session found for phone: {PHONE}')
        print(f'   User needs to upload an image first at: https://fashionsource.vercel.app')
        sys.exit(1)
    
    session = response.data[0]
    print(f'✅ Found session: {session["session_id"]}')
    print(f'   Created: {session["created_at"]}')
    print(f'   Image: {session.get("uploaded_image_url", "N/A")}')
    
except Exception as e:
    print(f'❌ Error fetching session: {e}')
    sys.exit(1)

# Parse session data
print(f'\n📦 Processing session data...')
items = []
search_results = {}

# Get items from gpt_analysis
if session.get('gpt_analysis') and 'items' in session['gpt_analysis']:
    gpt_items = session['gpt_analysis']['items']
    print(f'   GPT detected: {len(gpt_items)} items')
    
    # Get cropped images
    cropped_imgs = session.get('cropped_images', [])
    if isinstance(cropped_imgs, str):
        try:
            cropped_imgs = json.loads(cropped_imgs)
        except:
            cropped_imgs = []
    
    # Match items with cropped images
    for idx, item in enumerate(gpt_items):
        # Find matching cropped image
        cropped_url = None
        if cropped_imgs and idx < len(cropped_imgs):
            cropped_url = cropped_imgs[idx].get('url') if isinstance(cropped_imgs[idx], dict) else None
        
        items.append({
            'category': 'accessory',  # The cap is categorized as accessory
            'groundingdino_prompt': item.get('groundingdino_prompt', ''),
            'description': item.get('description', ''),
            'croppedImageUrl': cropped_url or f'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/accessories_item1_gray_cap_1763560721507.jpg'
        })

# Get search results
if session.get('search_results'):
    search_results = session['search_results']
    if isinstance(search_results, str):
        try:
            search_results = json.loads(search_results)
        except:
            search_results = {}

print(f'   Items to display: {len(items)}')

# Create result data
result_data = {
    'phone': PHONE,
    'original_url': session.get('uploaded_image_url', ''),
    'items': items,
    'search_results': search_results,
    'status': 'success'
}

# Generate secure hash
hashed_id = hash_phone(PHONE)
print(f'\n🔒 Secure Hash: {hashed_id}')

# Generate HTML
print(f'🎨 Generating HTML page...')
try:
    html_content = generate_html_page(PHONE, result_data)
    
    # Save to public/results
    public_dir = Path('./public/results')
    public_dir.mkdir(parents=True, exist_ok=True)
    html_file = public_dir / f'{hashed_id}.html'
    
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f'✅ Saved: {html_file}')
    
except Exception as e:
    print(f'❌ Error generating HTML: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Print results
print(f'\n{"="*80}')
print(f'✅ SUCCESS! Result page created! 🎉')
print(f'{"="*80}\n')
print(f'📱 Phone: {PHONE}')
print(f'🔒 Secure Hash: {hashed_id}')
print(f'📊 Items: {len(items)} detected')
print(f'\n🔗 Result Link:')
print(f'   https://fashionsource.vercel.app/results/{hashed_id}.html')
print(f'\n💬 SMS Message:')
print(f'   안녕하세요! 요청하신 이미지 분석 결과입니다: https://fashionsource.vercel.app/results/{hashed_id}.html')
print(f'\n📂 File Location:')
print(f'   {html_file}')
print(f'\n💡 Next Step:')
print(f'   Deploy to Vercel: cd /Users/levit/Desktop/mvp && vercel --prod')
print()







