#!/usr/bin/env python3
"""Test if Supabase image can be downloaded"""
import requests
from PIL import Image
from io import BytesIO

url = "https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/4aaa14222152-Screenshot_20250922_183517.jpg"

print(f"Testing download from: {url}\n")

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

try:
    response = requests.get(url, headers=headers, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type')}")
    print(f"Content-Length: {len(response.content)} bytes")
    print(f"First 200 bytes: {response.content[:200]}")
    
    # Try to open as image
    image = Image.open(BytesIO(response.content))
    print(f"\n✅ SUCCESS! Image loaded: {image.size}")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()

