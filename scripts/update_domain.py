#!/usr/bin/env python3
"""
Update all links from old domain to new domain
"""
import os
import re
from pathlib import Path

OLD_DOMAIN = "https://mvp-nu-six.vercel.app"
NEW_DOMAIN = "https://fashionsource.vercel.app"

def update_file(file_path: Path):
    """Update domain in a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if OLD_DOMAIN in content:
            updated_content = content.replace(OLD_DOMAIN, NEW_DOMAIN)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            
            return True
        return False
    except Exception as e:
        print(f"⚠️  Error updating {file_path}: {e}")
        return False

def main():
    base_dir = Path('.')
    
    # Files and directories to update
    targets = [
        # Scripts
        'scripts/phone_hasher.py',
        'scripts/regenerate_with_hashes.py',
        'scripts/html_generator_mobile.py',
        
        # CSV files
        'FINAL_SECURE_LINKS.csv',
        'SMS_ONLY_SECURE.csv',
        'FINAL_READY_TO_SEND.csv',
        
        # Documentation
        'SECURE_LINKS_GUIDE.md',
        'SMS_SENDING_GUIDE.md',
        'CONVERSION_TRACKING_GUIDE.md',
        'FEEDBACK_SETUP_GUIDE.md',
        
        # All HTML result files
        'public/results/*.html',
        'batch_results/*.html',
        'batch2_results/*.html',
    ]
    
    updated_count = 0
    
    for target in targets:
        if '*' in target:
            # Handle glob patterns
            pattern = target.split('/')[-1]
            directory = '/'.join(target.split('/')[:-1])
            dir_path = base_dir / directory
            
            if dir_path.exists():
                for file_path in dir_path.glob(pattern):
                    if update_file(file_path):
                        updated_count += 1
                        print(f"✅ {file_path}")
        else:
            # Handle single files
            file_path = base_dir / target
            if file_path.exists():
                if update_file(file_path):
                    updated_count += 1
                    print(f"✅ {file_path}")
    
    print()
    print(f"🎉 Updated {updated_count} files!")
    print(f"   {OLD_DOMAIN} → {NEW_DOMAIN}")

if __name__ == '__main__':
    main()

