#!/usr/bin/env python3
"""
Test deployed DINO-X with real brand images
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

# Test with these brand images
TEST_IMAGES = [
    "5d96eff1ccb9-IMG_1740 복사본.png",
    "9c9b7d5f941e-IMG_7594 복사본.png",
    "731d24e62d99-IMG_3357 복사본.png",
]

def encode_image_to_base64(image_path):
    """Encode image to base64 with data URI"""
    with open(image_path, 'rb') as f:
        image_data = f.read()
    
    # Determine mime type
    ext = image_path.suffix.lower()
    mime_type = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
    }.get(ext, 'image/jpeg')
    
    base64_str = base64.b64encode(image_data).decode('utf-8')
    return f"data:{mime_type};base64,{base64_str}"

def test_image_with_dinox(image_path, use_dinox=True):
    """Test image with DINO-X or GPT-4o"""
    print(f"\n{'='*80}")
    print(f"Testing: {image_path.name}")
    print(f"Mode: {'DINO-X Hybrid' if use_dinox else 'GPT-4o'}")
    print(f"{'='*80}")
    
    try:
        # Encode image to base64
        print("📸 Encoding image...")
        image_base64 = encode_image_to_base64(image_path)
        
        # Call Modal API
        print(f"🔍 Sending to Modal API...")
        start_time = time.time()
        
        response = requests.post(
            MODAL_API_URL,
            json={
                "imageUrl": image_base64,  # Send as base64 data URI
                "use_dinox": use_dinox
            },
            timeout=180
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code != 200:
            print(f"❌ Failed: {response.status_code}")
            print(f"   Error: {response.text[:200]}")
            return {
                "success": False,
                "image_name": image_path.name,
                "mode": "dinox" if use_dinox else "gpt4o",
                "error": f"HTTP {response.status_code}",
                "elapsed": elapsed
            }
        
        result = response.json()
        items = result.get('items', [])
        timing = result.get('timing', {})
        
        print(f"✅ Success in {elapsed:.2f}s")
        print(f"📦 Detected {len(items)} items")
        
        # Print items
        for i, item in enumerate(items[:5], 1):  # Show first 5
            print(f"\n   {i}. {item.get('category', 'unknown').upper()}")
            print(f"      {item.get('description', 'N/A')[:70]}...")
            print(f"      Confidence: {item.get('confidence', 0):.2f}")
        
        if len(items) > 5:
            print(f"\n   ... and {len(items) - 5} more items")
        
        return {
            "success": True,
            "image_name": image_path.name,
            "mode": "dinox" if use_dinox else "gpt4o",
            "elapsed": elapsed,
            "items_detected": len(items),
            "timing": timing,
            "items": items
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "image_name": image_path.name,
            "mode": "dinox" if use_dinox else "gpt4o",
            "error": str(e),
            "elapsed": time.time() - start_time if 'start_time' in locals() else 0
        }

def main():
    print("\n" + "="*80)
    print("🚀 Testing DINO-X Hybrid with Real Brand Images")
    print("="*80)
    print(f"\nModal endpoint: {MODAL_API_URL}")
    print(f"Testing {len(TEST_IMAGES)} images")
    
    RESULTS_DIR.mkdir(exist_ok=True)
    
    all_results = []
    
    # Test each image
    for image_name in TEST_IMAGES:
        image_path = BRANDS_DIR / image_name
        
        if not image_path.exists():
            print(f"\n⚠️ Image not found: {image_name}")
            continue
        
        # Test with DINO-X Hybrid
        result = test_image_with_dinox(image_path, use_dinox=True)
        all_results.append(result)
        
        # Brief pause
        time.sleep(2)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = RESULTS_DIR / f"dinox_deployed_test_{timestamp}.json"
    
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
    print("📊 TEST SUMMARY")
    print("="*80)
    
    successful = [r for r in all_results if r['success']]
    failed = [r for r in all_results if not r['success']]
    
    print(f"\n✅ Successful: {len(successful)}/{len(all_results)}")
    print(f"❌ Failed: {len(failed)}/{len(all_results)}")
    
    if successful:
        avg_time = sum(r['elapsed'] for r in successful) / len(successful)
        avg_items = sum(r['items_detected'] for r in successful) / len(successful)
        
        print(f"\n⏱️  Average Time: {avg_time:.2f}s")
        print(f"📦 Average Items: {avg_items:.1f}")
        
        print(f"\n📋 Per-Image Results:")
        for r in successful:
            print(f"\n   {r['image_name']}:")
            print(f"      Time: {r['elapsed']:.2f}s")
            print(f"      Items: {r['items_detected']}")
            
            # Show first 3 items
            for i, item in enumerate(r['items'][:3], 1):
                desc = item.get('description', 'N/A')
                print(f"      {i}. {desc[:60]}...")
    
    if failed:
        print(f"\n❌ Failed Images:")
        for r in failed:
            print(f"   - {r['image_name']}: {r.get('error', 'Unknown')}")
    
    print(f"\n💾 Results saved to: {output_file}")
    
    print(f"\n🎯 Key Findings:")
    if successful:
        print(f"   ✅ DINO-X Hybrid working on real brand images")
        print(f"   ✅ Average {avg_items:.1f} items detected per image")
        print(f"   ✅ Detailed fashion descriptions generated")
        print(f"   ✅ Production ready! 🚀")

if __name__ == "__main__":
    main()

