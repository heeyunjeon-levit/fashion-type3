#!/usr/bin/env python3
"""
Test OCR endpoint with a known working image URL
"""
import requests
import json

# This is one of the working image URLs from earlier logs
# Replace with your actual blue BEANPOLE sweater image URL
test_image_url = input("Enter image URL to test (or press Enter for demo): ").strip()

if not test_image_url:
    # Use a public test image with Korean text
    test_image_url = "https://image.musinsa.com/images/goods_img/20231106/3609945/3609945_17135959638549_500.jpg"
    print(f"Using demo image: {test_image_url}")

print("\n🧪 Testing OCR endpoint...")
print(f"Image URL: {test_image_url[:80]}...")

try:
    response = requests.post(
        'http://localhost:8000/ocr-search',
        json={'imageUrl': test_image_url},
        timeout=300  # 5 minutes
    )
    
    print(f"\n📊 Status Code: {response.status_code}")
    
    if response.ok:
        data = response.json()
        print(f"\n✅ Success: {data.get('success')}")
        print(f"📦 Products: {len(data.get('product_results') or [])}")
        
        if data.get('product_results'):
            for i, product in enumerate(data['product_results'], 1):
                brand = product['product']['brand']
                text = product['product']['exact_ocr_text']
                success = product['search_result']['success']
                results_count = len(product['search_result'].get('selected_results') or [])
                print(f"\n  Product {i}:")
                print(f"    Brand: {brand}")
                print(f"    Text: {text}")
                print(f"    Search Success: {success}")
                print(f"    Results: {results_count}")
        else:
            print(f"\n❌ Reason: {data.get('reason')}")
            print(f"Full response: {json.dumps(data, indent=2)}")
    else:
        print(f"\n❌ Error: {response.text}")
        
except requests.exceptions.Timeout:
    print("\n⏰ Timeout after 5 minutes")
except Exception as e:
    print(f"\n❌ Error: {e}")

