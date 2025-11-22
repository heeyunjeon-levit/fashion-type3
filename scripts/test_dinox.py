#!/usr/bin/env python3
"""
Test DINO-X-1.0 as an alternative to GPT-4o for item detection
Compare speed and caption quality
"""

import os
import sys
import time
import json
import base64
import requests
from datetime import datetime

# Test configuration
TEST_IMAGES = [
    "/Users/levit/Desktop/brands/0214d4bd3a05-IMG_6128 복사본.png",  # Houndstooth bag
    "/Users/levit/Desktop/brands/d6459f83273f-IMG_3268 복사본.png",  # Luggage
]

# DINO-X API configuration
DINOX_API_URL = "https://cloud.deepdataspace.com/api/v1/inference"
DINOX_MODEL = "DINO-X-1.0"

# Fashion categories prompt (same as what we use for GroundingDINO)
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

def call_dinox_api(image_path, include_regions=False):
    """
    Call DINO-X-1.0 API
    
    Args:
        image_path: Path to image file
        include_regions: If True, provide empty regions (test mode)
    """
    print(f"\n{'='*80}")
    print(f"Testing DINO-X-1.0: {os.path.basename(image_path)}")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    # Convert image to base64
    print("📸 Converting image to base64...")
    image_base64 = image_to_base64(image_path)
    print(f"   Size: {len(image_base64)} characters")
    
    # Build request payload
    payload = {
        "model": DINOX_MODEL,
        "image": image_base64,
        "prompt": {
            "type": "text",
            "text": FASHION_PROMPT
        },
        "targets": ["caption", "roc"]  # caption + regions of content
    }
    
    # Optionally include regions (empty to test)
    if include_regions:
        payload["regions"] = []
    
    print(f"\n🚀 Calling DINO-X-1.0 API...")
    print(f"   Model: {DINOX_MODEL}")
    print(f"   Prompt length: {len(FASHION_PROMPT.split('.'))} categories")
    print(f"   Targets: {payload['targets']}")
    
    try:
        response = requests.post(
            DINOX_API_URL,
            json=payload,
            timeout=60
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            print(f"✅ Success! ({elapsed:.2f}s)")
            result = response.json()
            
            # Parse results
            print(f"\n📊 Results:")
            print(f"   Response keys: {list(result.keys())}")
            
            return {
                'success': True,
                'elapsed_time': elapsed,
                'response': result,
                'image_path': image_path
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

def compare_with_gpt4o(dinox_result, gpt4o_result=None):
    """Compare DINO-X results with GPT-4o results"""
    print(f"\n📊 COMPARISON:")
    print(f"{'='*80}")
    
    if dinox_result['success']:
        resp = dinox_result['response']
        
        # Show what we got from DINO-X
        print(f"\n🤖 DINO-X-1.0 Results:")
        print(f"   ⏱️  Time: {dinox_result['elapsed_time']:.2f}s")
        
        # Try to parse the response structure
        if isinstance(resp, dict):
            for key, value in resp.items():
                if isinstance(value, list):
                    print(f"   📦 {key}: {len(value)} items")
                    for idx, item in enumerate(value[:3]):  # Show first 3
                        print(f"      {idx + 1}. {item}")
                elif isinstance(value, dict):
                    print(f"   📦 {key}: {json.dumps(value, indent=6)[:200]}...")
                else:
                    print(f"   📦 {key}: {str(value)[:200]}")
    
    if gpt4o_result:
        print(f"\n🧠 GPT-4o Results (for reference):")
        print(f"   ⏱️  Time: ~10-20s (typical)")
        print(f"   Items detected: {len(gpt4o_result.get('items', []))}")
        for item in gpt4o_result.get('items', [])[:3]:
            print(f"      - {item.get('category')}: {item.get('description', 'N/A')}")

def main():
    """Run DINO-X test on sample images"""
    print(f"{'='*80}")
    print(f"DINO-X-1.0 DETECTION TEST")
    print(f"{'='*80}")
    print(f"Testing {len(TEST_IMAGES)} images")
    print(f"API: {DINOX_API_URL}")
    print(f"Model: {DINOX_MODEL}\n")
    
    all_results = []
    
    for idx, image_path in enumerate(TEST_IMAGES, 1):
        if not os.path.exists(image_path):
            print(f"❌ Image not found: {image_path}")
            continue
        
        # Test DINO-X
        result = call_dinox_api(image_path, include_regions=False)
        all_results.append(result)
        
        # Show comparison
        compare_with_gpt4o(result)
        
        if idx < len(TEST_IMAGES):
            print(f"\n⏸️  Waiting 2s before next test...")
            time.sleep(2)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"/Users/levit/Desktop/mvp/brands_results/dinox_test_{timestamp}.json"
    
    summary = {
        'timestamp': datetime.now().isoformat(),
        'api_url': DINOX_API_URL,
        'model': DINOX_MODEL,
        'fashion_prompt': FASHION_PROMPT,
        'total_tests': len(TEST_IMAGES),
        'successful': sum(1 for r in all_results if r['success']),
        'failed': sum(1 for r in all_results if not r['success']),
        'avg_time': sum(r['elapsed_time'] for r in all_results) / len(all_results) if all_results else 0,
        'results': all_results
    }
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    # Final summary
    print(f"\n{'='*80}")
    print(f"TEST COMPLETE!")
    print(f"{'='*80}")
    print(f"✅ Successful: {summary['successful']}/{len(TEST_IMAGES)}")
    print(f"❌ Failed: {summary['failed']}/{len(TEST_IMAGES)}")
    print(f"⏱️  Average time: {summary['avg_time']:.2f}s")
    print(f"💾 Results saved to: {results_file}")
    print(f"{'='*80}\n")
    
    # Show insights
    if summary['successful'] > 0:
        print(f"💡 INSIGHTS:")
        avg_time = summary['avg_time']
        print(f"   • DINO-X average: {avg_time:.2f}s")
        print(f"   • GPT-4o typical: ~10-20s")
        if avg_time < 10:
            print(f"   • ✅ DINO-X is FASTER! ({10 - avg_time:.1f}s saved per image)")
        print(f"\n   Next step: Check caption quality in results file")

if __name__ == "__main__":
    main()

