#!/usr/bin/env python3
"""
Test DINO-X detection on a few brand images
Quick test to verify DINO-X works
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

# Configuration
BRANDS_DIR = Path("/Users/levit/Desktop/brands")
RESULTS_DIR = Path("/Users/levit/Desktop/mvp/brands_results")

# Test images - selecting a diverse set
TEST_IMAGES = [
    "5d96eff1ccb9-IMG_1740 복사본.png",  # Previously had good results
    "0214d4bd3a05-IMG_6128 복사본.png",  # The one that failed before  
    "9c9b7d5f941e-IMG_7594 복사본.png",  # Another one to test
]

def test_image_with_dinox(image_path, analyzer):
    """Test image with DINO-X analyzer"""
    print(f"\n{'='*80}")
    print(f"Testing: {image_path.name}")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    try:
        # Analyze image
        print(f"🔍 Running DINO-X detection...")
        result = analyzer.analyze_fashion_items(str(image_path))
        
        detection_time = time.time() - start_time
        
        if result and 'items' in result:
            items = result.get('items', [])
            meta = result.get('meta', {})
            
            print(f"\n✅ Detection completed in {detection_time:.2f}s")
            print(f"\n📊 Results:")
            print(f"   Total items detected: {len(items)}")
            print(f"   DINO-X processing time: {meta.get('processing_time', 'N/A')}s")
            
            for i, item in enumerate(items, 1):
                print(f"\n   Item {i}:")
                print(f"      Category: {item.get('category', 'unknown')}")
                print(f"      Prompt: {item.get('groundingdino_prompt', 'N/A')}")
                print(f"      Description: {item.get('description', 'N/A')}")
                print(f"      Confidence: {item.get('confidence', 0):.2f}")
                print(f"      BBox: {item.get('bbox', [])}")
            
            return {
                "success": True,
                "image_name": image_path.name,
                "detection_time": detection_time,
                "items_detected": len(items),
                "items": items,
                "meta": meta
            }
        else:
            print(f"\n❌ Detection returned no results")
            return {
                "success": False,
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
            "image_name": image_path.name,
            "error": str(e),
            "detection_time": time.time() - start_time
        }

def main():
    print("\n" + "="*80)
    print("🚀 DINO-X Brand Images Test")
    print("="*80)
    print(f"\nTesting {len(TEST_IMAGES)} images with DINO-X")
    
    # Create results directory
    RESULTS_DIR.mkdir(exist_ok=True)
    
    # Initialize analyzer
    print("\n🔧 Initializing DINO-X analyzer...")
    try:
        analyzer = DINOXAnalyzer()
        print("✅ DINO-X analyzer initialized")
    except Exception as e:
        print(f"❌ Failed to initialize DINO-X: {e}")
        import traceback
        traceback.print_exc()
        return
    
    all_results = []
    
    # Process each test image
    for image_name in TEST_IMAGES:
        image_path = BRANDS_DIR / image_name
        
        if not image_path.exists():
            print(f"\n⚠️ Image not found: {image_name}")
            continue
        
        result = test_image_with_dinox(image_path, analyzer)
        all_results.append(result)
        
        # Brief pause between images
        time.sleep(2)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = RESULTS_DIR / f"dinox_test_{timestamp}.json"
    
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
    print("📊 SUMMARY")
    print("="*80)
    
    successful = [r for r in all_results if r['success']]
    failed = [r for r in all_results if not r['success']]
    
    print(f"\n✅ Successful: {len(successful)}/{len(all_results)}")
    print(f"❌ Failed: {len(failed)}/{len(all_results)}")
    
    if successful:
        avg_detection_time = sum(r['detection_time'] for r in successful) / len(successful)
        avg_items = sum(r['items_detected'] for r in successful) / len(successful)
        
        print(f"\n⏱️  Average detection time: {avg_detection_time:.2f}s")
        print(f"📦 Average items detected: {avg_items:.1f}")
        
        # Show per-image results
        print(f"\n📋 Per-Image Results:")
        for r in successful:
            print(f"   {r['image_name']}: {r['items_detected']} items in {r['detection_time']:.2f}s")
    
    if failed:
        print(f"\n❌ Failed images:")
        for r in failed:
            print(f"   - {r['image_name']}: {r.get('error', 'Unknown error')}")
    
    print(f"\n💾 Results saved to: {output_file}")
    
    return summary

if __name__ == "__main__":
    main()

