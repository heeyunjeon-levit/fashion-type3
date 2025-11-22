#!/usr/bin/env python3
"""
Test DINO-X using the CORRECT endpoint from official docs:
/v2/task/dinox/detection (for automatic detection)
NOT /v2/task/dinox/region_vl (requires pre-specified regions)
"""

import os
import sys
import time
import json
import base64
import requests
from datetime import datetime

# Configuration from official docs
API_BASE_URL = 'https://api.deepdataspace.com'
CREATE_TASK_ENDPOINT = '/v2/task/dinox/detection'
QUERY_RESULT_ENDPOINT = '/v2/task_status'  # + /{task_uuid}
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
    
    ext = os.path.splitext(image_path)[1].lower()
    mime_type = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
    }.get(ext, 'image/jpeg')
    
    base64_data = base64.b64encode(image_data).decode('utf-8')
    return f"data:{mime_type};base64,{base64_data}"

def create_detection_task(image_path):
    """
    Create DINO-X detection task using official docs format
    Docs: https://cloud.deepdataspace.com/en/docs#/model/dinox
    """
    print(f"\n{'='*80}")
    print(f"DINO-X Detection: {os.path.basename(image_path)}")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    try:
        # Convert image
        print("📸 Converting image...")
        base64_image = image_to_base64(image_path)
        print(f"   Size: {len(base64_image)} chars")
        
        # Prepare payload (exact format from docs)
        payload = {
            "model": "DINO-X-1.0",
            "image": base64_image,
            "prompt": {
                "type": "text",
                "text": FASHION_PROMPT
            },
            "targets": ["bbox"],  # Start with just bbox for faster response
            "bbox_threshold": 0.25,
            "iou_threshold": 0.8
        }
        
        # Headers (exact format from docs)
        headers = {
            'Token': API_TOKEN,
            'Content-Type': 'application/json'
        }
        
        # Create task
        url = f"{API_BASE_URL}{CREATE_TASK_ENDPOINT}"
        print(f"\n🚀 Creating detection task...")
        print(f"   POST {url}")
        
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=60
        )
        
        print(f"   Response: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   Response keys: {result.keys()}")
            
            # Extract task UUID
            data = result.get('data', {})
            task_uuid = data.get('uuid') or data.get('task_uuid') or data.get('task_id')
            
            if task_uuid:
                create_time = time.time() - start_time
                print(f"   ✅ Task created: {task_uuid}")
                print(f"   Time: {create_time:.2f}s")
                return {
                    'success': True,
                    'task_uuid': task_uuid,
                    'create_time': create_time
                }
            else:
                print(f"   ⚠️  No UUID found")
                print(f"   Full response: {json.dumps(result, indent=2)[:500]}")
                return {
                    'success': False,
                    'error': 'No UUID in response',
                    'response': result
                }
        else:
            print(f"   ❌ Error: {response.status_code}")
            print(f"   Response: {response.text[:300]}")
            return {
                'success': False,
                'error': f"HTTP {response.status_code}",
                'response_text': response.text
            }
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        }

def query_task_status(task_uuid, max_wait=60):
    """
    Query task status using official endpoint
    Docs: https://api.deepdataspace.com/v2/task_status/{task_uuid}
    """
    print(f"\n⏳ Polling for results...")
    print(f"   Task UUID: {task_uuid}")
    
    headers = {
        'Token': API_TOKEN,
        'Content-Type': 'application/json'
    }
    
    url = f"{API_BASE_URL}{QUERY_RESULT_ENDPOINT}/{task_uuid}"
    print(f"   GET {url}")
    
    start_time = time.time()
    poll_count = 0
    
    while time.time() - start_time < max_wait:
        poll_count += 1
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                
                # Extract status from nested structure
                data = result.get('data', {})
                status = data.get('status') or result.get('status')
                
                if poll_count == 1 or poll_count % 5 == 0:
                    print(f"   Poll #{poll_count}: status={status}")
                
                if status == 'success':
                    elapsed = time.time() - start_time
                    print(f"   ✅ Task completed! ({elapsed:.2f}s)")
                    
                    # Parse detections
                    task_result = data.get('result', {})
                    objects = task_result.get('objects', [])
                    
                    print(f"\n📦 Detected {len(objects)} objects:")
                    for idx, obj in enumerate(objects[:5], 1):
                        category = obj.get('category', 'unknown')
                        score = obj.get('score', 0)
                        print(f"   {idx}. {category} (confidence: {score:.2f})")
                    
                    return {
                        'success': True,
                        'elapsed_time': elapsed,
                        'poll_count': poll_count,
                        'num_detections': len(objects),
                        'detections': objects,
                        'result': result
                    }
                    
                elif status in ['failed', 'error']:
                    print(f"   ❌ Task failed")
                    error_msg = data.get('error', 'Unknown error')
                    print(f"   Error: {error_msg}")
                    return {
                        'success': False,
                        'error': f"Task failed: {error_msg}",
                        'result': result
                    }
                
                # Still processing
                time.sleep(2)
                
            else:
                print(f"   ⚠️  HTTP {response.status_code}: {response.text[:100]}")
                time.sleep(2)
                
        except Exception as e:
            print(f"   ⚠️  Poll error: {e}")
            time.sleep(2)
    
    elapsed = time.time() - start_time
    print(f"   ⏰ Timeout after {elapsed:.1f}s ({poll_count} polls)")
    return {
        'success': False,
        'error': f'Timeout after {poll_count} polls',
        'elapsed_time': elapsed
    }

