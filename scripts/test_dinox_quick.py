#!/usr/bin/env python3
"""
Quick test of DINO-X integration
Tests 3-5 images to verify it works before full batch
"""

import os
import sys
import time
import json
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set DINO-X mode
os.environ['USE_DINOX'] = 'true'

# Import after setting env var
from python_backend.src.analyzers.dinox_analyzer import analyze_image_with_dinox

# Test images from brands directory
TEST_IMAGES = [
    "/Users/levit/Desktop/brands/0214d4bd3a05-IMG_6128 복사본.png",  # Houndstooth bag
    "/Users/levit/Desktop/brands/d6459f83273f-IMG_3268 복사본.png",  # Luggage
]

# Upload test images to Supabase (already uploaded from previous tests)
TEST_IMAGE_URLS = [
    "https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1763748884783_0214d4bd3a05-IMG_6128_.jpg",
    "https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1763748940459_d6459f83273f-IMG_3268_.jpg"
]

def main():
    """Quick DINO-X integration test"""
    print(f"{'='*80}")
    print(f"DINO-X INTEGRATION TEST")
    print(f"{'='*80}")
    print(f"Testing {len(TEST_IMAGE_URLS)} images\n")
    
    all_results = []
    
    for idx, image_url in enumerate(TEST_IMAGE_URLS, 1):
        print(f"\n{'='*80}")
        print(f"IMAGE {idx}/{len(TEST_IMAGE_URLS)}")
        print(f"{'='*80}")
        print(f"URL: {image_url[:70]}...")
        
        try:
            result = analyze_image_with_dinox(image_url)
            all_results.append(result)
            
            print(f"\n✅ Analysis complete!")
            print(f"   Detector: {result['meta']['detector']}")
            print(f"   Time: {result['meta']['processing_time']}s")
            print(f"   Detections: {result['meta']['num_detections']}")
            
            print(f"\n📦 Items:")
            for item in result['items']:
                print(f"   - {item['category']}: {item['description']}")
                print(f"     BBox: {item.get('bbox', 'N/A')}")
                print(f"     Confidence: {item.get('confidence', 0):.2f}")
                
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
            all_results.append({'error': str(e)})
        
        if idx < len(TEST_IMAGE_URLS):
            print(f"\n⏸️  Waiting 2s...")
            time.sleep(2)
    
    # Summary
    print(f"\n{'='*80}")
    print(f"TEST SUMMARY")
    print(f"{'='*80}")
    
    successful = sum(1 for r in all_results if 'items' in r)
    failed = len(all_results) - successful
    
    print(f"✅ Successful: {successful}/{len(TEST_IMAGE_URLS)}")
    print(f"❌ Failed: {failed}/{len(TEST_IMAGE_URLS)}")
    
    if successful > 0:
        avg_time = sum(r['meta']['processing_time'] for r in all_results if 'meta' in r) / successful
        avg_detections = sum(r['meta']['num_detections'] for r in all_results if 'meta' in r) / successful
        
        print(f"\n⏱️  Average time: {avg_time:.2f}s")
        print(f"📦 Average detections: {avg_detections:.1f}")
        print(f"\n💡 DINO-X is ready for full batch testing!")
    else:
        print(f"\n⚠️  DINO-X integration has issues. Check errors above.")
    
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()

