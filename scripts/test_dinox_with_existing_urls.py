#!/usr/bin/env python3
"""
Test full pipeline with DINO-X using already-uploaded images
"""

import os
import sys
import json
import time
import requests
from datetime import datetime
from pathlib import Path

# Configuration
RESULTS_DIR = Path("/Users/levit/Desktop/mvp/brands_results")

# API Endpoints
ANALYZE_API_URL = "https://fashionsource-gpu-backend-production.up.railway.app/api/analyze"
SEARCH_API_URL = "https://fashionsource.vercel.app/api/search"

# Test with already-uploaded images
TEST_IMAGES = [
    {
        "name": "5d96eff1ccb9-IMG_1740",
        "url": "https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1763681473729_5d96eff1ccb9-IMG_1740_.jpg"
    },
    {
        "name": "9c9b7d5f941e-IMG_7594",
        "url": "https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1763681883965_9c9b7d5f941e-IMG_7594_.jpg"
    }
]

def test_full_pipeline(image_info, use_dinox=True):
    """Run full pipeline on image"""
    print(f"\n{'='*80}")
    print(f"Processing: {image_info['name']}")
    print(f"Mode: {'DINO-X' if use_dinox else 'GPT-4o'}")
    print(f"URL: {image_info['url']}")
    print(f"{'='*80}")
    
    total_start = time.time()
    
    try:
        # Step 1: Analyze and crop with DINO-X or GPT-4o
        print(f"\n🔍 Step 1: Analyzing with {'DINO-X' if use_dinox else 'GPT-4o'}...")
        analyze_start = time.time()
        
        analyze_response = requests.post(
            ANALYZE_API_URL,
            json={
                "imageUrl": image_info['url'],
                "use_dinox": use_dinox
            },
            timeout=120
        )
        
        analyze_time = time.time() - analyze_start
        
        if analyze_response.status_code != 200:
            raise Exception(f"Analyze failed: {analyze_response.status_code} - {analyze_response.text}")
        
        analyze_result = analyze_response.json()
        items = analyze_result.get('items', [])
        timing = analyze_result.get('timing', {})
        
        print(f"✅ Analysis complete in {analyze_time:.2f}s")
        print(f"   Detected {len(items)} items")
        print(f"   Backend timing: {timing}")
        
        for i, item in enumerate(items, 1):
            print(f"   {i}. {item.get('category', 'unknown')}: {item.get('groundingdino_prompt', 'N/A')[:50]}")
        
        if len(items) == 0:
            print("⚠️  No items detected, skipping search")
            return {
                "success": False,
                "image_name": image_info['name'],
                "mode": "DINO-X" if use_dinox else "GPT-4o",
                "error": "No items detected",
                "analyze_time": analyze_time
            }
        
        # Step 2: Search for products
        print(f"\n🔎 Step 2: Searching for products...")
        search_start = time.time()
        
        # Prepare search request
        categories = [item['category'] for item in items]
        cropped_images = {
            item['category']: item.get('croppedImageUrl', '')
            for item in items
        }
        
        print(f"   Categories: {categories}")
        print(f"   Cropped URLs: {list(cropped_images.keys())}")
        
        search_response = requests.post(
            SEARCH_API_URL,
            json={
                "categories": categories,
                "croppedImages": cropped_images,
                "originalImageUrl": image_info['url']
            },
            timeout=300
        )
        
        search_time = time.time() - search_start
        
        if search_response.status_code != 200:
            raise Exception(f"Search failed: {search_response.status_code} - {search_response.text}")
        
        search_result = search_response.json()
        results = search_result.get('results', {})
        
        print(f"✅ Search complete in {search_time:.2f}s")
        print(f"   Found products for {len(results)} categories")
        
        # Print search results summary
        total_products = 0
        for category, products in results.items():
            if products and len(products) > 0:
                total_products += len(products)
                print(f"\n   📦 {category}: {len(products)} products")
                for j, product in enumerate(products[:2], 1):  # Show first 2
                    title = product.get('title', 'N/A')
                    print(f"      {j}. {title[:70]}...")
        
        total_time = time.time() - total_start
        
        return {
            "success": True,
            "image_name": image_info['name'],
            "image_url": image_info['url'],
            "mode": "DINO-X" if use_dinox else "GPT-4o",
            "timing": {
                "analyze": analyze_time,
                "search": search_time,
                "total": total_time
            },
            "backend_timing": timing,
            "detected_items": len(items),
            "items": items,
            "product_categories": len(results),
            "total_products": total_products,
            "search_results": results,
            "gpt_reasoning": search_result.get('gptReasoning', {})
        }
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "image_name": image_info['name'],
            "mode": "DINO-X" if use_dinox else "GPT-4o",
            "error": str(e),
            "total_time": time.time() - total_start
        }

def main():
    print("\n" + "="*80)
    print("🚀 DINO-X Full Pipeline Test (Using Pre-Uploaded Images)")
    print("="*80)
    print(f"\nTesting {len(TEST_IMAGES)} images through complete pipeline:")
    print("  1. DINO-X detection")
    print("  2. Item cropping")
    print("  3. Product search (Serper)")
    print("  4. GPT-4 Turbo product selection")
    
    # Create results directory
    RESULTS_DIR.mkdir(exist_ok=True)
    
    all_results = []
    
    # Process each test image
    for image_info in TEST_IMAGES:
        # Test with DINO-X
        result = test_full_pipeline(image_info, use_dinox=True)
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
        print(f"   Analysis (DINO-X + Crop): {avg_analyze:.2f}s")
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
            print(f"      Analysis: {timing['analyze']:.2f}s")
            print(f"      Search: {timing['search']:.2f}s")
            print(f"      Total: {timing['total']:.2f}s")
    
    if failed:
        print(f"\n❌ Failed images:")
        for r in failed:
            print(f"   - {r['image_name']}: {r.get('error', 'Unknown error')}")
    
    print(f"\n💾 Results saved to: {output_file}")
    print(f"\n🎯 Key Question: Are DINO-X captions good enough for product search?")
    print(f"    Review the search results to compare quality!")
    
    return summary

if __name__ == "__main__":
    main()

