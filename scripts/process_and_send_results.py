"""
Script to process images from Typeform responses and send results to users.

This script:
1. Reads the Excel file with phone numbers and image URLs
2. Downloads each image
3. Processes it through the pipeline (upload -> crop -> search)
4. Stores results in Supabase
5. Sends results to users via SMS/KakaoTalk

Usage:
    python3 process_and_send_results.py --mode [test|production]
"""

import pandas as pd
import requests
import time
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
import argparse

# Configuration
EXCEL_FILE_PATH = '/Users/levit/Desktop/file+phonenumber.xlsx'
# Use Next.js frontend (which calls the GPU backend)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')  # Vercel URL in production
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# SMS Configuration (you'll need to set these up)
SMS_SERVICE = os.getenv('SMS_SERVICE', 'twilio')  # or 'aligo', 'kakao', etc.
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_FROM_NUMBER = os.getenv('TWILIO_FROM_NUMBER')

class PipelineProcessor:
    def __init__(self, backend_url: str, results_dir: str = './batch_user_results'):
        self.backend_url = backend_url
        self.results_dir = results_dir
        os.makedirs(results_dir, exist_ok=True)
        
    def download_image(self, url: str, phone: str) -> Optional[str]:
        """Download image from Typeform URL"""
        try:
            print(f"  📥 Downloading image for {phone}...")
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Save locally
            local_path = os.path.join(self.results_dir, f"{phone}_original.jpg")
            with open(local_path, 'wb') as f:
                f.write(response.content)
            
            print(f"  ✅ Downloaded to {local_path}")
            return local_path
        except Exception as e:
            print(f"  ❌ Failed to download image: {e}")
            return None
    
    def upload_to_backend(self, image_path: str) -> Optional[str]:
        """Upload image to frontend (which uploads to Supabase)"""
        try:
            print(f"  📤 Uploading image...")
            with open(image_path, 'rb') as f:
                files = {'file': (os.path.basename(image_path), f, 'image/jpeg')}
                response = requests.post(
                    f"{FRONTEND_URL}/api/upload",
                    files=files,
                    timeout=60
                )
                response.raise_for_status()
                data = response.json()
                image_url = data.get('imageUrl')
                print(f"  ✅ Uploaded: {image_url}")
                return image_url
        except Exception as e:
            print(f"  ❌ Upload failed: {e}")
            return None
    
    def crop_items(self, image_url: str) -> Optional[Dict]:
        """Analyze and crop items (calls GPU backend via frontend)"""
        try:
            print(f"  ✂️  Analyzing and cropping items...")
            response = requests.post(
                f"{FRONTEND_URL}/api/analyze",
                json={'imageUrl': image_url},
                timeout=120
            )
            response.raise_for_status()
            data = response.json()
            items = data.get('items', [])
            print(f"  ✅ Found {len(items)} items")
            
            # Convert to format expected by search: {"tops": "url_string"}
            cropped_images = {}
            seen_categories = set()
            for item in items:
                category = item['category']
                if category not in seen_categories:
                    cropped_images[category] = item.get('croppedImageUrl', '')
                    seen_categories.add(category)
            
            return {'items': items, 'croppedImages': cropped_images}
        except Exception as e:
            print(f"  ❌ Cropping failed: {e}")
            return None
    
    def search_items(self, cropped_data: Dict, original_url: str) -> Optional[Dict]:
        """Search for similar products"""
        try:
            print(f"  🔍 Searching for products...")
            
            categories = list(cropped_data.get('croppedImages', {}).keys())
            if not categories:
                print(f"  ⚠️  No categories to search")
                return None
                
            response = requests.post(
                f"{FRONTEND_URL}/api/search",
                json={
                    'categories': categories,
                    'croppedImages': cropped_data.get('croppedImages', {}),
                    'originalImageUrl': original_url
                },
                timeout=180
            )
            response.raise_for_status()
            data = response.json()
            results_count = sum(len(items) for items in data.get('results', {}).values())
            print(f"  ✅ Found {results_count} shopping links")
            return data
        except Exception as e:
            print(f"  ❌ Search failed: {e}")
            return None
    
    def process_user(self, phone: str, image_url: str) -> Optional[Dict]:
        """Process a single user through the complete pipeline"""
        print(f"\n{'='*60}")
        print(f"Processing user: {phone}")
        print(f"Image URL: {image_url[:80]}...")
        print(f"{'='*60}")
        
        start_time = time.time()
        result = {
            'phone': phone,
            'original_url': image_url,
            'status': 'failed',
            'timestamp': datetime.now().isoformat()
        }
        
        # Step 1: Download image
        local_path = self.download_image(image_url, phone)
        if not local_path:
            return result
        
        # Step 2: Upload to backend (get S3 URL)
        uploaded_url = self.upload_to_backend(local_path)
        if not uploaded_url:
            return result
        result['uploaded_url'] = uploaded_url
        
        # Step 3: Crop items
        crop_data = self.crop_items(uploaded_url)
        if not crop_data:
            return result
        result['cropped_data'] = crop_data
        
        # Step 4: Search for products
        search_data = self.search_items(crop_data, uploaded_url)
        if not search_data:
            return result
        result['search_results'] = search_data
        
        # Success!
        result['status'] = 'success'
        elapsed = time.time() - start_time
        result['processing_time_seconds'] = elapsed
        
        print(f"\n✅ Successfully processed {phone} in {elapsed:.1f}s")
        
        # Save individual result
        result_file = os.path.join(self.results_dir, f"{phone}_results.json")
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        return result


