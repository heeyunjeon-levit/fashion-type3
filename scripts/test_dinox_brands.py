#!/usr/bin/env python3
"""
Test DINO-X detection on a few brand images
Compare speed and quality with GPT-4o results
"""

import os
import sys
import json
import time
from datetime import datetime
from pathlib import Path

# Add python_backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "python_backend"))

from src.analyzers.dinox_analyzer import DINOXAnalyzer
from src.analyzers.gpt4o_analyzer import GPT4OFashionAnalyzer

# Configuration
BRANDS_DIR = Path("/Users/levit/Desktop/brands")
RESULTS_DIR = Path("/Users/levit/Desktop/mvp/brands_results")

# Test images - selecting a diverse set
TEST_IMAGES = [
    "5d96eff1ccb9-IMG_1740 복사본.png",  # Previously had good results
    "0214d4bd3a05-IMG_6128 복사본.png",  # The one that failed before
    "9c9b7d5f941e-IMG_7594 복사본.png",  # Another one to test
]

def test_image_with_analyzer(image_path, analyzer_name, analyzer):
    """Test image with a specific analyzer"""
    print(f"\n{'='*80}")
    print(f"Testing: {image_path.name} with {analyzer_name}")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    try:
        # Analyze image
        print(f"🔍 Running {analyzer_name} detection...")
        result = analyzer.analyze_fashion_items(str(image_path))
        
        detection_time = time.time() - start_time
        
        if result and 'items' in result:
            items = result.get('items', [])
            print(f"\n✅ Detection completed in {detection_time:.2f}s")
            print(f"\n📊 Results:")
            print(f"   Total items detected: {len(items)}")
            
            for i, item in enumerate(items, 1):
                print(f"\n   Item {i}:")
                print(f"      Category: {item.get('category', 'unknown')}")
                print(f"      Prompt: {item.get('groundingdino_prompt', 'N/A')}")
                print(f"      Description: {item.get('description', 'N/A')[:100]}...")
                if 'confidence' in item:
                    print(f"      Confidence: {item.get('confidence', 0):.2f}")
            
            return {
                "success": True,
                "analyzer": analyzer_name,
                "image_name": image_path.name,
                "detection_time": detection_time,
                "items_detected": len(items),
                "items": items
            }
        else:
            print(f"\n❌ Detection returned no results")
            return {
                "success": False,
                "analyzer": analyzer_name,
                "image_name": image_path.name,
                "error": "No items detected",
                "detection_time": detection_time
            }
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "analyzer": analyzer_name,
            "image_name": image_path.name,
            "error": str(e),
            "detection_time": time.time() - start_time
        }

def main():
    print("\n" + "="*80)
    print("🚀 DINO-X vs GPT-4o Comparison Test")
    print("="*80)
    print(f"\nTesting {len(TEST_IMAGES)} images with both analyzers")
    
    # Create results directory
    RESULTS_DIR.mkdir(exist_ok=True)
    
    # Initialize analyzers
    print("\n🔧 Initializing analyzers...")
    try:
        dinox_analyzer = DINOXAnalyzer()
        print("✅ DINO-X analyzer initialized")
    except Exception as e:
        print(f"❌ Failed to initialize DINO-X: {e}")
        dinox_analyzer = None
    
    try:
        gpt_analyzer = GPT4OFashionAnalyzer()
        print("✅ GPT-4o analyzer initialized")
    except Exception as e:
        print(f"❌ Failed to initialize GPT-4o: {e}")
        gpt_analyzer = None
    
    if not dinox_analyzer and not gpt_analyzer:
        print("\n❌ No analyzers available!")
        return
    
    all_results = []
    
    # Process each test image
    for image_name in TEST_IMAGES:
        image_path = BRANDS_DIR / image_name
        
        if not image_path.exists():
            print(f"\n⚠️ Image not found: {image_name}")
            continue
        
        image_results = {"image": image_name, "results": []}
        
        # Test with DINO-X
        if dinox_analyzer:
            result = test_image_with_analyzer(image_path, "DINO-X", dinox_analyzer)
            image_results["results"].append(result)
            time.sleep(2)  # Brief pause between tests
        
        # Test with GPT-4o
        if gpt_analyzer:
            result = test_image_with_analyzer(image_path, "GPT-4o", gpt_analyzer)
            image_results["results"].append(result)
            time.sleep(2)  # Brief pause between tests
        
        all_results.append(image_results)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = RESULTS_DIR / f"dinox_comparison_{timestamp}.json"
    
    summary = {
        "timestamp": timestamp,
        "total_images": len(TEST_IMAGES),
        "results": all_results
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    # Print comparison summary
    print("\n" + "="*80)
    print("📊 COMPARISON SUMMARY")
    print("="*80)
    
    dinox_results = [r for img in all_results for r in img["results"] if r.get("analyzer") == "DINO-X"]
    gpt_results = [r for img in all_results for r in img["results"] if r.get("analyzer") == "GPT-4o"]
    
    if dinox_results:
        dinox_success = [r for r in dinox_results if r['success']]
        print(f"\n🚀 DINO-X:")
        print(f"   Success rate: {len(dinox_success)}/{len(dinox_results)}")
        if dinox_success:
            avg_time = sum(r['detection_time'] for r in dinox_success) / len(dinox_success)
            avg_items = sum(r['items_detected'] for r in dinox_success) / len(dinox_success)
            print(f"   Average time: {avg_time:.2f}s")
            print(f"   Average items: {avg_items:.1f}")
    
    if gpt_results:
        gpt_success = [r for r in gpt_results if r['success']]
        print(f"\n🧠 GPT-4o:")
        print(f"   Success rate: {len(gpt_success)}/{len(gpt_results)}")
        if gpt_success:
            avg_time = sum(r['detection_time'] for r in gpt_success) / len(gpt_success)
            avg_items = sum(r['items_detected'] for r in gpt_success) / len(gpt_success)
            print(f"   Average time: {avg_time:.2f}s")
            print(f"   Average items: {avg_items:.1f}")
    
    # Speed comparison
    if dinox_results and gpt_results:
        dinox_avg = sum(r['detection_time'] for r in dinox_results if r['success']) / max(1, len([r for r in dinox_results if r['success']]))
        gpt_avg = sum(r['detection_time'] for r in gpt_results if r['success']) / max(1, len([r for r in gpt_results if r['success']]))
        
        if gpt_avg > 0:
            speedup = gpt_avg / dinox_avg
            print(f"\n⚡ Speed Comparison:")
            print(f"   DINO-X is {speedup:.1f}x faster than GPT-4o")
    
    print(f"\n💾 Results saved to: {output_file}")
    
    return summary

if __name__ == "__main__":
    main()
