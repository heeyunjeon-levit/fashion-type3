#!/usr/bin/env python3
"""
Test with fresh images (not cached)
"""

import json
import time
import requests

MODAL_API_URL = "https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/analyze"

# Different fashion images to avoid cache
TEST_IMAGES = [
    "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800",  # Fashion model
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800",  # Fashion outfit
]

def test_image(image_url, use_dinox, mode_name):
    """Test with a specific image"""
    print(f"\n{'='*80}")
    print(f"Testing {mode_name}")
    print(f"Image: {image_url[:50]}...")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    try:
        response = requests.post(
            MODAL_API_URL,
            json={
                "imageUrl": image_url,
                "use_dinox": use_dinox
            },
            timeout=120
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code != 200:
            print(f"❌ Failed: {response.status_code}")
            return None
        
        result = response.json()
        items = result.get('items', [])
        timing = result.get('timing', {})
        cached = result.get('cached', False)
        
        print(f"✅ Complete in {elapsed:.2f}s")
        print(f"📦 Items: {len(items)}")
        print(f"💾 Cached: {cached}")
        print(f"⏱️  Backend Total: {timing.get('total_seconds', 0):.2f}s")
        print(f"   - Detection: {timing.get('gpt4o_seconds', 0):.2f}s")
        print(f"   - Cropping: {timing.get('groundingdino_seconds', 0):.2f}s")
        
        if items:
            print(f"\n📝 Sample Item:")
            item = items[0]
            desc = item.get('description', 'N/A')
            print(f"   {desc[:80]}...")
        
        return {
            "mode": mode_name,
            "elapsed": elapsed,
            "cached": cached,
            "items": len(items),
            "backend_total": timing.get('total_seconds', 0),
            "detection_time": timing.get('gpt4o_seconds', 0),
            "description": items[0].get('description', '') if items else ''
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def main():
    print("\n" + "="*80)
    print("🧪 FRESH IMAGE TEST - DINO-X vs GPT-4o")
    print("="*80)
    
    results = []
    
    # Test Image 1 with GPT-4o
    result = test_image(TEST_IMAGES[0], False, "GPT-4o (Image 1)")
    if result:
        results.append(result)
    time.sleep(3)
    
    # Test Image 2 with DINO-X
    result = test_image(TEST_IMAGES[1], True, "DINO-X (Image 2)")
    if result:
        results.append(result)
    
    # Analysis
    print("\n" + "="*80)
    print("📊 COMPARISON")
    print("="*80)
    
    non_cached = [r for r in results if not r['cached']]
    
    if len(non_cached) >= 2:
        gpt = next((r for r in non_cached if 'GPT-4o' in r['mode']), None)
        dinox = next((r for r in non_cached if 'DINO-X' in r['mode']), None)
        
        if gpt and dinox:
            print(f"\n⏱️  Speed:")
            print(f"   GPT-4o: {gpt['elapsed']:.2f}s")
            print(f"   DINO-X: {dinox['elapsed']:.2f}s")
            
            if dinox['elapsed'] < gpt['elapsed']:
                speedup = gpt['elapsed'] / dinox['elapsed']
                print(f"   🏆 DINO-X is {speedup:.2f}x faster!")
            else:
                speedup = dinox['elapsed'] / gpt['elapsed']
                print(f"   🏆 GPT-4o is {speedup:.2f}x faster!")
            
            print(f"\n🎨 Description Quality:")
            gpt_detailed = len(gpt['description']) > 50
            dinox_detailed = len(dinox['description']) > 50
            
            print(f"   GPT-4o: {'✅ Detailed' if gpt_detailed else '❌ Generic'}")
            print(f"   DINO-X: {'✅ Detailed' if dinox_detailed else '❌ Generic'}")
    else:
        print("\n⚠️  All cached or insufficient data")
        print("Try with completely new images")
    
    # Save
    with open('/Users/levit/Desktop/mvp/brands_results/fresh_test.json', 'w') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    main()







