#!/usr/bin/env python3
"""
Rerun previously failed images with the new fallback system
"""

import os
import sys
import time
import json
import requests
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
BRANDS_DIR = "/Users/levit/Desktop/brands"
RESULTS_DIR = "/Users/levit/Desktop/mvp/brands_results"
API_BASE_URL = "http://localhost:3000"

# Failed images to retry with fallback
FAILED_IMAGES = [
    "0214d4bd3a05-IMG_6128 복사본.png",  # Houndstooth bag screenshot
    "d6459f83273f-IMG_3268 복사본.png"   # Luggage (will test if fallback works)
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
    """Call the search API (Serper + GPT-4 Turbo + FALLBACK)"""
    items = analyzed_data.get('items', [])
    
    # Build search request
    if len(items) == 0:
        print(f"\n🔎 Searching with FALLBACK mode (0 items detected)...")
        categories = []
        cropped_images = {}
    else:
        print(f"\n🔎 Searching for products (normal mode)...")
        categories = [item.get('category') for item in items]
        cropped_images = {}
        for idx, item in enumerate(items):
            category = item.get('category')
            cropped_url = item.get('croppedImageUrl')
            if cropped_url:
                key = f"{category}_{idx + 1}"
                cropped_images[key] = cropped_url
    
    try:
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
            meta = data.get('meta', {})
            
            if meta.get('fallbackMode'):
                print(f"✅ FALLBACK MODE ACTIVATED!")
                print(f"   Detected category: {meta.get('detectedCategory', 'unknown')}")
                print(f"   Reasoning: {meta.get('reasoning', 'N/A')}")
            
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
    """Process a single image through the full pipeline with fallback"""
    print(f"\n{'='*80}")
    print(f"FALLBACK TEST {image_number}/{total_images}: {os.path.basename(image_path)}")
    print(f"{'='*80}")
    
    start_time = time.time()
    result = {
        'image_path': image_path,
        'image_name': os.path.basename(image_path),
        'timestamp': datetime.now().isoformat(),
        'success': False,
        'error': None,
        'fallback_test': True
    }
    
    try:
        # Step 1: Upload
        image_url = upload_image_to_api(image_path)
        if not image_url:
            result['error'] = 'Upload failed'
            return result
        result['image_url'] = image_url
        
        # Step 2: Analyze
        analyzed_data = analyze_image(image_url)
        if not analyzed_data:
            result['error'] = 'Analysis failed'
            return result
        result['analysis'] = analyzed_data
        
        # Step 3: Search (with fallback if needed)
        search_data = search_products(analyzed_data, image_url)
        if not search_data:
            result['error'] = 'Search failed'
            return result
        result['search'] = search_data
        
        # Check if fallback was used
        result['used_fallback'] = search_data.get('meta', {}).get('fallbackMode', False)
        
        # Success!
        result['success'] = True
        elapsed = time.time() - start_time
        result['processing_time_seconds'] = round(elapsed, 2)
        
        print(f"\n✅ SUCCESS! Processed in {elapsed:.1f}s")
        if result['used_fallback']:
            print(f"   🔄 Used FALLBACK mode")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        result['error'] = str(e)
    
    return result

def main():
    """Rerun failed images with fallback system"""
    print(f"{'='*80}")
    print(f"TESTING FALLBACK SYSTEM ON PREVIOUSLY FAILED IMAGES")
    print(f"{'='*80}")
    print(f"Testing {len(FAILED_IMAGES)} images\n")
    
    all_results = []
    successful = 0
    used_fallback = 0
    failed = 0
    
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
            if result.get('used_fallback'):
                used_fallback += 1
        else:
            failed += 1
        
        # Small delay
        if idx < len(FAILED_IMAGES):
            print(f"\n⏸️  Waiting 2s before next image...")
            time.sleep(2)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = os.path.join(RESULTS_DIR, f"fallback_test_{timestamp}.json")
    
    batch_summary = {
        'timestamp': datetime.now().isoformat(),
        'fallback_test': True,
        'total_images': len(FAILED_IMAGES),
        'successful': successful,
        'used_fallback': used_fallback,
        'failed': failed,
        'total_time_seconds': round(time.time() - batch_start_time, 2),
        'results': all_results
    }
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(batch_summary, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print(f"\n{'='*80}")
    print(f"FALLBACK TEST COMPLETE!")
    print(f"{'='*80}")
    print(f"✅ Successful: {successful}/{len(FAILED_IMAGES)}")
    print(f"🔄 Used fallback: {used_fallback}/{successful}")
    print(f"❌ Failed: {failed}/{len(FAILED_IMAGES)}")
    print(f"⏱️  Total time: {batch_summary['total_time_seconds']:.1f}s")
    print(f"💾 Results saved to: {results_file}")
    print(f"{'='*80}\n")
    
    # Show details
    if successful > 0:
        print(f"✅ Successfully processed with fallback:")
        for result in all_results:
            if result['success'] and result.get('used_fallback'):
                meta = result.get('search', {}).get('meta', {})
                print(f"\n   📦 {result['image_name']}")
                print(f"      Category: {meta.get('detectedCategory', 'unknown')}")
                print(f"      Products: {len(result.get('search', {}).get('results', {}))}")
                print(f"      Time: {result.get('processing_time_seconds', 0):.1f}s")

if __name__ == "__main__":
    main()

