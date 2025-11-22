#!/usr/bin/env python3
"""
Test DINO-X-1.0 using the correct API endpoint from official docs
https://cloud.deepdataspace.com/en/docs

Correct format:
- Base URL: https://api.deepdataspace.com
- Endpoint: /v2/task/{api_path}
- Auth: Headers with Token=xxx;
- Process: Async (create task → poll for results)
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
API_TOKEN = 'bdf2ed490ebe69a28be81ea9d9b0b0e3'

TEST_IMAGES = [
    "/Users/levit/Desktop/brands/0214d4bd3a05-IMG_6128 복사본.png",  # Houndstooth bag
    "/Users/levit/Desktop/brands/d6459f83273f-IMG_3268 복사본.png",  # Luggage
]

# Fashion categories prompt
FASHION_PROMPT = "shirt. jacket. blouse. button up shirt. vest. skirt. shorts. pants. shoes. bag. dress. coat. sweater. cardigan. hoodie. jeans. leggings. sneakers. boots. sandals. backpack. purse. handbag. hat. cap. scarf. belt. watch. sunglasses. jewelry. necklace. bracelet. earrings. ring"

# Try different possible DINO-X API paths
POSSIBLE_API_PATHS = [
    'dino-x',
    'dinox',
    'DINO-X',
    'detection/dino-x',
    'inference/dino-x'
]

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

def create_task(image_path, api_path='dino-x'):
    """
    Create a DINO-X task using the official API format
    
    Returns task_id to poll for results
    """
    print(f"\n🚀 Creating DINO-X task...")
    print(f"   API Path: {api_path}")
    print(f"   Image: {os.path.basename(image_path)}")
    
    try:
        # Convert image to base64
        base64_image = image_to_base64(image_path)
        print(f"   Image size: {len(base64_image)} chars")
        
        # Prepare payload (based on your original format)
        payload = {
            "model": "DINO-X-1.0",
            "image": base64_image,
            "prompt": {
                "type": "text",
                "text": FASHION_PROMPT
            },
            "targets": ["caption", "roc"]
        }
        
        # Prepare headers (Token format from docs)
        headers = {
            'Token': API_TOKEN,  # As shown in docs: "Token=xxx"
            'Content-Type': 'application/json'
        }
        
        # Create task
        url = f"{API_BASE_URL}/v2/task/{api_path}"
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
            task_id = result.get('task_id') or result.get('taskId') or result.get('id')
            print(f"   ✅ Task created: {task_id}")
            return task_id, result
        else:
            print(f"   ❌ Error: {response.text[:200]}")
            return None, {'error': response.text, 'status_code': response.status_code}
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return None, {'error': str(e)}

def poll_task_result(task_id, max_wait=60):
    """
    Poll for task results (async pattern from docs)
    """
    print(f"\n⏳ Polling for results...")
    print(f"   Task ID: {task_id}")
    
    headers = {
        'Token': API_TOKEN,
        'Content-Type': 'application/json'
    }
    
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        try:
            # Try common result endpoint patterns
            for pattern in [
                f"/v2/task/{task_id}/result",
                f"/v2/task/{task_id}",
                f"/v2/result/{task_id}"
            ]:
                url = f"{API_BASE_URL}{pattern}"
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    result = response.json()
                    status = result.get('status') or result.get('state')
                    
                    print(f"   Status: {status}")
                    
                    if status in ['completed', 'success', 'done']:
                        print(f"   ✅ Task completed!")
                        return result
                    elif status in ['failed', 'error']:
                        print(f"   ❌ Task failed")
                        return result
                    
                    # Still processing
                    time.sleep(2)
                    break
            
        except Exception as e:
            print(f"   ⚠️  Poll error: {e}")
            time.sleep(2)
    
    print(f"   ⏰ Timeout after {max_wait}s")
    return {'error': 'timeout'}

def test_api_path(image_path, api_path):
    """Test a specific API path"""
    print(f"\n{'='*80}")
    print(f"Testing API Path: {api_path}")
    print(f"Image: {os.path.basename(image_path)}")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    # Step 1: Create task
    task_id, create_result = create_task(image_path, api_path)
    
    if not task_id:
        elapsed = time.time() - start_time
        return {
            'success': False,
            'api_path': api_path,
            'elapsed_time': elapsed,
            'error': 'Failed to create task',
            'create_result': create_result
        }
    
    # Step 2: Poll for results
    final_result = poll_task_result(task_id)
    
    elapsed = time.time() - start_time
    
    return {
        'success': 'error' not in final_result,
        'api_path': api_path,
        'elapsed_time': elapsed,
        'task_id': task_id,
        'result': final_result
    }

def main():
    """Test DINO-X API with correct endpoint"""
    print(f"{'='*80}")
    print(f"DINO-X-1.0 API TEST (Official Format)")
    print(f"{'='*80}")
    print(f"Base URL: {API_BASE_URL}")
    print(f"Format: /v2/task/{{api_path}}")
    print(f"Testing {len(POSSIBLE_API_PATHS)} API path variations\n")
    
    # Use first test image
    test_image = TEST_IMAGES[0]
    
    if not os.path.exists(test_image):
        print(f"❌ Test image not found: {test_image}")
        return
    
    # Try each possible API path
    results = []
    for api_path in POSSIBLE_API_PATHS:
        result = test_api_path(test_image, api_path)
        results.append(result)
        
        if result['success']:
            print(f"\n✅ FOUND WORKING API PATH: {api_path}")
            print(f"   Time: {result['elapsed_time']:.2f}s")
            break
        else:
            print(f"\n❌ API path '{api_path}' didn't work")
            print(f"   Error: {result.get('error', 'Unknown')}")
            if result.get('create_result'):
                error_msg = result['create_result'].get('error', '')[:200]
                print(f"   Details: {error_msg}")
        
        # Small delay between attempts
        time.sleep(1)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"/Users/levit/Desktop/mvp/brands_results/dinox_api_discovery_{timestamp}.json"
    
    summary = {
        'timestamp': datetime.now().isoformat(),
        'api_base_url': API_BASE_URL,
        'test_image': test_image,
        'tested_paths': POSSIBLE_API_PATHS,
        'results': results
    }
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*80}")
    print(f"API DISCOVERY COMPLETE")
    print(f"{'='*80}")
    print(f"💾 Results saved to: {results_file}")
    
    # Show summary
    successful = [r for r in results if r['success']]
    if successful:
        print(f"\n✅ Found {len(successful)} working API path(s):")
        for r in successful:
            print(f"   - {r['api_path']} ({r['elapsed_time']:.1f}s)")
    else:
        print(f"\n❌ No working API paths found")
        print(f"\n💡 Suggestions:")
        print(f"   1. Check the DINO-X section in docs: https://cloud.deepdataspace.com/en/docs")
        print(f"   2. Look for the specific {api_path} in the 'General Model API' → 'DINO-X' section")
        print(f"   3. Try the Playground to see what endpoint it uses (inspect network tab)")
    
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()

