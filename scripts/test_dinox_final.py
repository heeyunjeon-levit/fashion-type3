#!/usr/bin/env python3
"""
Test DINO-X using the correct endpoint discovered from playground
Endpoint: dinox_region_vl
"""

import os
import sys
import time
import json
import base64
import requests
from datetime import datetime

# Configuration
API_BASE_URL = 'https://api.deepdataspace.com'
API_TOKEN = 'bdf2ed490ebe69a28be81ea9d9b0b0e3'
API_PATH = 'dinox_region_vl'  # Discovered from playground network tab!

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

def create_dinox_task(image_path):
    """
    Create DINO-X task using discovered endpoint
    
    Returns task_id to poll for results
    """
    print(f"\n{'='*80}")
    print(f"Testing DINO-X: {os.path.basename(image_path)}")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    try:
        # Convert image to base64
        print("📸 Converting image...")
        base64_image = image_to_base64(image_path)
        print(f"   Image size: {len(base64_image)} chars")
        
        # Prepare payload (your original format)
        payload = {
            "model": "DINO-X-1.0",
            "image": base64_image,
            "prompt": {
                "type": "text",
                "text": FASHION_PROMPT
            },
            "targets": ["caption", "roc"]
        }
        
        # Headers
        headers = {
            'Token': API_TOKEN,
            'Content-Type': 'application/json'
        }
        
        # Create task
        url = f"{API_BASE_URL}/v2/task/{API_PATH}"
        print(f"\n🚀 Creating task...")
        print(f"   POST {url}")
        
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"   Response: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   Response: {json.dumps(result, indent=2, ensure_ascii=False)[:300]}")
            
            # Extract task ID (try different possible keys)
            task_id = (result.get('task_id') or 
                      result.get('taskId') or 
                      result.get('id') or
                      result.get('task') or
                      result.get('uuid'))
            
            if task_id:
                print(f"   ✅ Task created: {task_id}")
                create_time = time.time() - start_time
                return {
                    'success': True,
                    'task_id': task_id,
                    'create_time': create_time,
                    'create_response': result
                }
            else:
                print(f"   ⚠️  No task_id found in response")
                print(f"   Full response: {json.dumps(result, indent=2)}")
                return {
                    'success': False,
                    'error': 'No task_id in response',
                    'response': result
                }
        else:
            print(f"   ❌ Error: {response.text[:200]}")
            return {
                'success': False,
                'error': f"Status {response.status_code}",
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

def poll_task_result(task_id, max_wait=60):
    """
    Poll for task results
    """
    print(f"\n⏳ Polling for results...")
    print(f"   Task ID: {task_id}")
    
    headers = {
        'Token': API_TOKEN,
        'Content-Type': 'application/json'
    }
    
    start_time = time.time()
    poll_count = 0
    
    # Try different possible result endpoints
    result_patterns = [
        f"/v2/task/{task_id}",
        f"/v2/task/{API_PATH}/{task_id}",
        f"/v2/result/{task_id}",
        f"/{task_id}",  # Based on network tab showing direct UUID calls
    ]
    
    while time.time() - start_time < max_wait:
        poll_count += 1
        
        for pattern in result_patterns:
            try:
                url = f"{API_BASE_URL}{pattern}"
                
                if poll_count == 1:  # Only print on first iteration
                    print(f"   Trying: {url}")
                
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    result = response.json()
                    status = (result.get('status') or 
                             result.get('state') or 
                             result.get('task_status'))
                    
                    print(f"   Status: {status}")
                    
                    if status in ['completed', 'success', 'done', 'finished']:
                        elapsed = time.time() - start_time
                        print(f"   ✅ Task completed! ({elapsed:.2f}s)")
                        
                        # Parse detections
                        detections = parse_detections(result)
                        
                        return {
                            'success': True,
                            'elapsed_time': elapsed,
                            'poll_count': poll_count,
                            'result': result,
                            'detections': detections,
                            'num_detections': len(detections)
                        }
                    elif status in ['failed', 'error']:
                        print(f"   ❌ Task failed")
                        return {
                            'success': False,
                            'error': 'Task failed',
                            'result': result
                        }
                    
                    # Still processing
                    time.sleep(2)
                    break  # Found working pattern, use it
                    
            except Exception as e:
                continue  # Try next pattern
        
        if poll_count == 1:
            print(f"   Polling every 2s...")
    
    elapsed = time.time() - start_time
    print(f"   ⏰ Timeout after {elapsed:.1f}s")
    return {
        'success': False,
        'error': f'Timeout after {poll_count} polls',
        'elapsed_time': elapsed
    }

def parse_detections(result):
    """Parse detections from result"""
    detections = []
    
    # Try different possible result structures
    objects = (result.get('objects') or 
              result.get('detections') or 
              result.get('results') or 
              result.get('data', {}).get('objects') or
              [])
    
    if isinstance(objects, list):
        for idx, obj in enumerate(objects):
            detection = {
                'index': idx + 1,
                'bbox': obj.get('bbox', obj.get('box')),
                'category': obj.get('category', obj.get('label', obj.get('class', 'unknown'))),
                'caption': obj.get('caption', obj.get('description')),
                'confidence': obj.get('score', obj.get('confidence'))
            }
            detections.append(detection)
    
    return detections

def test_dinox_full_pipeline(image_path):
    """Test full DINO-X pipeline: create task + poll results"""
    overall_start = time.time()
    
    # Step 1: Create task
    create_result = create_dinox_task(image_path)
    
    if not create_result['success']:
        return {
            'success': False,
            'image_path': image_path,
            'error': 'Failed to create task',
            'details': create_result
        }
    
    task_id = create_result['task_id']
    
    # Step 2: Poll for results
    poll_result = poll_task_result(task_id)
    
    total_time = time.time() - overall_start
    
    # Combine results
    final_result = {
        'success': poll_result['success'],
        'image_path': image_path,
        'image_name': os.path.basename(image_path),
        'task_id': task_id,
        'total_time': round(total_time, 2),
        'create_time': round(create_result['create_time'], 2),
        'poll_time': round(poll_result.get('elapsed_time', 0), 2),
        'poll_count': poll_result.get('poll_count', 0)
    }
    
    if poll_result['success']:
        final_result.update({
            'detections': poll_result['detections'],
            'num_detections': poll_result['num_detections']
        })
        
        # Show detections
        print(f"\n📦 Detected {poll_result['num_detections']} objects:")
        for det in poll_result['detections'][:5]:
            print(f"   {det['index']}. {det['category']}")
            if det['caption']:
                print(f"      📝 {det['caption'][:80]}")
    else:
        final_result['error'] = poll_result.get('error', 'Unknown error')
    
    # Comparison with GPT-4o
    print(f"\n{'='*80}")
    print(f"⏱️  SPEED COMPARISON")
    print(f"{'='*80}")
    print(f"DINO-X:  {total_time:.1f}s")
    print(f"GPT-4o:  ~15s (average)")
    
    if total_time < 15:
        saved = 15 - total_time
        print(f"✅ DINO-X is {saved:.1f}s FASTER!")
        print(f"💰 For 24 images: saves ~{saved * 24:.0f}s ({(saved * 24) / 60:.1f} minutes)")
    else:
        print(f"⚠️  DINO-X is {total_time - 15:.1f}s slower")
    
    return final_result

def main():
    """Run DINO-X test with discovered endpoint"""
    print(f"{'='*80}")
    print(f"DINO-X-1.0 TEST (Correct Endpoint from Playground)")
    print(f"{'='*80}")
    print(f"Endpoint: {API_PATH}")
    print(f"Base URL: {API_BASE_URL}")
    print(f"Testing {len(TEST_IMAGES)} images\n")
    
    all_results = []
    
    for idx, image_path in enumerate(TEST_IMAGES, 1):
        if not os.path.exists(image_path):
            print(f"❌ Image not found: {image_path}")
            continue
        
        print(f"\n{'='*80}")
        print(f"IMAGE {idx}/{len(TEST_IMAGES)}")
        print(f"{'='*80}")
        
        result = test_dinox_full_pipeline(image_path)
        all_results.append(result)
        
        if idx < len(TEST_IMAGES):
            print(f"\n⏸️  Waiting 3s before next image...")
            time.sleep(3)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"/Users/levit/Desktop/mvp/brands_results/dinox_final_test_{timestamp}.json"
    
    summary = {
        'timestamp': datetime.now().isoformat(),
        'api_endpoint': f"{API_BASE_URL}/v2/task/{API_PATH}",
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
            print(f"\n💡 Next: Compare caption quality with GPT-4o descriptions")
    
    print(f"\n💾 Results saved to: {results_file}")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()

