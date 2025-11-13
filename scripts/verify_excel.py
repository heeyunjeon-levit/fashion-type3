"""
Verify the Excel file is readable and show a preview of the data.
Run this first to make sure everything is set up correctly.
"""

import pandas as pd
import sys

EXCEL_PATH = '/Users/levit/Desktop/file+phonenumber.xlsx'

def verify_excel():
    print("="*60)
    print("Excel File Verification")
    print("="*60)
    
    # Try to read the file
    try:
        df = pd.read_excel(EXCEL_PATH)
        print(f"✅ Excel file found and readable")
        print(f"   Path: {EXCEL_PATH}")
    except FileNotFoundError:
        print(f"❌ Excel file not found!")
        print(f"   Expected path: {EXCEL_PATH}")
        print(f"\nMake sure the file exists at this location.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error reading Excel file: {e}")
        sys.exit(1)
    
    # Check columns
    print(f"\n📋 File Structure:")
    print(f"   Total rows: {len(df)}")
    print(f"   Total columns: {len(df.columns)}")
    print(f"\n   Column names:")
    for i, col in enumerate(df.columns, 1):
        print(f"      {i}. {col}")
    
    # Clean up column names for easier access
    df.columns = ['image_url', 'phone']
    
    # Check for missing data
    print(f"\n🔍 Data Quality:")
    missing_images = df['image_url'].isna().sum()
    missing_phones = df['phone'].isna().sum()
    print(f"   Missing image URLs: {missing_images}")
    print(f"   Missing phone numbers: {missing_phones}")
    
    # Validate phone numbers
    invalid_phones = []
    for idx, phone in enumerate(df['phone']):
        if pd.isna(phone):
            continue
        phone_str = str(phone).strip()
        if not phone_str.startswith('10'):
            invalid_phones.append((idx, phone_str))
        if len(phone_str) not in [10, 11]:
            invalid_phones.append((idx, phone_str))
    
    if invalid_phones:
        print(f"   ⚠️  Potentially invalid phone numbers: {len(invalid_phones)}")
        for idx, phone in invalid_phones[:5]:
            print(f"      Row {idx+1}: {phone}")
    else:
        print(f"   ✅ All phone numbers look valid")
    
    # Validate image URLs
    invalid_urls = []
    for idx, url in enumerate(df['image_url']):
        if pd.isna(url):
            continue
        url_str = str(url).strip()
        if not url_str.startswith('http'):
            invalid_urls.append((idx, url_str[:50]))
    
    if invalid_urls:
        print(f"   ⚠️  Potentially invalid URLs: {len(invalid_urls)}")
        for idx, url in invalid_urls[:5]:
            print(f"      Row {idx+1}: {url}...")
    else:
        print(f"   ✅ All image URLs look valid")
    
    # Show sample data
    print(f"\n📊 Sample Data (first 5 rows):")
    print("-"*60)
    for idx in range(min(5, len(df))):
        row = df.iloc[idx]
        phone = str(row['phone']).strip()
        url = str(row['image_url'])[:60] + "..." if len(str(row['image_url'])) > 60 else str(row['image_url'])
        print(f"\nUser {idx+1}:")
        print(f"  Phone: {phone}")
        print(f"  Image: {url}")
    
    print("\n" + "="*60)
    print("Summary:")
    print("="*60)
    valid_rows = len(df) - missing_images - missing_phones
    print(f"Total users: {len(df)}")
    print(f"Valid (complete) rows: {valid_rows}")
    print(f"Invalid/incomplete rows: {missing_images + missing_phones}")
    
    if invalid_phones or invalid_urls:
        print(f"\n⚠️  Found some potentially invalid data (see above)")
        print(f"   The script will skip invalid rows automatically.")
    else:
        print(f"\n✅ All data looks good!")
    
    print(f"\n🚀 Ready to process!")
    print(f"\nNext step:")
    print(f"  ./scripts/quick_start.sh")
    print(f"  or")
    print(f"  python3 scripts/process_and_send_results.py --mode test --skip-sending")
    print("="*60)

if __name__ == '__main__':
    verify_excel()

