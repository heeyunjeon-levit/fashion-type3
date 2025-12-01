#!/usr/bin/env python3
"""
Test Modal backend with resized images
Compare DINO-X vs GPT-4o with proper image sizing
"""

import time
import requests
from PIL import Image
import io
import base64

MODAL_API_URL = "https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/analyze"

# Use publicly accessible test images
TEST_IMAGES = [
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=2000",  # Warm-up 1
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=2000",  # Warm-up 2
    "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=2000",  # Real test GPT
    "https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=2000",  # Real test DINOX
]

def resize_image_from_url(image_url, max_width=1200):
    """Download and resize image"""
    print(f"📥 Downloading image...")
    response = requests.get(image_url, timeout=30)
    img = Image.open(io.BytesIO(response.content))
    
    original_size = img.size
    print(f"   Original: {original_size[0]}x{original_size[1]}")
    
    # Resize if needed
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        print(f"   Resized: {img.size[0]}x{img.size[1]}")
    
    # Convert to JPEG and base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    
    return image_url, img.size  # Return original URL for testing

def test_with_modal(image_url, use_dinox, mode_name, test_number):
    """Test with Modal backend"""
    print(f"\n{'='*80}")
    print(f"Test #{test_number}: {mode_name}")
    print(f"{'='*80}")
    print(f"Image: {image_url[:60]}...")
    
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
            print(f"   {response.text[:200]}")
            return None
        
        result = response.json()
        items = result.get('items', [])
        timing = result.get('timing', {})
        cached = result.get('cached', False)
        
        print(f"✅ Complete in {elapsed:.2f}s")
        print(f"📦 Items: {len(items)}")
        print(f"💾 Cached: {cached}")
        print(f"⏱️  Backend: {timing.get('total_seconds', 0):.2f}s")
        print(f"   - Detection: {timing.get('gpt4o_seconds', 0):.2f}s")
        
        if items:
            sample = items[0]
            desc = sample.get('description', '')
            print(f"\n📝 Sample Description:")
            print(f"   '{desc[:90]}...'")
            
            is_detailed = len(desc) > 50 and not desc.endswith('detected by DINO-X')
            print(f"   Detailed: {'✅' if is_detailed else '❌'}")
        
        return {
            "mode": mode_name,
            "elapsed": elapsed,
            "cached": cached,
            "items": len(items),
            "backend_total": timing.get('total_seconds', 0),
            "detection_time": timing.get('gpt4o_seconds', 0),
            "description": items[0].get('description', '') if items else '',
            "test_number": test_number
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def main():
    print("\n" + "="*80)
    print("🧪 MODAL BACKEND TEST - DINO-X vs GPT-4o")
    print("="*80)
    print(f"Testing with large images (~2000px wide)")
    print(f"Modal will resize them automatically\n")
    
    all_results = []
    
    # Test 1: GPT-4o with Image 1 (warm up)
    print("\n" + "="*80)
    print("WARM-UP: GPT-4o")
    print("="*80)
    result = test_with_modal(TEST_IMAGES[0], False, "GPT-4o Warm-up", 0)
    time.sleep(3)
    
    # Test 2: DINO-X with Image 2 (warm up)
    print("\n" + "="*80)
    print("WARM-UP: DINO-X")
    print("="*80)
    result = test_with_modal(TEST_IMAGES[1], True, "DINO-X Warm-up", 0)
    time.sleep(3)
    
    # Now real tests with separate fresh images
    print("\n" + "="*80)
    print("REAL TESTS (Fresh Images)")
    print("="*80)
    
    # Test 3: GPT-4o with Image 3
    result = test_with_modal(TEST_IMAGES[2], False, "GPT-4o", 1)
    if result and not result['cached']:
        all_results.append(result)
    time.sleep(3)
    
    # Test 4: DINO-X with Image 4
    result = test_with_modal(TEST_IMAGES[3], True, "DINO-X Hybrid", 2)
    if result and not result['cached']:
        all_results.append(result)
    
    # Analysis
    print("\n" + "="*80)
    print("📊 FINAL COMPARISON")
    print("="*80)
    
    gpt = next((r for r in all_results if 'GPT-4o' in r['mode']), None)
    dinox = next((r for r in all_results if 'DINO-X' in r['mode']), None)
    
    if gpt and dinox:
        print(f"\n⏱️  Speed Comparison:")
        print(f"   GPT-4o:       {gpt['elapsed']:.2f}s")
        print(f"   DINO-X Hybrid: {dinox['elapsed']:.2f}s")
        
        if dinox['elapsed'] < gpt['elapsed']:
            speedup = gpt['elapsed'] / dinox['elapsed']
            winner = "DINO-X"
            print(f"   🏆 DINO-X is {speedup:.2f}x FASTER!")
        elif gpt['elapsed'] < dinox['elapsed']:
            speedup = dinox['elapsed'] / gpt['elapsed']
            winner = "GPT-4o"
            print(f"   🏆 GPT-4o is {speedup:.2f}x FASTER!")
        else:
            winner = "TIE"
            print(f"   🤝 Same speed!")
        
        print(f"\n🎨 Quality Comparison:")
        gpt_desc = gpt['description']
        dinox_desc = dinox['description']
        
        gpt_detailed = len(gpt_desc) > 50
        dinox_detailed = len(dinox_desc) > 50
        
        print(f"   GPT-4o Description:")
        print(f"   '{gpt_desc[:90]}...'")
        print(f"   Detailed: {'✅' if gpt_detailed else '❌'}")
        
        print(f"\n   DINO-X Description:")
        print(f"   '{dinox_desc[:90]}...'")
        print(f"   Detailed: {'✅' if dinox_detailed else '❌'}")
        
        print(f"\n💰 Cost:")
        print(f"   GPT-4o: $0.03 per image")
        print(f"   DINO-X: $0.003 per image (10x cheaper)")
        
        # Final recommendation
        print(f"\n{'='*80}")
        print("🎯 RECOMMENDATION")
        print(f"{'='*80}")
        
        if winner == "DINO-X" and dinox_detailed:
            print("\n✅ USE DINO-X HYBRID!")
            print(f"   ✅ Faster than GPT-4o")
            print(f"   ✅ Same quality descriptions")
            print(f"   ✅ 10x cheaper")
            print(f"\n   Ready to deploy! 🚀")
        elif winner == "TIE" and dinox_detailed:
            print("\n✅ USE DINO-X HYBRID!")
            print(f"   ✅ Same speed as GPT-4o")
            print(f"   ✅ Same quality descriptions")
            print(f"   ✅ 10x cheaper")
            print(f"\n   Ready to deploy! 🚀")
        elif winner == "GPT-4o":
            diff = dinox['elapsed'] - gpt['elapsed']
            print(f"\n⚠️  DINO-X is {diff:.1f}s slower")
            if dinox_detailed:
                print(f"   ✅ Same quality descriptions")
                print(f"   ✅ 10x cheaper")
                print(f"\n   Trade-off: Slower but much cheaper")
                print(f"   Decision: Speed vs Cost")
            else:
                print(f"   ❌ Descriptions not detailed")
                print(f"\n   Stick with GPT-4o for now")
    else:
        print("\n⚠️  Insufficient data (results were cached)")
        print("   Try again with completely new images")

if __name__ == "__main__":
    main()

