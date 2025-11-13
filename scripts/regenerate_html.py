#!/usr/bin/env python3
"""
Regenerate HTML files from existing JSON results.
"""
import os
import json
from pathlib import Path
from html_generator_mobile import generate_html_page

BATCH_DIR = './batch_results'
PUBLIC_DIR = './public/results'

def main():
    print("=" * 60)
    print("Regenerating HTML files from JSON results")
    print("=" * 60)
    
    # Ensure public directory exists
    Path(PUBLIC_DIR).mkdir(parents=True, exist_ok=True)
    
    # Find all JSON result files
    json_files = list(Path(BATCH_DIR).glob('*_result.json'))
    print(f"Found {len(json_files)} result files\n")
    
    success_count = 0
    failed_count = 0
    
    for json_path in sorted(json_files):
        phone = json_path.stem.replace('_result', '')
        
        try:
            # Load JSON
            with open(json_path, 'r', encoding='utf-8') as f:
                result_data = json.load(f)
            
            # Generate HTML
            html = generate_html_page(phone, result_data)
            
            # Save to batch_results
            html_path = json_path.parent / f"{phone}_result.html"
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)
            
            # Copy to public
            public_path = Path(PUBLIC_DIR) / f"{phone}.html"
            with open(public_path, 'w', encoding='utf-8') as f:
                f.write(html)
            
            print(f"✅ {phone}")
            success_count += 1
            
        except Exception as e:
            print(f"❌ {phone}: {str(e)}")
            failed_count += 1
    
    print("\n" + "=" * 60)
    print(f"Complete! Success: {success_count}, Failed: {failed_count}")
    print("=" * 60)
    print(f"\n✅ HTML files updated in: {PUBLIC_DIR}/")
    print("📦 Run 'npx vercel --prod --yes' to deploy!")

if __name__ == '__main__':
    main()

