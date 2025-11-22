#!/usr/bin/env python3
"""
Test DINO-X-1.0 using the official dds-cloudapi-sdk
Compare with GPT-4o detection for speed and quality
"""

import os
import sys
import time
import json
from datetime import datetime

# Check if SDK is installed
try:
    from dds_cloudapi_sdk import Config, Client, DetectionTask, TextPrompt
    SDK_INSTALLED = True
except ImportError:
    print("⚠️  dds-cloudapi-sdk not installed!")
    print("   Install with: pip install dds-cloudapi-sdk")
    SDK_INSTALLED = False

# Configuration
# TODO: Set your API token here or as environment variable
API_TOKEN = os.environ.get('DDS_API_TOKEN', 'YOUR_API_TOKEN_HERE')

TEST_IMAGES = [
    "/Users/levit/Desktop/brands/0214d4bd3a05-IMG_6128 복사본.png",  # Houndstooth bag
    "/Users/levit/Desktop/brands/d6459f83273f-IMG_3268 복사본.png",  # Luggage
]

# Fashion categories (same as GroundingDINO)
FASHION_PROMPT = "shirt. jacket. blouse. button up shirt. vest. skirt. shorts. pants. shoes. bag. dress. coat. sweater. cardigan. hoodie. jeans. leggings. sneakers. boots. sandals. backpack. purse. handbag. hat. cap. scarf. belt. watch. sunglasses. jewelry. necklace. bracelet. earrings. ring"

def test_dinox_detection(image_path):
    """
    Test DINO-X-1.0 detection on an image
    
    Returns:
        dict: Results including timing, detections, and captions
    """
    print(f"\n{'='*80}")
    print(f"Testing DINO-X-1.0: {os.path.basename(image_path)}")
    print(f"{'='*80}")
    
    if not SDK_INSTALLED:
        return {
            'success': False,
            'error': 'SDK not installed',
            'image_path': image_path
        }
    
    if API_TOKEN == 'YOUR_API_TOKEN_HERE':
        return {
            'success': False,
            'error': 'API token not configured',
            'image_path': image_path,
            'instructions': 'Set DDS_API_TOKEN environment variable or edit the script'
        }
    
    start_time = time.time()
    
    try:
        # Initialize client
        print("🔧 Initializing DINO-X client...")
        config = Config(API_TOKEN)
        client = Client(config)
        
        # Create detection task
        print("📸 Creating detection task...")
        print(f"   Prompt: {FASHION_PROMPT[:50]}...")
        
        task = DetectionTask(
            image_url=image_path,  # Can be local path or URL
            prompts=[TextPrompt(text=FASHION_PROMPT)]
        )
        
        # Run detection
        print("🚀 Running DINO-X-1.0 detection...")
        client.run_task(task)
        
        # Get results
        result = task.result
        
        elapsed = time.time() - start_time
        
        print(f"✅ Detection complete! ({elapsed:.2f}s)")
        
        # Parse detections
        detections = []
        if hasattr(result, 'objects'):
            print(f"\n📦 Detected {len(result.objects)} objects:")
            for idx, obj in enumerate(result.objects):
                detection = {
                    'index': idx + 1,
                    'bbox': obj.bbox if hasattr(obj, 'bbox') else None,
                    'category': obj.category if hasattr(obj, 'category') else None,
                    'caption': obj.caption if hasattr(obj, 'caption') else None,
                    'confidence': obj.score if hasattr(obj, 'score') else None
                }
                detections.append(detection)
                
                print(f"   {idx + 1}. {detection['category']}")
                if detection['caption']:
                    print(f"      Caption: {detection['caption'][:80]}")
                if detection['confidence']:
                    print(f"      Confidence: {detection['confidence']:.2f}")
        
        return {
            'success': True,
            'elapsed_time': elapsed,
            'detections': detections,
            'num_detections': len(detections),
            'image_path': image_path,
            'raw_result': str(result)[:500]  # First 500 chars
        }
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ Error: {e}")
        return {
            'success': False,
            'elapsed_time': elapsed,
            'error': str(e),
            'image_path': image_path
        }

