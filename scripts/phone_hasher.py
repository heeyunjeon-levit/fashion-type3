import hashlib
import json
from pathlib import Path

def hash_phone(phone: str) -> str:
    """
    Create a secure hash of phone number for URL
    Uses SHA-256 and takes first 12 characters for shorter URLs
    """
    # Add a salt for extra security (keep this secret!)
    salt = "fashion_mvp_2024_secure"
    combined = f"{salt}_{phone}"
    hash_obj = hashlib.sha256(combined.encode())
    hash_hex = hash_obj.hexdigest()
    # Take first 12 chars for shorter, cleaner URLs
    return hash_hex[:12]

def create_phone_mapping():
    """
    Create a mapping file of phone numbers to hashed IDs
    """
    mapping = {}
    
    # Load all result JSONs to get phone numbers
    batch1_dir = Path('./batch_results')
    batch2_dir = Path('./batch2_results')
    
    for result_dir in [batch1_dir, batch2_dir]:
        if result_dir.exists():
            for json_file in result_dir.glob('*_result.json'):
                phone = json_file.stem.replace('_result', '')
                hashed = hash_phone(phone)
                mapping[phone] = hashed
    
    # Save mapping for reference
    with open('phone_hash_mapping.json', 'w') as f:
        json.dump(mapping, f, indent=2)
    
    print(f"✅ Created mapping for {len(mapping)} phone numbers")
    return mapping

if __name__ == '__main__':
    # Test
    test_phone = "1040455757"
    hashed = hash_phone(test_phone)
    print(f"Example: {test_phone} → {hashed}")
    print(f"URL: https://mvp-nu-six.vercel.app/results/{hashed}.html")
    print()
    
    # Create full mapping
    mapping = create_phone_mapping()
    
    print()
    print("Sample mappings:")
    for i, (phone, hashed) in enumerate(list(mapping.items())[:5]):
        print(f"  {phone} → {hashed}")

