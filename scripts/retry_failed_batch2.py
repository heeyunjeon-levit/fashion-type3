#!/usr/bin/env python3
"""
Retry the 6 failed users from batch 2.
"""
import os
import sys
import json
import time
import requests
import pandas as pd
from pathlib import Path
from datetime import datetime
from html_generator_mobile import generate_html_page

# Configuration
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3001')
EXCEL_FILE = '/Users/levit/Desktop/file+phonenumber2.xlsx'
OUTPUT_DIR = './batch2_results'
PUBLIC_DIR = './public/results'

# Failed users to retry
FAILED_PHONES = [
    '821024362637',
    '821086439904',
    '821032860463',
    '821087175357',
    '821032846157',
    '821095979009'
]

def load_failed_users():
    """Load only the failed users from Excel file."""
    df = pd.read_excel(EXCEL_FILE)
    image_col = '지금 사진첩으로 가셔서 캡쳐해 놓으신 스크린샷을 업로드 부탁드려요.'
    phone_col = '경품을 받아보실 전화번호를 적어주세요. '
    
    users = []
    for _, row in df.iterrows():
        image_url = str(row[image_col]).strip()
        phone = str(row[phone_col]).strip()
        
        # Only include failed users
        if phone in FAILED_PHONES and image_url and image_url != 'nan':
            users.append({
                'phone': phone,
                'image_url': image_url
            })
    
    return users

def download_image(url, save_path):
    """Download image from URL with better error handling."""
    try:
        response = requests.get(url, timeout=30, stream=True)
        response.raise_for_status()
        
        # Check content type
        content_type = response.headers.get('content-type', '')
        if 'image' not in content_type.lower():
            raise ValueError(f"Not an image file. Content-Type: {content_type}")
        
        # Save file
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Verify file size
        file_size = os.path.getsize(save_path)
        if file_size < 1000:  # Less than 1KB is suspicious
            raise ValueError(f"Image file too small: {file_size} bytes")
        
        return True
    except Exception as e:
        raise Exception(f"Download failed: {str(e)}")

def upload_to_frontend(image_path):
    """Upload image to frontend API."""
    with open(image_path, 'rb') as f:
        files = {'file': (os.path.basename(image_path), f, 'image/jpeg')}
        response = requests.post(
            f'{FRONTEND_URL}/api/upload',
            files=files,
            timeout=60
        )
        response.raise_for_status()
        return response.json()['imageUrl']

def analyze_and_crop(image_url):
    """Analyze image and get cropped items."""
    response = requests.post(
        f'{FRONTEND_URL}/api/analyze',
        json={'imageUrl': image_url},
        timeout=120
    )
    response.raise_for_status()
    data = response.json()
    
    cropped_images = {}
    for item in data.get('items', []):
        category = item.get('category', 'unknown')
        cropped_url = item.get('croppedImageUrl', '')
        if cropped_url:
            key = category
            counter = 1
            while key in cropped_images:
                key = f"{category}_{counter}"
                counter += 1
            cropped_images[key] = cropped_url
    
    return cropped_images

def search_items(original_url, cropped_images):
    """Search for products using cropped images."""
    response = requests.post(
        f'{FRONTEND_URL}/api/search',
        json={
            'originalImageUrl': original_url,
            'categories': list(cropped_images.keys()),
            'croppedImages': cropped_images
        },
        timeout=180
    )
    response.raise_for_status()
    return response.json()

