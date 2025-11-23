#!/usr/bin/env python3
"""
Test full pipeline with DINO-X detection
1. DINO-X detection
2. Crop items
3. Search for products
4. Compare results quality
"""

import os
import sys
import json
import time
import base64
import requests
from datetime import datetime
from pathlib import Path

# Configuration
BRANDS_DIR = Path("/Users/levit/Desktop/brands")
RESULTS_DIR = Path("/Users/levit/Desktop/mvp/brands_results")

# API Endpoints
CROP_API_URL = "https://fashionsource-gpu-backend-production.up.railway.app/api/analyze"
SEARCH_API_URL = "https://fashionsource.vercel.app/api/search"

# Test images - selecting diverse images
TEST_IMAGES = [
    "5d96eff1ccb9-IMG_1740 복사본.png",  # Previously had good results
    "9c9b7d5f941e-IMG_7594 복사본.png",  # Another good one
]

def encode_image_to_base64(image_path):
    """Encode image to base64 string"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def upload_image_via_api(image_path):
    """Upload image via Next.js API"""
    print("📤 Uploading image via API...")
    
    # Encode image to base64
    base64_image = encode_image_to_base64(image_path)
    
    # Call upload API
    upload_response = requests.post(
        "https://fashionsource.vercel.app/api/upload",
        json={"image": base64_image},
        timeout=60
    )
    
    if upload_response.status_code != 200:
        raise Exception(f"Upload failed: {upload_response.status_code} - {upload_response.text}")
    
    upload_result = upload_response.json()
    image_url = upload_result.get('imageUrl')
    
    if not image_url:
        raise Exception("No imageUrl in upload response")
    
    print(f"✅ Uploaded: {image_url}")
    return image_url

def test_full_pipeline(image_path, use_dinox=True):
    """Run full pipeline on image"""
    print(f"\n{'='*80}")
    print(f"Processing: {image_path.name}")
    print(f"Mode: {'DINO-X' if use_dinox else 'GPT-4o'}")
    print(f"{'='*80}")
    
    total_start = time.time()
    
    try:
        # Step 1: Upload image
        upload_start = time.time()
        image_url = upload_image_via_api(image_path)
        upload_time = time.time() - upload_start
        print(f"⏱️  Upload: {upload_time:.2f}s")
        
        # Step 2: Analyze and crop with DINO-X or GPT-4o
        print(f"\n🔍 Step 1: Analyzing with {'DINO-X' if use_dinox else 'GPT-4o'}...")
        analyze_start = time.time()
        
        analyze_response = requests.post(
            CROP_API_URL,
            json={
                "imageUrl": image_url,
                "use_dinox": use_dinox
            },
            timeout=120
        )
        
        analyze_time = time.time() - analyze_start
        
        if analyze_response.status_code != 200:
            raise Exception(f"Analyze failed: {analyze_response.status_code} - {analyze_response.text}")
        
        analyze_result = analyze_response.json()
        items = analyze_result.get('items', [])
        
        print(f"✅ Analysis complete in {analyze_time:.2f}s")
        print(f"   Detected {len(items)} items")
        
        for i, item in enumerate(items, 1):
            print(f"   {i}. {item.get('category', 'unknown')}: {item.get('groundingdino_prompt', 'N/A')}")
        
        if len(items) == 0:
            print("⚠️  No items detected, skipping search")
            return {
                "success": False,
                "image_name": image_path.name,
                "mode": "DINO-X" if use_dinox else "GPT-4o",
                "error": "No items detected",
                "upload_time": upload_time,
                "analyze_time": analyze_time
            }
        
        # Step 3: Search for products
        print(f"\n🔎 Step 2: Searching for products...")
        search_start = time.time()
        
        # Prepare search request
        categories = [item['category'] for item in items]
        cropped_images = {
            item['category']: item.get('croppedImageUrl', '')
            for item in items
        }
        
        search_response = requests.post(
            SEARCH_API_URL,
            json={
                "categories": categories,
                "croppedImages": cropped_images,
                "originalImageUrl": image_url
            },
            timeout=180
        )
        
        search_time = time.time() - search_start
        
        if search_response.status_code != 200:
            raise Exception(f"Search failed: {search_response.status_code} - {search_response.text}")
        
        search_result = search_response.json()
        results = search_result.get('results', {})
        
        print(f"✅ Search complete in {search_time:.2f}s")
        print(f"   Found products for {len(results)} categories")
        
        # Print search results summary
        for category, products in results.items():
            if products and len(products) > 0:
                print(f"\n   📦 {category}: {len(products)} products")
                for j, product in enumerate(products[:3], 1):  # Show first 3
                    print(f"      {j}. {product.get('title', 'N/A')[:60]}...")
        
        total_time = time.time() - total_start
        
        return {
            "success": True,
            "image_name": image_path.name,
            "mode": "DINO-X" if use_dinox else "GPT-4o",
            "image_url": image_url,
            "timing": {
                "upload": upload_time,
                "analyze": analyze_time,
                "search": search_time,
                "total": total_time
            },
            "detected_items": len(items),
            "items": items,
            "product_categories": len(results),
            "total_products": sum(len(products) for products in results.values()),
            "search_results": results,
            "gpt_reasoning": search_result.get('gptReasoning', {})
        }
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "image_name": image_path.name,
            "mode": "DINO-X" if use_dinox else "GPT-4o",
            "error": str(e),
            "total_time": time.time() - total_start
        }

def main():
    print("\n" + "="*80)
    print("🚀 DINO-X Full Pipeline Test")
    print("="*80)
    print(f"\nTesting {len(TEST_IMAGES)} images through complete pipeline:")
    print("  1. DINO-X detection")
    print("  2. Item cropping")
    print("  3. Product search")
    print("  4. GPT-4 Turbo selection")
    
    # Create results directory
    RESULTS_DIR.mkdir(exist_ok=True)
    
    all_results = []
    
    # Process each test image
    for image_name in TEST_IMAGES:
        image_path = BRANDS_DIR / image_name
        
        if not image_path.exists():
            print(f"\n⚠️ Image not found: {image_name}")
            continue
        
        # Test with DINO-X
        result = test_full_pipeline(image_path, use_dinox=True)
        all_results.append(result)
        
        # Brief pause between images
        time.sleep(3)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = RESULTS_DIR / f"dinox_full_pipeline_{timestamp}.json"
    
    summary = {
        "timestamp": timestamp,
        "total_images": len(TEST_IMAGES),
        "successful": sum(1 for r in all_results if r['success']),
        "failed": sum(1 for r in all_results if not r['success']),
        "results": all_results
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "="*80)
    print("📊 PIPELINE SUMMARY")
    print("="*80)
    
    successful = [r for r in all_results if r['success']]
    failed = [r for r in all_results if not r['success']]
    
    print(f"\n✅ Successful: {len(successful)}/{len(all_results)}")
    print(f"❌ Failed: {len(failed)}/{len(all_results)}")
    
    if successful:
        avg_analyze = sum(r['timing']['analyze'] for r in successful) / len(successful)
        avg_search = sum(r['timing']['search'] for r in successful) / len(successful)
        avg_total = sum(r['timing']['total'] for r in successful) / len(successful)
        avg_items = sum(r['detected_items'] for r in successful) / len(successful)
        avg_products = sum(r['total_products'] for r in successful) / len(successful)
        
        print(f"\n⏱️  Timing Averages:")
        print(f"   Analysis (DINO-X): {avg_analyze:.2f}s")
        print(f"   Product Search: {avg_search:.2f}s")
        print(f"   Total Pipeline: {avg_total:.2f}s")
        
        print(f"\n📦 Detection Averages:")
        print(f"   Items detected: {avg_items:.1f}")
        print(f"   Products found: {avg_products:.1f}")
        
        # Show per-image results
        print(f"\n📋 Per-Image Results:")
        for r in successful:
            timing = r['timing']
            print(f"\n   {r['image_name']}:")
            print(f"      Items detected: {r['detected_items']}")
            print(f"      Products found: {r['total_products']}")
            print(f"      Total time: {timing['total']:.2f}s")
    
    if failed:
        print(f"\n❌ Failed images:")
        for r in failed:
            print(f"   - {r['image_name']}: {r.get('error', 'Unknown error')}")
    
    print(f"\n💾 Results saved to: {output_file}")
    print(f"\n🎯 Next: Review the search results to see if DINO-X captions work well!")
    
    return summary

if __name__ == "__main__":
    main()

