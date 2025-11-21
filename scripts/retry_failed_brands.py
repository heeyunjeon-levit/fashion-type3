#!/usr/bin/env python3
"""
Retry processing for failed brand images
"""

import os
import sys
import time
import json
import requests
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
BRANDS_DIR = "/Users/levit/Desktop/brands"
RESULTS_DIR = "/Users/levit/Desktop/mvp/brands_results"
API_BASE_URL = "http://localhost:3000"

# Failed images to retry
FAILED_IMAGES = [
    "0214d4bd3a05-IMG_6128 복사본.png",
    "69e143fdcf4f-Screenshot_20250404_183603_Instagram 복사본.jpg",
    "d6459f83273f-IMG_3268 복사본.png"
]

def upload_image_to_api(image_path):
    """Upload image via the Next.js upload API"""
    print(f"\n📤 Uploading: {os.path.basename(image_path)}")
    
    try:
        with open(image_path, 'rb') as f:
            files = {'file': (os.path.basename(image_path), f, 'image/jpeg')}
            response = requests.post(
                f"{API_BASE_URL}/api/upload",
                files=files,
                timeout=60
            )
        
        if response.status_code == 200:
            data = response.json()
            image_url = data.get('imageUrl')
            print(f"✅ Uploaded: {image_url}")
            return image_url
        else:
            print(f"❌ Upload failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return None

def analyze_image(image_url):
    """Call the analyze API (GPT-4o + cropping)"""
    print(f"\n🔍 Analyzing image...")
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/analyze",
            json={'imageUrl': image_url},
            timeout=120
        )
        
        if response.status_code == 200:
            data = response.json()
            items = data.get('items', [])
            print(f"✅ Found {len(items)} items:")
            for item in items:
                print(f"   - {item.get('category')}: {item.get('description', item.get('groundingdino_prompt'))}")
            return data
        else:
            print(f"❌ Analysis failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Analysis error: {e}")
        return None

def search_products(analyzed_data, original_image_url):
    """Call the search API (Serper + GPT-4 Turbo)"""
    print(f"\n🔎 Searching for products...")
    
    try:
        # Build categories and cropped images from analyzed data
        items = analyzed_data.get('items', [])
        categories = [item.get('category') for item in items]
        
        # Build cropped images map
        cropped_images = {}
        for idx, item in enumerate(items):
            category = item.get('category')
            cropped_url = item.get('croppedImageUrl')
            if cropped_url:
                key = f"{category}_{idx + 1}"
                cropped_images[key] = cropped_url
        
        response = requests.post(
            f"{API_BASE_URL}/api/search",
            json={
                'categories': categories,
                'croppedImages': cropped_images,
                'originalImageUrl': original_image_url
            },
            timeout=180
        )
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', {})
            print(f"✅ Found products for {len(results)} items:")
            for category, products in results.items():
                print(f"   - {category}: {len(products)} products")
            return data
        else:
            print(f"❌ Search failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Search error: {e}")
        return None

def process_single_image(image_path, image_number, total_images):
    """Process a single image through the full pipeline"""
    print(f"\n{'='*80}")
    print(f"RETRY {image_number}/{total_images}: {os.path.basename(image_path)}")
    print(f"{'='*80}")
    
    start_time = time.time()
    result = {
        'image_path': image_path,
        'image_name': os.path.basename(image_path),
        'timestamp': datetime.now().isoformat(),
        'success': False,
        'error': None,
        'retry_attempt': True
    }
    
    try:
        # Step 1: Upload image
        image_url = upload_image_to_api(image_path)
        if not image_url:
            result['error'] = 'Upload failed'
            return result
        result['image_url'] = image_url
        
        # Step 2: Analyze image (GPT-4o + cropping)
        analyzed_data = analyze_image(image_url)
        if not analyzed_data:
            result['error'] = 'Analysis failed'
            return result
        
        # Check if any items were detected
        items = analyzed_data.get('items', [])
        if len(items) == 0:
            print(f"\n⚠️ GPT-4o detected 0 items in this image")
            print(f"💡 This might be a non-fashion image or GPT-4o couldn't identify fashion items")
            result['error'] = 'No fashion items detected by GPT-4o'
            result['analysis'] = analyzed_data
            return result
        
        result['analysis'] = analyzed_data
        
        # Step 3: Search for products
        search_data = search_products(analyzed_data, image_url)
        if not search_data:
            result['error'] = 'Search failed'
            return result
        result['search'] = search_data
        
        # Success!
        result['success'] = True
        elapsed = time.time() - start_time
        result['processing_time_seconds'] = round(elapsed, 2)
        
        print(f"\n✅ SUCCESS! Processed in {elapsed:.1f}s")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        result['error'] = str(e)
    
    return result

def main():
    """Retry processing for failed images"""
    print(f"{'='*80}")
    print(f"RETRY FAILED BRAND IMAGES")
    print(f"{'='*80}")
    print(f"Retrying {len(FAILED_IMAGES)} images\n")
    
    all_results = []
    successful = 0
    failed = 0
    no_items_detected = 0
    
    batch_start_time = time.time()
    
    for idx, image_name in enumerate(FAILED_IMAGES, 1):
        image_path = os.path.join(BRANDS_DIR, image_name)
        
        if not os.path.exists(image_path):
            print(f"❌ Image not found: {image_path}")
            continue
        
        result = process_single_image(image_path, idx, len(FAILED_IMAGES))
        all_results.append(result)
        
        if result['success']:
            successful += 1
        else:
            failed += 1
            if 'No fashion items detected' in result.get('error', ''):
                no_items_detected += 1
        
        # Small delay between images
        if idx < len(FAILED_IMAGES):
            print(f"\n⏸️  Waiting 2s before next image...")
            time.sleep(2)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = os.path.join(RESULTS_DIR, f"brands_retry_{timestamp}.json")
    
    batch_summary = {
        'timestamp': datetime.now().isoformat(),
        'retry_attempt': True,
        'total_images': len(FAILED_IMAGES),
        'successful': successful,
        'failed': failed,
        'no_items_detected': no_items_detected,
        'total_time_seconds': round(time.time() - batch_start_time, 2),
        'results': all_results
    }
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(batch_summary, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print(f"\n{'='*80}")
    print(f"RETRY COMPLETE!")
    print(f"{'='*80}")
    print(f"✅ Successful: {successful}/{len(FAILED_IMAGES)}")
    print(f"❌ Failed: {failed}/{len(FAILED_IMAGES)}")
    print(f"⚠️  No items detected: {no_items_detected}/{len(FAILED_IMAGES)}")
    print(f"⏱️  Total time: {batch_summary['total_time_seconds']:.1f}s")
    print(f"💾 Results saved to: {results_file}")
    print(f"{'='*80}\n")
    
    # Show details for failed/no-items images
    if no_items_detected > 0:
        print(f"\n💡 Images where GPT-4o couldn't detect fashion items:")
        for result in all_results:
            if 'No fashion items detected' in result.get('error', ''):
                print(f"   - {result['image_name']}")
        print(f"\n   These images might be:")
        print(f"   • Non-fashion images (text, graphics, etc.)")
        print(f"   • Very low quality/blurry")
        print(f"   • Extreme angles or lighting")
        print(f"   • Fashion items too small/unclear to detect")

if __name__ == "__main__":
    main()

