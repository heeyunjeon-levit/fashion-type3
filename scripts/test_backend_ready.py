"""
Quick test to verify backend is ready for batch processing.
Run this before process_and_send_results.py
"""

import requests
import os
import sys

def test_backend_health(backend_url: str) -> bool:
    """Test if backend is reachable"""
    try:
        print(f"Testing backend: {backend_url}")
        response = requests.get(f"{backend_url}", timeout=10)
        if response.status_code == 200:
            print("✅ Backend is reachable")
            return True
        else:
            print(f"⚠️  Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend not reachable: {e}")
        return False

def test_upload_endpoint(backend_url: str) -> bool:
    """Test if upload endpoint exists"""
    try:
        print(f"\nTesting upload endpoint...")
        response = requests.options(f"{backend_url}/api/upload", timeout=10)
        print("✅ Upload endpoint exists")
        return True
    except Exception as e:
        print(f"⚠️  Upload endpoint issue: {e}")
        return False

def test_crop_endpoint(backend_url: str) -> bool:
    """Test if crop endpoint exists"""
    try:
        print(f"Testing crop endpoint...")
        response = requests.options(f"{backend_url}/api/crop", timeout=10)
        print("✅ Crop endpoint exists")
        return True
    except Exception as e:
        print(f"⚠️  Crop endpoint issue: {e}")
        return False

def test_search_endpoint(backend_url: str) -> bool:
    """Test if search endpoint exists"""
    try:
        print(f"Testing search endpoint...")
        response = requests.options(f"{backend_url}/api/search", timeout=10)
        print("✅ Search endpoint exists")
        return True
    except Exception as e:
        print(f"⚠️  Search endpoint issue: {e}")
        return False

def main():
    backend_url = os.getenv('BACKEND_URL')
    
    if not backend_url:
        print("❌ BACKEND_URL environment variable not set!")
        print("\nSet it with:")
        print("  export BACKEND_URL='https://your-app.vercel.app'")
        print("  or")
        print("  export BACKEND_URL='http://localhost:3000'")
        sys.exit(1)
    
    print("="*60)
    print("Backend Readiness Test")
    print("="*60)
    
    results = {
        'backend': test_backend_health(backend_url),
        'upload': test_upload_endpoint(backend_url),
        'crop': test_crop_endpoint(backend_url),
        'search': test_search_endpoint(backend_url),
    }
    
    print("\n" + "="*60)
    print("Results:")
    print("="*60)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.capitalize()}: {status}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n✅ All tests passed! Backend is ready.")
        print("\nYou can now run:")
        print("  python3 scripts/process_and_send_results.py --mode test --skip-sending")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Please fix the issues above.")
        sys.exit(1)

if __name__ == '__main__':
    main()

