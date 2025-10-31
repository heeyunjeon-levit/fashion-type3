#!/usr/bin/env python3
"""
Test script to call the Roboflow Modal backend directly and diagnose detection issues
"""

import requests
import json

def test_roboflow_backend():
    """Test the Roboflow Modal backend with different images and prompts"""
    
    backend_url = "https://heeyunjeon-levit--fashion-crop-roboflow-v2-fastapi-app.modal.run"
    
    # Test image (the one that's failing)
    image_url = "https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1761899841206_0f86de4b5394-Screenshot_20250922_191711_Instagram.jpg"
    
    print("="*80)
    print("🧪 Testing Roboflow Modal Backend")
    print("="*80)
    print(f"🔗 Backend: {backend_url}")
    print(f"📷 Image: {image_url}")
    print()
    
    # Check backend status
    print("🔍 Checking backend status...")
    try:
        status_response = requests.get(f"{backend_url}/")
        print(f"✅ Status: {status_response.json()}")
    except Exception as e:
        print(f"❌ Status check failed: {e}")
    print()
    
    # Test different category requests
    test_cases = [
        {
            "name": "Single top",
            "categories": ["tops"],
            "count": 1
        },
        {
            "name": "Single shirt",
            "categories": ["shirt"],
            "count": 1
        },
        {
            "name": "Multiple tops",
            "categories": ["tops"],
            "count": 3
        },
    ]
    
    for test_case in test_cases:
        print("="*80)
        print(f"🧪 Test: {test_case['name']}")
        print("="*80)
        print(f"📋 Categories: {test_case['categories']}")
        print(f"🔢 Count: {test_case['count']}")
        print()
        
        payload = {
            "imageUrl": image_url,
            "categories": test_case['categories'],
            "count": test_case['count']
        }
        
        try:
            print("📤 Sending crop request...")
            response = requests.post(
                f"{backend_url}/crop",
                json=payload,
                timeout=120
            )
            
            print(f"✅ Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"📊 Result: {json.dumps(result, indent=2)}")
                
                # Check if we got crops
                if result.get('croppedImageUrl'):
                    print(f"✅ Got single crop: {result['croppedImageUrl'][:80]}...")
                elif result.get('croppedImageUrls'):
                    print(f"✅ Got {len(result['croppedImageUrls'])} crops")
                    for i, url in enumerate(result['croppedImageUrls']):
                        print(f"   Crop {i+1}: {url[:80]}...")
                else:
                    print("⚠️  No crops returned (likely fell back to original URL)")
            else:
                print(f"❌ Error response: {response.text}")
                
        except requests.exceptions.Timeout:
            print("❌ Request timed out after 120s")
        except Exception as e:
            print(f"❌ Request failed: {e}")
        
        print()

if __name__ == "__main__":
    test_roboflow_backend()

