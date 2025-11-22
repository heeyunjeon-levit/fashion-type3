#!/usr/bin/env python3
"""
Test the fallback search system with a previously failed image
"""

import requests
import json

API_BASE_URL = "http://localhost:3000"
TEST_IMAGE_PATH = "/Users/levit/Desktop/brands/0214d4bd3a05-IMG_6128 복사본.png"

print("="*80)
print("TESTING FALLBACK SEARCH SYSTEM")
print("="*80)
print(f"Image: {TEST_IMAGE_PATH}")
print()

# Step 1: Upload image
print("📤 Step 1: Uploading image...")
with open(TEST_IMAGE_PATH, 'rb') as f:
    files = {'file': ('test_image.png', f, 'image/png')}
    response = requests.post(f"{API_BASE_URL}/api/upload", files=files, timeout=60)

if response.status_code != 200:
    print(f"❌ Upload failed: {response.text}")
    exit(1)

image_url = response.json()['imageUrl']
print(f"✅ Uploaded: {image_url}")

# Step 2: Analyze image (will detect 0 items)
print("\n🔍 Step 2: Analyzing image...")
response = requests.post(
    f"{API_BASE_URL}/api/analyze",
    json={'imageUrl': image_url},
    timeout=120
)

if response.status_code != 200:
    print(f"❌ Analysis failed: {response.text}")
    exit(1)

analyzed_data = response.json()
items = analyzed_data.get('items', [])
print(f"✅ Analysis complete: {len(items)} items detected")

if len(items) > 0:
    print("⚠️  Expected 0 items but got", len(items))
    for item in items:
        print(f"   - {item.get('category')}: {item.get('description')}")
else:
    print("✅ Correctly detected 0 items (as expected)")

# Step 3: Search with fallback mode
print("\n🔎 Step 3: Searching (FALLBACK MODE should activate)...")
response = requests.post(
    f"{API_BASE_URL}/api/search",
    json={
        'categories': [],
        'croppedImages': {},
        'originalImageUrl': image_url
    },
    timeout=180
)

if response.status_code != 200:
    print(f"❌ Search failed: {response.text}")
    exit(1)

search_data = response.json()
results = search_data.get('results', {})
meta = search_data.get('meta', {})

print(f"\n{'='*80}")
print("FALLBACK SEARCH RESULTS")
print(f"{'='*80}")
print(f"✅ Fallback mode active: {meta.get('fallbackMode', False)}")
print(f"✅ Success: {meta.get('success', False)}")
print(f"📦 Detected category: {meta.get('detectedCategory', 'unknown')}")
print(f"💡 Reasoning: {meta.get('reasoning', 'N/A')}")
print()

if results:
    print(f"🛍️  Found products in {len(results)} categories:")
    for category, products in results.items():
        print(f"\n   Category: {category}")
        print(f"   Products: {len(products)}")
        for idx, product in enumerate(products, 1):
            print(f"      {idx}. {product.get('title', 'No title')}")
            print(f"         {product.get('link')}")
else:
    print("❌ No products found")

# Timing info
timing = meta.get('timing', {})
if timing:
    print(f"\n⏱️  Timing:")
    print(f"   Serper API: {timing.get('serper_api_seconds', 0):.2f}s")
    print(f"   GPT-4 Turbo: {timing.get('gpt4_turbo_seconds', 0):.2f}s")
    print(f"   Total: {timing.get('total_seconds', 0):.2f}s")

print(f"\n{'='*80}")
print("✅ FALLBACK TEST COMPLETE!")
print(f"{'='*80}")

