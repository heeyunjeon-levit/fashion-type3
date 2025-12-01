#!/usr/bin/env python3
"""
Proper DINO-X vs GPT-4o comparison test
Fair comparison with warm containers
"""

import json
import time
import requests

MODAL_API_URL = "https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/analyze"
TEST_IMAGE = "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800"

def warm_up_container(mode):
    """Warm up container by making a request"""
    print(f"🔥 Warming up {mode} container...")
    try:
        requests.post(
            MODAL_API_URL,
            json={
                "imageUrl": TEST_IMAGE,
                "use_dinox": (mode == "DINO-X")
            },
            timeout=120
        )
        print(f"   ✅ {mode} container warmed up")
    except:
        print(f"   ⚠️  {mode} warm-up failed (continuing anyway)")

def test_mode(mode, use_dinox, run_number):
    """Test a specific mode"""
    print(f"\n{'='*80}")
    print(f"Run #{run_number}: Testing {mode}")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    try:
        response = requests.post(
            MODAL_API_URL,
            json={
                "imageUrl": TEST_IMAGE,
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
        print(f"📦 Detected: {len(items)} items")
        print(f"💾 Cached: {cached}")
        
        if timing:
            print(f"\n⏱️  Backend Timing:")
            print(f"   Detection: {timing.get('gpt4o_seconds', 0):.2f}s")
            print(f"   Cropping: {timing.get('groundingdino_seconds', 0):.2f}s")
            print(f"   Total: {timing.get('total_seconds', 0):.2f}s")
        
        # Print first item details
        if items:
            item = items[0]
            print(f"\n📝 First Item:")
            print(f"   Category: {item.get('category', 'N/A')}")
            print(f"   Prompt: {item.get('groundingdino_prompt', 'N/A')}")
            print(f"   Description: {item.get('description', 'N/A')}")
            print(f"   Confidence: {item.get('confidence', 0):.2f}")
        
        return {
            "mode": mode,
            "elapsed": elapsed,
            "cached": cached,
            "items_count": len(items),
            "timing": timing,
            "items": items,
            "run_number": run_number
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def main():
    print("\n" + "="*80)
    print("🧪 PROPER DINO-X VS GPT-4O COMPARISON TEST")
    print("="*80)
    print(f"\nTest image: {TEST_IMAGE}")
    print(f"Modal endpoint: {MODAL_API_URL}\n")
    
    # Warm up both containers
    print("Step 1: Warming up containers (to ensure fair comparison)")
    print("-" * 80)
    warm_up_container("GPT-4o")
    time.sleep(2)
    warm_up_container("DINO-X")
    time.sleep(3)
    
    print("\n" + "="*80)
    print("Step 2: Running Fair Comparison (3 runs each)")
    print("="*80)
    
    all_results = []
    
    # Run 3 tests for each mode (warm containers)
    for run in range(1, 4):
        print(f"\n{'='*80}")
        print(f"ROUND {run}")
        print(f"{'='*80}")
        
        # Test GPT-4o
        gpt_result = test_mode("GPT-4o", False, run)
        if gpt_result:
            all_results.append(gpt_result)
        time.sleep(2)
        
        # Test DINO-X
        dinox_result = test_mode("DINO-X Hybrid", True, run)
        if dinox_result:
            all_results.append(dinox_result)
        time.sleep(2)
    
    # Analysis
    print("\n" + "="*80)
    print("📊 ANALYSIS")
    print("="*80)
    
    gpt_results = [r for r in all_results if r['mode'] == 'GPT-4o' and not r['cached']]
    dinox_results = [r for r in all_results if r['mode'] == 'DINO-X Hybrid' and not r['cached']]
    
    if gpt_results and dinox_results:
        gpt_avg = sum(r['elapsed'] for r in gpt_results) / len(gpt_results)
        dinox_avg = sum(r['elapsed'] for r in dinox_results) / len(dinox_results)
        
        print(f"\n⏱️  Speed (Non-Cached):")
        print(f"   GPT-4o: {gpt_avg:.2f}s average ({len(gpt_results)} runs)")
        print(f"   DINO-X: {dinox_avg:.2f}s average ({len(dinox_results)} runs)")
        
        if gpt_avg > dinox_avg:
            speedup = gpt_avg / dinox_avg
            print(f"   🏆 DINO-X is {speedup:.2f}x FASTER")
        else:
            speedup = dinox_avg / gpt_avg
            print(f"   🏆 GPT-4o is {speedup:.2f}x FASTER")
    
    # Quality comparison
    print(f"\n🎨 Quality Comparison:")
    
    gpt_sample = next((r for r in all_results if r['mode'] == 'GPT-4o' and r['items']), None)
    dinox_sample = next((r for r in all_results if r['mode'] == 'DINO-X Hybrid' and r['items']), None)
    
    if gpt_sample and dinox_sample:
        print(f"\n   GPT-4o Description:")
        if gpt_sample['items']:
            desc = gpt_sample['items'][0].get('description', 'N/A')
            print(f"   '{desc}'")
        
        print(f"\n   DINO-X Hybrid Description:")
        if dinox_sample['items']:
            desc = dinox_sample['items'][0].get('description', 'N/A')
            print(f"   '{desc}'")
        
        # Check if descriptions are detailed
        gpt_desc = gpt_sample['items'][0].get('description', '') if gpt_sample['items'] else ''
        dinox_desc = dinox_sample['items'][0].get('description', '') if dinox_sample['items'] else ''
        
        gpt_detailed = len(gpt_desc) > 50 and not gpt_desc.endswith('detected by DINO-X')
        dinox_detailed = len(dinox_desc) > 50 and not dinox_desc.endswith('detected by DINO-X')
        
        print(f"\n   GPT-4o Detailed: {'✅ Yes' if gpt_detailed else '❌ No'}")
        print(f"   DINO-X Detailed: {'✅ Yes' if dinox_detailed else '❌ No'}")
        
        if dinox_detailed:
            print(f"\n   🎉 GPT-4o-mini descriptions ARE working!")
        else:
            print(f"\n   ⚠️  GPT-4o-mini descriptions NOT working (generic descriptions)")
    
    # Cost comparison
    print(f"\n💰 Cost Comparison:")
    print(f"   GPT-4o: ~$0.03 per image")
    print(f"   DINO-X Hybrid: ~$0.003 per image")
    print(f"   Potential Savings: 10x cheaper")
    
    # Final recommendation
    print(f"\n{'='*80}")
    print("🎯 RECOMMENDATION")
    print("="*80)
    
    if dinox_results and gpt_results:
        if dinox_avg < gpt_avg and dinox_detailed:
            print("\n✅ USE DINO-X HYBRID")
            print(f"   - {speedup:.1f}x faster")
            print(f"   - 10x cheaper")
            print(f"   - Same quality descriptions")
        elif dinox_avg < gpt_avg and not dinox_detailed:
            print("\n⚠️  DINO-X IS FASTER but GPT-4o-mini not working")
            print(f"   - Need to fix GPT-4o-mini descriptions first")
            print(f"   - Stick with GPT-4o for now")
        else:
            print("\n🤔 MIXED RESULTS")
            print(f"   - Review the data above")
            print(f"   - Consider A/B testing")
    
    # Save results
    with open('/Users/levit/Desktop/mvp/brands_results/proper_comparison.json', 'w') as f:
        json.dump(all_results, f, indent=2)
    
    print(f"\n💾 Full results saved to: brands_results/proper_comparison.json")

if __name__ == "__main__":
    main()





