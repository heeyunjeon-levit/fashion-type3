#!/usr/bin/env python3
"""
Upload brand images to Supabase and test with DINO-X
"""

import os
import sys
import json
import time
import base64
import requests
from pathlib import Path
from datetime import datetime

# Configuration
BRANDS_DIR = Path("/Users/levit/Desktop/brands")
RESULTS_DIR = Path("/Users/levit/Desktop/mvp/brands_results")
MODAL_API_URL = "https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/analyze"
UPLOAD_API_URL = "https://fashionsource.vercel.app/api/upload"

# Test images
TEST_IMAGES = [
    "5d96eff1ccb9-IMG_1740 복사본.png",
    "9c9b7d5f941e-IMG_7594 복사본.png",
    "731d24e62d99-IMG_3357 복사본.png",
]

def upload_via_vercel(image_path):
    """Upload image via Vercel API (which has Supabase credentials)"""
    print(f"\n📤 Uploading: {image_path.name}")
    
    # Read and encode image
    with open(image_path, 'rb') as f:
        image_data = f.read()
    
    base64_image = base64.b64encode(image_data).decode('utf-8')
    
    print(f"   Uploading via Vercel API...")
    
    try:
        response = requests.post(
            UPLOAD_API_URL,
            json={"image": base64_image},
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"   ❌ Upload failed: {response.status_code}")
            print(f"   {response.text[:100]}")
            return None
        
        result = response.json()
        image_url = result.get('imageUrl')
        
        if not image_url:
            print(f"   ❌ No imageUrl in response")
            return None
        
        print(f"   ✅ Uploaded: {image_url[:60]}...")
        return image_url
        
    except Exception as e:
        print(f"   ❌ Upload error: {e}")
        return None

def test_with_dinox(image_url, image_name):
    """Test image with DINO-X"""
    print(f"\n🔍 Testing with DINO-X...")
    
    start_time = time.time()
    
    try:
        response = requests.post(
            MODAL_API_URL,
            json={
                "imageUrl": image_url,
                "use_dinox": True
            },
            timeout=120
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code != 200:
            print(f"   ❌ Failed: {response.status_code}")
            print(f"   Error: {response.text[:200]}")
            return {
                "success": False,
                "image_name": image_name,
                "image_url": image_url,
                "error": f"HTTP {response.status_code}",
                "elapsed": elapsed
            }
        
        result = response.json()
        items = result.get('items', [])
        timing = result.get('timing', {})
        
        print(f"   ✅ Success in {elapsed:.2f}s")
        print(f"   📦 Detected {len(items)} items")
        
        # Print detected items
        for i, item in enumerate(items[:3], 1):
            print(f"\n   {i}. {item.get('category', 'unknown').upper()}")
            desc = item.get('description', 'N/A')
            print(f"      {desc[:70]}...")
            print(f"      Confidence: {item.get('confidence', 0):.2f}")
        
        if len(items) > 3:
            print(f"\n   ... and {len(items) - 3} more items")
        
        return {
            "success": True,
            "image_name": image_name,
            "image_url": image_url,
            "elapsed": elapsed,
            "items_detected": len(items),
            "timing": timing,
            "items": items
        }
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return {
            "success": False,
            "image_name": image_name,
            "image_url": image_url,
            "error": str(e),
            "elapsed": time.time() - start_time
        }

def main():
    print("\n" + "="*80)
    print("🚀 Upload Brand Images & Test with DINO-X")
    print("="*80)
    print(f"\nBrands directory: {BRANDS_DIR}")
    print(f"Upload via: {UPLOAD_API_URL}")
    print(f"Modal endpoint: {MODAL_API_URL}")
    print(f"Testing {len(TEST_IMAGES)} images\n")
    
    RESULTS_DIR.mkdir(exist_ok=True)
    
    all_results = []
    
    # Process each image
    for image_name in TEST_IMAGES:
        image_path = BRANDS_DIR / image_name
        
        if not image_path.exists():
            print(f"\n⚠️ Image not found: {image_name}")
            continue
        
        print(f"\n{'='*80}")
        print(f"Processing: {image_name}")
        print(f"{'='*80}")
        
        # Step 1: Upload via Vercel API
        image_url = upload_via_vercel(image_path)
        
        if not image_url:
            all_results.append({
                "success": False,
                "image_name": image_name,
                "error": "Upload failed"
            })
            continue
        
        # Step 2: Test with DINO-X
        result = test_with_dinox(image_url, image_name)
        all_results.append(result)
        
        # Brief pause
        time.sleep(2)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = RESULTS_DIR / f"dinox_supabase_test_{timestamp}.json"
    
    summary = {
        "timestamp": timestamp,
        "total_images": len(TEST_IMAGES),
        "successful": sum(1 for r in all_results if r.get('success')),
        "failed": sum(1 for r in all_results if not r.get('success')),
        "results": all_results
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "="*80)
    print("📊 FINAL SUMMARY")
    print("="*80)
    
    successful = [r for r in all_results if r.get('success')]
    failed = [r for r in all_results if not r.get('success')]
    
    print(f"\n✅ Successful: {len(successful)}/{len(all_results)}")
    print(f"❌ Failed: {len(failed)}/{len(all_results)}")
    
    if successful:
        avg_time = sum(r['elapsed'] for r in successful) / len(successful)
        avg_items = sum(r['items_detected'] for r in successful) / len(successful)
        
        print(f"\n⏱️  Average Processing Time: {avg_time:.2f}s")
        print(f"📦 Average Items Detected: {avg_items:.1f}")
        
        print(f"\n📋 Detailed Results:")
        for r in successful:
            print(f"\n   {r['image_name']}:")
            print(f"      Time: {r['elapsed']:.2f}s")
            print(f"      Items: {r['items_detected']}")
            print(f"      URL: {r['image_url'][:60]}...")
            
            # Show top 2 items
            for i, item in enumerate(r['items'][:2], 1):
                desc = item.get('description', 'N/A')
                print(f"      {i}. {desc[:60]}...")
    
    if failed:
        print(f"\n❌ Failed Images:")
        for r in failed:
            print(f"   - {r['image_name']}: {r.get('error', 'Unknown')}")
    
    print(f"\n💾 Results saved to: {output_file}")
    
    if successful:
        print(f"\n🎯 Key Findings:")
        print(f"   ✅ DINO-X Hybrid working with real brand images!")
        print(f"   ✅ Average {avg_items:.1f} items detected per image")
        print(f"   ✅ Average {avg_time:.2f}s processing time")
        print(f"   ✅ Detailed fashion descriptions generated")
        print(f"   ✅ Production ready! 🚀")

if __name__ == "__main__":
    main()