def process_user(user, index, total):
    """Process a single user."""
    phone = user['phone']
    image_url = user['image_url']
    
    print(f"\n{'='*60}")
    print(f"Retry {index}/{total}: {phone}")
    print(f"{'='*60}")
    
    try:
        # 1. Download image
        print("📥 Downloading...")
        image_path = f"{OUTPUT_DIR}/{phone}_original.jpg"
        download_image(image_url, image_path)
        print(f"✅ Downloaded ({os.path.getsize(image_path)/1024:.1f} KB)")
        
        # 2. Upload to frontend
        print("📤 Uploading...")
        uploaded_url = upload_to_frontend(image_path)
        print(f"✅ Uploaded")
        
        # 3. Analyze and crop
        print("✂️  Analyzing...")
        cropped_images = analyze_and_crop(uploaded_url)
        print(f"✅ Found {len(cropped_images)} items")
        
        # Skip if no items found
        if not cropped_images:
            print("⚠️  No items detected, skipping search")
            search_results = {'results': {}}
        else:
            # 4. Search
            print("🔍 Searching...")
            search_results = search_items(uploaded_url, cropped_images)
        
        # Count total shopping links
        total_links = 0
        results_dict = search_results.get('results', {})
        if isinstance(results_dict, dict):
            for category, products in results_dict.items():
                if isinstance(products, list):
                    total_links += len(products)
        print(f"✅ Found {total_links} shopping links")
        
        # 5. Save results JSON
        items = []
        for category_key, url in cropped_images.items():
            category = category_key.split('_')[0]
            items.append({
                'category': category,
                'croppedImageUrl': url
            })
        
        result_data = {
            'status': 'success',
            'phone': phone,
            'uploaded_url': uploaded_url,
            'cropped_data': {'items': items},
            'search_results': search_results,
            'timestamp': datetime.now().isoformat()
        }
        
        json_path = f"{OUTPUT_DIR}/{phone}_result.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False)
        
        # 6. Generate HTML
        print("🎨 Generating HTML...")
        html = generate_html_page(phone, result_data)
        
        html_path = f"{OUTPUT_DIR}/{phone}_result.html"
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        # Copy to public directory
        public_path = f"{PUBLIC_DIR}/{phone}.html"
        with open(public_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"✅ SUCCESS - {phone}")
        
        return {
            'phone': phone,
            'status': 'success',
            'links': total_links,
            'html_path': public_path
        }
        
    except Exception as e:
        print(f"❌ FAILED - {phone}: {str(e)}")
        return {
            'phone': phone,
            'status': 'failed',
            'error': str(e)
        }

def main():
    print("=" * 60)
    print("RETRY FAILED BATCH 2 USERS")
    print("=" * 60)
    print(f"Frontend URL: {FRONTEND_URL}")
    print(f"Retrying: {len(FAILED_PHONES)} users")
    print()
    
    # Load failed users
    users = load_failed_users()
    print(f"✅ Loaded {len(users)} failed users to retry\n")
    
    if len(users) == 0:
        print("❌ No failed users found in Excel file")
        return
    
    # Process each user
    results = []
    start_time = time.time()
    
    for i, user in enumerate(users, 1):
        result = process_user(user, i, len(users))
        results.append(result)
        
        # Small delay between requests
        if i < len(users):
            time.sleep(2)
    
    # Summary
    elapsed = time.time() - start_time
    success_count = sum(1 for r in results if r['status'] == 'success')
    failed_count = len(results) - success_count
    
    print("\n" + "=" * 60)
    print("RETRY COMPLETE!")
    print("=" * 60)
    print(f"Total: {len(results)}")
    print(f"Success: {success_count}")
    print(f"Failed: {failed_count}")
    print(f"Time: {elapsed/60:.1f} minutes")
    print()
    
    # Save retry summary
    summary_path = f"{OUTPUT_DIR}/retry_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump({
            'total': len(results),
            'success': success_count,
            'failed': failed_count,
            'elapsed_seconds': elapsed,
            'results': results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"📄 Summary saved: {summary_path}")
    
    if success_count > 0:
        print(f"\n✅ Successfully recovered {success_count} users!")
        print("📦 Run 'npx vercel --prod --yes' to deploy!")
    
    if failed_count > 0:
        print(f"\n⚠️  {failed_count} users still failed:")
        for r in results:
            if r['status'] == 'failed':
                print(f"   ❌ {r['phone']}: {r.get('error', 'Unknown error')}")

if __name__ == '__main__':
    main()