class MessageSender:
    """Send results to users via SMS/KakaoTalk"""
    
    def __init__(self, service: str = 'twilio'):
        self.service = service
        
    def format_results_message(self, phone: str, results: Dict) -> str:
        """Format results into a user-friendly message"""
        if results['status'] != 'success':
            return f"죄송합니다. 이미지 처리 중 오류가 발생했습니다. ({phone})"
        
        search_results = results.get('search_results', {}).get('results', {})
        
        message = "🎉 이미지 분석 결과가 나왔습니다!\n\n"
        
        # Count products found
        product_count = len(search_results)
        if product_count == 0:
            message += "죄송합니다. 상품을 찾을 수 없었습니다."
            return message
        
        message += f"총 {product_count}개의 상품을 찾았습니다:\n\n"
        
        # Add summary of categories
        category_names = {
            'tops': '상의',
            'bottoms': '하의', 
            'dress': '드레스',
            'shoes': '신발',
            'bag': '가방',
            'accessory': '악세사리'
        }
        
        for category, items in search_results.items():
            category_ko = category_names.get(category, category)
            item_count = len(items) if isinstance(items, list) else 0
            if item_count > 0:
                message += f"• {category_ko}: {item_count}개 링크\n"
        
        message += f"\n자세한 결과를 보시려면 아래 링크를 클릭하세요:\n"
        # TODO: Generate a shareable results page URL
        message += f"[결과 페이지 URL]"
        
        return message
    
    def send_sms_twilio(self, to_number: str, message: str) -> bool:
        """Send SMS via Twilio"""
        try:
            from twilio.rest import Client
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            
            # Format Korean number for Twilio (+82...)
            if not to_number.startswith('+'):
                to_number = f"+82{to_number[1:]}"  # Remove leading 0, add +82
            
            message = client.messages.create(
                body=message,
                from_=TWILIO_FROM_NUMBER,
                to=to_number
            )
            
            print(f"  📱 SMS sent (SID: {message.sid})")
            return True
        except Exception as e:
            print(f"  ❌ SMS failed: {e}")
            return False
    
    def send_message(self, phone: str, results: Dict) -> bool:
        """Send results to user"""
        message = self.format_results_message(phone, results)
        
        if self.service == 'twilio':
            return self.send_sms_twilio(phone, message)
        elif self.service == 'kakao':
            # TODO: Implement KakaoTalk API
            print(f"  ⚠️  KakaoTalk not implemented yet")
            print(f"  📱 Message preview:\n{message}")
            return False
        else:
            print(f"  ⚠️  Unknown service: {self.service}")
            print(f"  📱 Message preview:\n{message}")
            return False


def main():
    parser = argparse.ArgumentParser(description='Process images and send results to users')
    parser.add_argument('--mode', choices=['test', 'production'], default='test',
                       help='Test mode processes only first 3 users')
    parser.add_argument('--skip-processing', action='store_true',
                       help='Skip processing, only send messages (assumes results exist)')
    parser.add_argument('--skip-sending', action='store_true',
                       help='Skip sending messages, only process images')
    args = parser.parse_args()
    
    # Read Excel file
    print("📖 Reading Excel file...")
    df = pd.read_excel(EXCEL_FILE_PATH)
    
    # Clean up column names
    df.columns = ['image_url', 'phone']
    
    print(f"Found {len(df)} users")
    
    # In test mode, only process first 3
    if args.mode == 'test':
        print("⚠️  TEST MODE: Processing only first 3 users")
        df = df.head(3)
    
    # Initialize processors
    processor = PipelineProcessor(BACKEND_URL)
    sender = MessageSender(SMS_SERVICE)
    
    # Process each user
    results_summary = {
        'total': len(df),
        'successful': 0,
        'failed': 0,
        'messages_sent': 0,
        'messages_failed': 0,
        'start_time': datetime.now().isoformat(),
        'results': []
    }
    
    for idx, row in df.iterrows():
        phone = str(row['phone']).strip()
        image_url = str(row['image_url']).strip()
        
        # Process the image
        if not args.skip_processing:
            result = processor.process_user(phone, image_url)
            
            if result and result['status'] == 'success':
                results_summary['successful'] += 1
            else:
                results_summary['failed'] += 1
            
            results_summary['results'].append(result)
            
            # Wait between requests to avoid rate limits
            time.sleep(2)
        else:
            # Load existing result
            result_file = os.path.join(processor.results_dir, f"{phone}_results.json")
            if os.path.exists(result_file):
                with open(result_file, 'r', encoding='utf-8') as f:
                    result = json.load(f)
            else:
                print(f"⚠️  No existing result for {phone}")
                continue
        
        # Send message to user
        if not args.skip_sending and result:
            print(f"\n📱 Sending message to {phone}...")
            if sender.send_message(phone, result):
                results_summary['messages_sent'] += 1
            else:
                results_summary['messages_failed'] += 1
            
            # Wait between SMS sends
            time.sleep(1)
    
    # Save summary
    results_summary['end_time'] = datetime.now().isoformat()
    summary_file = os.path.join(
        processor.results_dir, 
        f"summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(results_summary, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total users: {results_summary['total']}")
    print(f"Successfully processed: {results_summary['successful']}")
    print(f"Failed: {results_summary['failed']}")
    print(f"Messages sent: {results_summary['messages_sent']}")
    print(f"Messages failed: {results_summary['messages_failed']}")
    print(f"Summary saved to: {summary_file}")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()

