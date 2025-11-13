#!/usr/bin/env python3
import json
import os
from pathlib import Path
from phone_hasher import hash_phone
from html_generator_mobile import generate_html_page

def regenerate_all_with_hashes():
    """
    Regenerate all HTML files with hashed filenames for privacy
    Phone numbers are still used internally for tracking, just not in URLs
    """
    
    # Load mapping
    with open('phone_hash_mapping.json', 'r') as f:
        mapping = json.load(f)
    
    count = 0
    
    # Process Batch 1
    batch1_dir = Path('./batch_results')
    for result_file in batch1_dir.glob('*_result.json'):
        phone = result_file.stem.replace('_result', '')
        hashed_id = mapping.get(phone)
        
        if not hashed_id:
            print(f"⚠️  No hash found for {phone}, skipping")
            continue
        
        # Load result data
        with open(result_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        
        # Generate HTML (phone still used internally for tracking)
        html = generate_html_page(phone, results)
        
        # Save with HASHED filename to public/results
        public_file = Path('./public/results') / f"{hashed_id}.html"
        public_file.parent.mkdir(parents=True, exist_ok=True)
        with open(public_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        count += 1
        print(f"✅ {phone} → {hashed_id}.html")
    
    # Process Batch 2
    batch2_dir = Path('./batch2_results')
    if batch2_dir.exists():
        for result_file in batch2_dir.glob('*_result.json'):
            phone = result_file.stem.replace('_result', '')
            hashed_id = mapping.get(phone)
            
            if not hashed_id:
                print(f"⚠️  No hash found for {phone}, skipping")
                continue
            
            # Load result data
            with open(result_file, 'r', encoding='utf-8') as f:
                results = json.load(f)
            
            # Generate HTML
            html = generate_html_page(phone, results)
            
            # Save with HASHED filename
            public_file = Path('./public/results') / f"{hashed_id}.html"
            with open(public_file, 'w', encoding='utf-8') as f:
                f.write(html)
            
            count += 1
            print(f"✅ {phone} → {hashed_id}.html")
    
    print()
    print(f"🎉 Regenerated {count} HTML files with secure hashed URLs!")
    print()
    print("Example URLs:")
    sample_phones = list(mapping.items())[:3]
    for phone, hashed in sample_phones:
        print(f"  {phone}: https://fashionsource.vercel.app/results/{hashed}.html")
    
    return mapping

if __name__ == '__main__':
    regenerate_all_with_hashes()

