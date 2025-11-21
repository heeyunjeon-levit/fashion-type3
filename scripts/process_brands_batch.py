#!/usr/bin/env python3
"""
Process all brand images from /Desktop/brands through the full pipeline
"""

import os
import sys
import time
import json
import requests
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
BRANDS_DIR = "/Users/levit/Desktop/brands"
RESULTS_DIR = "/Users/levit/Desktop/mvp/brands_results"
API_BASE_URL = "http://localhost:3000"  # Your Next.js dev server

# Create results directory
os.makedirs(RESULTS_DIR, exist_ok=True)

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
                # Use unique key for each item (category_1, category_2, etc.)
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
    print(f"Processing image {image_number}/{total_images}: {os.path.basename(image_path)}")
    print(f"{'='*80}")
    
    start_time = time.time()
    result = {
        'image_path': image_path,
        'image_name': os.path.basename(image_path),
        'timestamp': datetime.now().isoformat(),
        'success': False,
        'error': None
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
    """Process all images in the brands directory"""
    print(f"{'='*80}")
    print(f"BRAND IMAGES BATCH PROCESSING")
    print(f"{'='*80}")
    print(f"Source: {BRANDS_DIR}")
    print(f"Results: {RESULTS_DIR}")
    print(f"{'='*80}\n")
    
    # Get all image files
    image_extensions = ('.jpg', '.jpeg', '.png', '.heic', '.heif')
    image_files = [
        os.path.join(BRANDS_DIR, f) 
        for f in os.listdir(BRANDS_DIR) 
        if f.lower().endswith(image_extensions)
    ]
    image_files.sort()  # Process in alphabetical order
    
    total_images = len(image_files)
    print(f"Found {total_images} images to process\n")
    
    if total_images == 0:
        print("❌ No images found!")
        return
    
    # Ask for confirmation
    print(f"⚠️  This will process {total_images} images through:")
    print(f"   1. Image upload")
    print(f"   2. GPT-4o analysis + item cropping")
    print(f"   3. Serper product search (3x per item)")
    print(f"   4. GPT-4 Turbo product selection")
    print(f"\n💰 Estimated cost: $15-25")
    print(f"⏱️  Estimated time: 10-15 minutes\n")
    
    # Process all images
    all_results = []
    successful = 0
    failed = 0
    
    batch_start_time = time.time()
    
    for idx, image_path in enumerate(image_files, 1):
        result = process_single_image(image_path, idx, total_images)
        all_results.append(result)
        
        if result['success']:
            successful += 1
        else:
            failed += 1
        
        # Small delay between images to avoid rate limiting
        if idx < total_images:
            print(f"\n⏸️  Waiting 2s before next image...")
            time.sleep(2)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = os.path.join(RESULTS_DIR, f"brands_batch_{timestamp}.json")
    
    batch_summary = {
        'timestamp': datetime.now().isoformat(),
        'total_images': total_images,
        'successful': successful,
        'failed': failed,
        'total_time_seconds': round(time.time() - batch_start_time, 2),
        'results': all_results
    }
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(batch_summary, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print(f"\n{'='*80}")
    print(f"BATCH PROCESSING COMPLETE!")
    print(f"{'='*80}")
    print(f"✅ Successful: {successful}/{total_images}")
    print(f"❌ Failed: {failed}/{total_images}")
    print(f"⏱️  Total time: {batch_summary['total_time_seconds']:.1f}s")
    print(f"💾 Results saved to: {results_file}")
    print(f"{'='*80}\n")
    
    # Show failed images if any
    if failed > 0:
        print(f"\n❌ Failed images:")
        for result in all_results:
            if not result['success']:
                print(f"   - {result['image_name']}: {result.get('error', 'Unknown error')}")

if __name__ == "__main__":
    main()

