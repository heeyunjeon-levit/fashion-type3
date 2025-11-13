#!/usr/bin/env python3
"""
Process all users from the Excel file and generate HTML result pages.
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
EXCEL_FILE = '/Users/levit/Desktop/file+phonenumber.xlsx'
OUTPUT_DIR = './batch_results'
PUBLIC_DIR = './public/results'

def ensure_dirs():
    """Create necessary directories."""
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    Path(PUBLIC_DIR).mkdir(parents=True, exist_ok=True)

def load_users():
    """Load users from Excel file."""
    df = pd.read_excel(EXCEL_FILE)
    image_col = '지금 사진첩으로 가셔서 캡쳐해 놓으신 스크린샷을 업로드 부탁드려요.'
    phone_col = '경품을 받아보실 전화번호를 적어주세요. '
    
    users = []
    for _, row in df.iterrows():
        image_url = str(row[image_col]).strip()
        phone = str(row[phone_col]).strip()
        
        if image_url and image_url != 'nan' and phone and phone != 'nan':
            users.append({
                'phone': phone,
                'image_url': image_url
            })
    
    return users

def download_image(url, save_path):
    """Download image from URL."""
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    with open(save_path, 'wb') as f:
        f.write(response.content)

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
    
    # Format cropped_images as {category: url_string} for search API
    cropped_images = {}
    for item in data.get('items', []):  # Fixed: API returns 'items', not 'croppedImages'
        category = item.get('category', 'unknown')
        cropped_url = item.get('croppedImageUrl', '')
        if cropped_url:
            # Use category as key, if duplicate use category_1, category_2, etc
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
    print(f"Processing {index}/{total}: {phone}")
    print(f"{'='*60}")
    
    try:
        # 1. Download image
        print("📥 Downloading...")
        image_path = f"{OUTPUT_DIR}/{phone}_original.jpg"
        download_image(image_url, image_path)
        print(f"✅ Downloaded")
        
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
        
        # 5. Save results JSON and prepare for HTML generation
        # Convert cropped_images dict to items array format
        items = []
        for category_key, url in cropped_images.items():
            category = category_key.split('_')[0]  # Remove _1, _2 suffixes
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
    print("BATCH PROCESSING - ALL USERS")
    print("=" * 60)
    print(f"Frontend URL: {FRONTEND_URL}")
    print()
    
    # Setup
    ensure_dirs()
    
    # Load users
    users = load_users()
    print(f"✅ Loaded {len(users)} users\n")
    
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
    print("BATCH COMPLETE!")
    print("=" * 60)
    print(f"Total: {len(results)}")
    print(f"Success: {success_count}")
    print(f"Failed: {failed_count}")
    print(f"Time: {elapsed/60:.1f} minutes")
    print()
    
    # Save summary
    summary_path = f"{OUTPUT_DIR}/batch_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
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
        print("\n✅ All HTML files are in: ./public/results/")
        print("📦 Run 'npx vercel --prod --yes' to deploy all links!")

if __name__ == '__main__':
    main()