def test_dinox_pipeline(image_path):
    """Test full DINO-X pipeline"""
    overall_start = time.time()
    
    # Step 1: Create task
    create_result = create_detection_task(image_path)
    
    if not create_result['success']:
        return {
            'success': False,
            'image_path': image_path,
            'image_name': os.path.basename(image_path),
            'error': 'Failed to create task',
            'details': create_result
        }
    
    task_uuid = create_result['task_uuid']
    
    # Step 2: Poll for results
    poll_result = query_task_status(task_uuid)
    
    total_time = time.time() - overall_start
    
    # Build final result
    final_result = {
        'success': poll_result['success'],
        'image_path': image_path,
        'image_name': os.path.basename(image_path),
        'task_uuid': task_uuid,
        'total_time': round(total_time, 2),
        'create_time': round(create_result['create_time'], 2),
        'poll_time': round(poll_result.get('elapsed_time', 0), 2),
        'poll_count': poll_result.get('poll_count', 0)
    }
    
    if poll_result['success']:
        final_result.update({
            'num_detections': poll_result['num_detections'],
            'detections': poll_result['detections']
        })
    else:
        final_result['error'] = poll_result.get('error', 'Unknown error')
    
    # Speed comparison
    print(f"\n{'='*80}")
    print(f"⏱️  SPEED COMPARISON")
    print(f"{'='*80}")
    print(f"DINO-X:   {total_time:.1f}s")
    print(f"GPT-4o:   ~15s (average)")
    
    if total_time < 15:
        saved = 15 - total_time
        print(f"\n✅ DINO-X is {saved:.1f}s FASTER!")
        print(f"💰 For 24 images: saves ~{saved * 24:.0f}s ({(saved * 24) / 60:.1f} minutes)")
    else:
        print(f"\n⚠️  DINO-X is {total_time - 15:.1f}s slower")
    
    return final_result

def main():
    """Run DINO-X detection test with official API"""
    print(f"{'='*80}")
    print(f"DINO-X-1.0 DETECTION TEST (Official API)")
    print(f"{'='*80}")
    print(f"Endpoint: {API_BASE_URL}{CREATE_TASK_ENDPOINT}")
    print(f"Query: {API_BASE_URL}{QUERY_RESULT_ENDPOINT}/{{uuid}}")
    print(f"Testing {len(TEST_IMAGES)} images\n")
    
    all_results = []
    
    for idx, image_path in enumerate(TEST_IMAGES, 1):
        if not os.path.exists(image_path):
            print(f"❌ Image not found: {image_path}")
            continue
        
        print(f"\n{'='*80}")
        print(f"IMAGE {idx}/{len(TEST_IMAGES)}")
        print(f"{'='*80}")
        
        result = test_dinox_pipeline(image_path)
        all_results.append(result)
        
        if idx < len(TEST_IMAGES):
            print(f"\n⏸️  Waiting 3s before next image...")
            time.sleep(3)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"/Users/levit/Desktop/mvp/brands_results/dinox_detection_test_{timestamp}.json"
    
    summary = {
        'timestamp': datetime.now().isoformat(),
        'endpoint': f"{API_BASE_URL}{CREATE_TASK_ENDPOINT}",
        'model': 'DINO-X-1.0',
        'fashion_prompt': FASHION_PROMPT,
        'total_images': len(TEST_IMAGES),
        'successful': sum(1 for r in all_results if r['success']),
        'failed': sum(1 for r in all_results if not r['success']),
        'results': all_results
    }
    
    if summary['successful'] > 0:
        successful = [r for r in all_results if r['success']]
        avg_time = sum(r['total_time'] for r in successful) / len(successful)
        summary['avg_time_seconds'] = round(avg_time, 2)
        avg_detections = sum(r['num_detections'] for r in successful) / len(successful)
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
        print(f"\n⏱️  Average time: {summary['avg_time_seconds']}s")
        print(f"📦 Average detections: {summary['avg_detections']}")
        
        gpt_avg = 15
        if summary['avg_time_seconds'] < gpt_avg:
            saved = gpt_avg - summary['avg_time_seconds']
            print(f"\n🎉 DINO-X is {saved:.1f}s FASTER than GPT-4o!")
            print(f"   For 24 images: saves {saved * 24:.0f}s ({(saved * 24) / 60:.1f} minutes)")
            print(f"\n💡 DINO-X WORKS! Ready to integrate into pipeline")
        else:
            print(f"\n⚠️  DINO-X is slower, GPT-4o might be better for now")
    
    print(f"\n💾 Results saved to: {results_file}")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()

