#!/usr/bin/env python3
"""
Process Batch 4 users from file+phonenumber4.xlsx (89 users)
"""
import pandas as pd
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
EXCEL_FILE = '/Users/levit/Desktop/file+phonenumber4.xlsx'
FRONTEND_URL = 'http://localhost:3000'
BATCH_NAME = 'batch4'
OUTPUT_DIR = Path('./batch4_results')
OUTPUT_DIR.mkdir(exist_ok=True)

def clean_phone(phone_str):
    """Clean phone number - remove 82 country code prefix and convert to format"""
    phone = str(int(float(phone_str)))  # Convert from float to string, remove decimals
    
    # Remove country code 82 if present at start
    if phone.startswith('82'):
        phone = phone[2:]  # Remove '82' prefix
    
    return phone

def upload_to_frontend(image_url: str):
    """Download image from Typeform URL and upload to frontend"""
    try:
        print(f'  📥 Downloading image from Typeform...')
        
        # Download the image
        img_response = requests.get(image_url, timeout=30)
        img_response.raise_for_status()
        
        # Get filename from URL or use default
        filename = image_url.split('/')[-1] or 'image.jpg'
        
        # Upload to frontend
        files = {'file': (filename, img_response.content, 'image/jpeg')}
        upload_response = requests.post(
            f'{FRONTEND_URL}/api/upload',
            files=files,
            timeout=60
        )
        upload_response.raise_for_status()
        
        data = upload_response.json()
        uploaded_url = data.get('imageUrl')
        
        if not uploaded_url:
            raise Exception('No imageUrl in upload response')
        
        print(f'  ✅ Uploaded: {uploaded_url}')
        return uploaded_url
        
    except Exception as e:
        print(f'  ❌ Upload failed: {e}')
        raise

def analyze_and_crop(image_url: str):
    """Call analyze API to detect items and crop them"""
    try:
        print(f'  🤖 Analyzing and cropping...')
        
        response = requests.post(
            f'{FRONTEND_URL}/api/analyze',
            json={'imageUrl': image_url},
            timeout=180
        )
        response.raise_for_status()
        
        data = response.json()
        items = data.get('items', [])
        
        print(f'  ✅ Found {len(items)} items')
        for item in items:
            print(f'     - {item.get("category")}: {item.get("groundingdino_prompt")}')
        
        return items
        
    except Exception as e:
        print(f'  ❌ Analysis failed: {e}')
        raise

def search_products(items: list, original_image_url: str):
    """Search for products using cropped images"""
    try:
        if not items:
            print(f'  ⚠️  No items to search')
            return {'results': {}}
        
        print(f'  🔍 Searching for {len(items)} items...')
        
        # Build request
        categories = []
        cropped_images = {}
        
        for idx, item in enumerate(items):
            category = item.get('category', 'unknown')
            key = f"{category}_{idx + 1}"
            categories.append(category)
            cropped_images[key] = item.get('croppedImageUrl', '')
        
        response = requests.post(
            f'{FRONTEND_URL}/api/search',
            json={
                'categories': categories,
                'croppedImages': cropped_images,
                'originalImageUrl': original_image_url
            },
            timeout=180
        )
        response.raise_for_status()
        
        data = response.json()
        results = data.get('results', {})
        
        # Count total links
        total_links = sum(len(links) for links in results.values())
        print(f'  ✅ Found {total_links} shopping links')
        
        return data
        
    except Exception as e:
        print(f'  ❌ Search failed: {e}')
        raise

def process_user(phone: str, image_url: str):
    """Process a single user"""
    try:
        print(f'\n{"="*80}')
        print(f'Processing: {phone}')
        print(f'{"="*80}')
        
        # Step 1: Upload image
        uploaded_url = upload_to_frontend(image_url)
        
        # Step 2: Analyze and crop
        items = analyze_and_crop(uploaded_url)
        
        # Step 3: Search products
        search_data = search_products(items, uploaded_url)
        
        # Step 4: Save results
        result_data = {
            'phone': phone,
            'original_url': uploaded_url,
            'items': items,
            'search_results': search_data,
            'status': 'success'
        }
        
        # Save JSON
        json_file = OUTPUT_DIR / f'{phone}_result.json'
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False)
        
        # Step 5: Generate HTML with hashed filename
        hashed_id = hash_phone(phone)
        html_content = generate_html_page(phone, result_data)
        
        # Save to public/results with hashed name
        public_dir = Path('./public/results')
        public_dir.mkdir(parents=True, exist_ok=True)
        html_file = public_dir / f'{hashed_id}.html'
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Count results
        items_detected = len(items)
        total_links = sum(len(links) for links in search_data.get('results', {}).values())
        
        print(f'\n✅ SUCCESS')
        print(f'   Items detected: {items_detected}')
        print(f'   Shopping links: {total_links}')
        print(f'   Secure ID: {hashed_id}')
        print(f'   Link: https://fashionsource.vercel.app/results/{hashed_id}.html')
        
        return {
            'phone': phone,
            'status': 'success',
            'items_detected': items_detected,
            'total_links': total_links,
            'hashed_id': hashed_id,
            'link': f'https://fashionsource.vercel.app/results/{hashed_id}.html'
        }
        
    except Exception as e:
        print(f'\n❌ FAILED - {phone}: {e}')
        return {
            'phone': phone,
            'status': 'failed',
            'error': str(e)
        }

