#!/usr/bin/env python3
"""
Test DINO-X-1.0 API for object detection
Compare with GPT-4o for speed and quality
"""

import os
import sys
import time
import json
import base64
import requests
from datetime import datetime

# Configuration
API_URL = 'https://cloud.deepdataspace.com/api/v1/dino-x/detect'
API_TOKEN = 'bdf2ed490ebe69a28be81ea9d9b0b0e3'

TEST_IMAGES = [
    "/Users/levit/Desktop/brands/0214d4bd3a05-IMG_6128 복사본.png",  # Houndstooth bag
    "/Users/levit/Desktop/brands/d6459f83273f-IMG_3268 복사본.png",  # Luggage
]

# Fashion categories prompt
FASHION_PROMPT = "shirt. jacket. blouse. button up shirt. vest. skirt. shorts. pants. shoes. bag. dress. coat. sweater. cardigan. hoodie. jeans. leggings. sneakers. boots. sandals. backpack. purse. handbag. hat. cap. scarf. belt. watch. sunglasses. jewelry. necklace. bracelet. earrings. ring"

def image_to_base64(image_path):
    """Convert image to base64 data URI"""
    with open(image_path, 'rb') as f:
        image_data = f.read()
    
    # Determine image type
    ext = os.path.splitext(image_path)[1].lower()
    mime_type = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
    }.get(ext, 'image/jpeg')
    
    base64_data = base64.b64encode(image_data).decode('utf-8')
    return f"data:{mime_type};base64,{base64_data}"

def test_dinox_detection(image_path):
    """
    Test DINO-X-1.0 detection on an image
    
    Returns:
        dict: Results including timing, detections, and captions
    """
    print(f"\n{'='*80}")
    print(f"Testing DINO-X-1.0: {os.path.basename(image_path)}")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    try:
        # Convert image to base64
        print("📸 Converting image to base64...")
        base64_image = image_to_base64(image_path)
        print(f"   Size: {len(base64_image)} characters")
        
        # Prepare payload
        payload = {
            'model': 'DINO-X-1.0',
            'image': base64_image,
            'prompt': {
                'type': 'text',
                'text': FASHION_PROMPT
            }
        }
        
        # Prepare headers
        headers = {
            'Authorization': f'Bearer {API_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        print(f"🚀 Calling DINO-X-1.0 API...")
        print(f"   Endpoint: {API_URL}")
        print(f"   Prompt: {FASHION_PROMPT[:50]}...")
        
        # Make API call
        response = requests.post(
            API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            print(f"✅ Success! ({elapsed:.2f}s)")
            result = response.json()
            
            # Parse detections
            detections = []
            num_objects = 0
            
            # Try to parse the response structure
            if isinstance(result, dict):
                # Look for common keys
                if 'objects' in result:
                    objects = result['objects']
                    num_objects = len(objects)
                    print(f"\n📦 Detected {num_objects} objects:")
                    
                    for idx, obj in enumerate(objects):
                        detection = {
                            'index': idx + 1,
                            'bbox': obj.get('bbox', obj.get('box', None)),
                            'category': obj.get('category', obj.get('label', obj.get('class', 'unknown'))),
                            'caption': obj.get('caption', obj.get('description', None)),
                            'confidence': obj.get('score', obj.get('confidence', None))
                        }
                        detections.append(detection)
                        
                        print(f"   {idx + 1}. {detection['category']}")
                        if detection['caption']:
                            print(f"      📝 Caption: {detection['caption'][:100]}")
                        if detection['confidence']:
                            print(f"      🎯 Confidence: {detection['confidence']:.2f}")
                
                elif 'detections' in result:
                    objects = result['detections']
                    num_objects = len(objects)
                    print(f"\n📦 Detected {num_objects} objects")
                    detections = objects
                
                else:
                    # Print the structure to understand it
                    print(f"\n📊 Response structure:")
                    print(f"   Keys: {list(result.keys())}")
                    for key, value in result.items():
                        if isinstance(value, list):
                            print(f"   - {key}: list with {len(value)} items")
                        else:
                            print(f"   - {key}: {type(value).__name__}")
            
            return {
                'success': True,
                'elapsed_time': elapsed,
                'detections': detections,
                'num_detections': num_objects,
                'image_path': image_path,
                'raw_response': result
            }
            
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return {
                'success': False,
                'elapsed_time': elapsed,
                'error': f"Status {response.status_code}",
                'response_text': response.text,
                'image_path': image_path
            }
            
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ Exception: {e}")
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
        
        # Show first few detections
        for det in dinox_result['detections'][:3]:
            if isinstance(det, dict):
                print(f"\n   {det.get('index', '?')}. {det.get('category', 'unknown')}")
                if det.get('caption'):
                    print(f"      📝 {det['caption'][:80]}")
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
            print(f"   💰 Time saved: {gpt_time - dino_time:.1f}s per image")
        else:
            print(f"   ⚠️  DINO-X is slower: {dino_time:.1f}s vs {gpt_time:.1f}s")

def main():
    """Run DINO-X API test"""
    print(f"{'='*80}")
    print(f"DINO-X-1.0 API TEST")
    print(f"{'='*80}")
    print(f"API Endpoint: {API_URL}")
    print(f"Testing {len(TEST_IMAGES)} images\n")
    
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
    results_file = f"/Users/levit/Desktop/mvp/brands_results/dinox_api_test_{timestamp}.json"
    
    summary = {
        'timestamp': datetime.now().isoformat(),
        'api_endpoint': API_URL,
        'model': 'DINO-X-1.0',
        'fashion_prompt': FASHION_PROMPT,
        'total_tests': len(TEST_IMAGES),
        'successful': sum(1 for r in all_results if r['success']),
        'failed': sum(1 for r in all_results if not r['success']),
        'results': all_results
    }
    
    if summary['successful'] > 0:
        successful_results = [r for r in all_results if r['success']]
        avg_time = sum(r['elapsed_time'] for r in successful_results) / len(successful_results)
        summary['avg_time_seconds'] = round(avg_time, 2)
        avg_detections = sum(r['num_detections'] for r in successful_results) / len(successful_results)
        summary['avg_detections'] = round(avg_detections, 1)
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    # Final summary
    print(f"\n{'='*80}")
    print(f"TEST COMPLETE!")
    print(f"{'='*80}")
    print(f"✅ Successful: {summary['successful']}/{len(TEST_IMAGES)}")
    print(f"❌ Failed: {summary['failed']}/{len(TEST_IMAGES)}")
    
    if summary['successful'] > 0:
        print(f"⏱️  Average time: {summary['avg_time_seconds']}s")
        print(f"📦 Average detections: {summary['avg_detections']}")
        
        # Speed comparison
        if summary['avg_time_seconds'] < 10:
            saved = 15 - summary['avg_time_seconds']
            print(f"\n💡 DINO-X is {saved:.1f}s FASTER than GPT-4o on average!")
            print(f"   For 24 images: saves ~{saved * 24:.0f}s ({(saved * 24) / 60:.1f} minutes)")
    
    print(f"\n💾 Results saved to: {results_file}")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()

