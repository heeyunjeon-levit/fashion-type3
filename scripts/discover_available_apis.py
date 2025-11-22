#!/usr/bin/env python3
"""
Discover what APIs/models are available with your DINO-X API token
"""

import requests
import json

API_TOKEN = 'bdf2ed490ebe69a28be81ea9d9b0b0e3'
BASE_URL = 'https://api.deepdataspace.com'

# Common endpoint patterns to check
ENDPOINTS_TO_CHECK = [
    '/v2/models',
    '/v2/tasks',
    '/v2/apis',
    '/models',
    '/tasks',
    '/api/v2/models',
    '/api/v2/tasks',
    '/user/info',
    '/user/models',
    '/user/tasks',
]

def check_endpoint(endpoint):
    """Check if an endpoint is accessible"""
    url = f"{BASE_URL}{endpoint}"
    headers = {
        'Token': API_TOKEN,
        'Content-Type': 'application/json'
    }
    
    print(f"\n🔍 Checking: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   ✅ SUCCESS!")
                print(f"   Response: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
                return True, data
            except:
                print(f"   Response (text): {response.text[:200]}")
                return True, response.text
        else:
            print(f"   ❌ Error: {response.text[:100]}")
            return False, None
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False, None

def main():
    """Discover available APIs"""
    print(f"{'='*80}")
    print(f"DISCOVERING AVAILABLE APIS")
    print(f"{'='*80}")
    print(f"Base URL: {BASE_URL}")
    print(f"Token: {API_TOKEN[:20]}...")
    
    results = {}
    
    for endpoint in ENDPOINTS_TO_CHECK:
        success, data = check_endpoint(endpoint)
        if success:
            results[endpoint] = data
    
    print(f"\n{'='*80}")
    print(f"DISCOVERY COMPLETE")
    print(f"{'='*80}")
    
    if results:
        print(f"\n✅ Found {len(results)} accessible endpoint(s):")
        for endpoint in results.keys():
            print(f"   - {endpoint}")
        
        # Save results
        with open('/Users/levit/Desktop/mvp/brands_results/api_discovery.json', 'w') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Full results saved to: brands_results/api_discovery.json")
    else:
        print(f"\n❌ No accessible endpoints found")
        print(f"\n💡 This might mean:")
        print(f"   1. Your API token needs to be activated/verified")
        print(f"   2. DINO-X requires a paid subscription")
        print(f"   3. The API structure is different than expected")
    
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()