def compare_with_gpt4o(dinox_result):
    """Show comparison with GPT-4o"""
    print(f"\n{'='*80}")
    print(f"COMPARISON WITH GPT-4o")
    print(f"{'='*80}")
    
    if dinox_result['success']:
        print(f"\n🤖 DINO-X-1.0:")
        print(f"   ⏱️  Time: {dinox_result['elapsed_time']:.2f}s")
        print(f"   📦 Detections: {dinox_result['num_detections']}")
        
        # Show first few detections with captions
        for det in dinox_result['detections'][:3]:
            print(f"\n   {det['index']}. {det['category']}")
            if det['caption']:
                print(f"      📝 Caption: {det['caption']}")
    else:
        print(f"\n❌ DINO-X failed: {dinox_result.get('error')}")
    
    print(f"\n🧠 GPT-4o (current system):")
    print(f"   ⏱️  Time: ~10-20s (typical)")
    print(f"   📦 Detections: Varies")
    print(f"   📝 Descriptions: High quality, context-aware")
    
    print(f"\n💡 SPEED COMPARISON:")
    if dinox_result['success']:
        dino_time = dinox_result['elapsed_time']
        gpt_time = 15  # Average GPT-4o time
        if dino_time < gpt_time:
            print(f"   ✅ DINO-X is FASTER: {dino_time:.1f}s vs {gpt_time:.1f}s")
            print(f"   💰 Savings: {gpt_time - dino_time:.1f}s per image")
        else:
            print(f"   ⚠️  DINO-X is slower: {dino_time:.1f}s vs {gpt_time:.1f}s")

def main():
    """Run DINO-X SDK test"""
    print(f"{'='*80}")
    print(f"DINO-X-1.0 SDK TEST")
    print(f"{'='*80}")
    
    if not SDK_INSTALLED:
        print("\n❌ Cannot proceed without SDK")
        print("\n📦 Installation steps:")
        print("   1. Run: pip install dds-cloudapi-sdk")
        print("   2. Register at: https://cloud.deepdataspace.com")
        print("   3. Get your API token")
        print("   4. Set environment variable: export DDS_API_TOKEN='your_token'")
        print("   5. Run this script again")
        return
    
    if API_TOKEN == 'YOUR_API_TOKEN_HERE':
        print("\n⚠️  API Token not configured!")
        print("\n🔑 Setup steps:")
        print("   1. Register at: https://cloud.deepdataspace.com")
        print("   2. Get your API token from the dashboard")
        print("   3. Set it: export DDS_API_TOKEN='your_token'")
        print("   4. Or edit this script and replace YOUR_API_TOKEN_HERE")
        return
    
    print(f"\n✅ SDK installed")
    print(f"✅ API token configured")
    print(f"📸 Testing {len(TEST_IMAGES)} images\n")
    
    all_results = []
    
    for idx, image_path in enumerate(TEST_IMAGES, 1):
        if not os.path.exists(image_path):
            print(f"❌ Image not found: {image_path}")
            continue
        
        # Test DINO-X
        result = test_dinox_detection(image_path)
        all_results.append(result)
        
        # Show comparison
        compare_with_gpt4o(result)
        
        if idx < len(TEST_IMAGES):
            print(f"\n⏸️  Waiting 2s...")
            time.sleep(2)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"/Users/levit/Desktop/mvp/brands_results/dinox_sdk_test_{timestamp}.json"
    
    summary = {
        'timestamp': datetime.now().isoformat(),
        'sdk_version': 'dds-cloudapi-sdk',
        'fashion_prompt': FASHION_PROMPT,
        'total_tests': len(TEST_IMAGES),
        'successful': sum(1 for r in all_results if r['success']),
        'failed': sum(1 for r in all_results if not r['success']),
        'results': all_results
    }
    
    if summary['successful'] > 0:
        avg_time = sum(r['elapsed_time'] for r in all_results if r['success']) / summary['successful']
        summary['avg_time'] = avg_time
        avg_detections = sum(r['num_detections'] for r in all_results if r['success']) / summary['successful']
        summary['avg_detections'] = avg_detections
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    # Final summary
    print(f"\n{'='*80}")
    print(f"TEST COMPLETE!")
    print(f"{'='*80}")
    print(f"✅ Successful: {summary['successful']}/{len(TEST_IMAGES)}")
    print(f"❌ Failed: {summary['failed']}/{len(TEST_IMAGES)}")
    
    if summary['successful'] > 0:
        print(f"⏱️  Average time: {summary['avg_time']:.2f}s")
        print(f"📦 Average detections: {summary['avg_detections']:.1f}")
        print(f"\n💡 Next: Compare caption quality with GPT-4o descriptions")
    
    print(f"💾 Results saved to: {results_file}")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()