def main():
    """Main processing function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Process Batch 4 users')
    parser.add_argument('--count', type=int, default=None, help='Number of users to process (default: all)')
    parser.add_argument('--test', action='store_true', help='Test mode: process only first 10 users')
    args = parser.parse_args()
    
    print('\n' + '='*80)
    print('BATCH 4 PROCESSING - 89 USERS')
    print('='*80 + '\n')
    
    # Load users
    df = pd.read_excel(EXCEL_FILE)
    
    # Get column names (Korean headers)
    image_col = df.columns[0]  # Image URL column
    phone_col = df.columns[1]  # Phone number column
    
    print(f'📊 Total rows in file: {len(df)}')
    
    # Filter for valid entries only
    valid_mask = df[image_col].notna() & df[phone_col].notna()
    df = df[valid_mask].copy()
    
    print(f'📊 Valid entries (with both image and phone): {len(df)}')
    
    # Clean phone numbers
    df['cleaned_phone'] = df[phone_col].apply(clean_phone)
    
    print(f'\nSample phone numbers:')
    for i in range(min(3, len(df))):
        original = df.iloc[i][phone_col]
        cleaned = df.iloc[i]['cleaned_phone']
        print(f'  {original} → {cleaned}')
    
    # Determine how many to process
    if args.test:
        users_to_process = min(10, len(df))
        print(f'\n🧪 TEST MODE: Processing first {users_to_process} users')
    elif args.count:
        users_to_process = min(args.count, len(df))
        print(f'\n📊 Processing {users_to_process} users (--count {args.count})')
    else:
        users_to_process = len(df)
        print(f'\n🚀 Processing ALL {users_to_process} users')
    
    # Limit to available users
    df = df.head(users_to_process)
    
    print(f'\n🚀 Processing {users_to_process} users...\n')
    
    results = []
    successful = 0
    failed = 0
    
    for idx, row in df.iterrows():
        phone = row['cleaned_phone']
        image_url = row[image_col]
        
        result = process_user(phone, image_url)
        results.append(result)
        
        if result['status'] == 'success':
            successful += 1
        else:
            failed += 1
        
        # Small delay between users
        time.sleep(2)
    
    # Save summary
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    summary = {
        'batch': BATCH_NAME,
        'timestamp': timestamp,
        'total_processed': len(results),
        'successful': successful,
        'failed': failed,
        'results': results
    }
    
    summary_file = OUTPUT_DIR / f'batch4_summary_{timestamp}.json'
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    # Generate CSV for SMS sending
    csv_data = []
    for result in results:
        if result['status'] == 'success':
            phone = result['phone']
            link = result['link']
            sms_message = f'안녕하세요! 요청하신 이미지 분석 결과입니다: {link}'
            csv_data.append({
                'Phone': phone,
                'Link': link,
                'SMS_Message': sms_message,
                'Batch': BATCH_NAME,
                'Links': result['total_links']
            })
    
    csv_file = OUTPUT_DIR / f'batch4_sms_list_{timestamp}.csv'
    csv_df = pd.DataFrame(csv_data)
    csv_df.to_csv(csv_file, index=False, encoding='utf-8-sig')
    
    # Print summary
    print('\n' + '='*80)
    print('BATCH 4 SUMMARY')
    print('='*80)
    print(f'✅ Successful: {successful}')
    print(f'❌ Failed: {failed}')
    print(f'📊 Total: {len(results)}')
    print(f'\n📁 Summary saved: {summary_file}')
    print(f'📁 CSV for SMS: {csv_file}')
    print('='*80 + '\n')
    
    # Show failed users
    if failed > 0:
        print('\n⚠️  Failed users:')
        for result in results:
            if result['status'] == 'failed':
                print(f'   - {result["phone"]}: {result["error"]}')
    
    print('\n✅ Batch 4 processing complete!')
    print(f'Next step: Send SMS messages using {csv_file}')

if __name__ == '__main__':
    main()

