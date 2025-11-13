"""
Preview what messages will be sent to users without actually sending them.
Useful for testing message formatting.
"""

import json
import os
from pathlib import Path

def format_message(phone: str, results: dict) -> str:
    """Format the message that would be sent to user"""
    if results['status'] != 'success':
        return f"[{phone}] 죄송합니다. 이미지 처리 중 오류가 발생했습니다."
    
    search_results = results.get('search_results', {}).get('results', {})
    
    message = f"[{phone}] 🎉 이미지 분석 결과가 나왔습니다!\n\n"
    
    product_count = len(search_results)
    if product_count == 0:
        message += "죄송합니다. 상품을 찾을 수 없었습니다."
        return message
    
    message += f"총 {product_count}개의 상품을 찾았습니다:\n\n"
    
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
    message += f"https://your-app.vercel.app/results/{phone}.html"
    
    return message

def main():
    results_dir = './batch_user_results'
    
    # Find all result JSON files
    result_files = list(Path(results_dir).glob('*_results.json'))
    
    if not result_files:
        print("❌ No result files found in ./batch_user_results/")
        print("Run process_and_send_results.py first to generate results.")
        return
    
    print(f"{'='*80}")
    print(f"MESSAGE PREVIEW - {len(result_files)} users")
    print(f"{'='*80}\n")
    
    success_count = 0
    failed_count = 0
    
    for result_file in sorted(result_files):
        phone = result_file.stem.replace('_results', '')
        
        with open(result_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        
        message = format_message(phone, results)
        
        if results['status'] == 'success':
            success_count += 1
        else:
            failed_count += 1
        
        print(message)
        print(f"\nMessage length: {len(message)} characters")
        print(f"SMS count: {(len(message) // 70) + 1} (KR SMS ~70 chars each)")
        print(f"\n{'-'*80}\n")
    
    print(f"{'='*80}")
    print(f"SUMMARY")
    print(f"{'='*80}")
    print(f"Total: {len(result_files)}")
    print(f"Success: {success_count}")
    print(f"Failed: {failed_count}")
    print(f"{'='*80}")
    
    # Estimate costs
    total_sms = sum(((len(format_message(
        f.stem.replace('_results', ''), 
        json.load(open(f, 'r', encoding='utf-8'))
    )) // 70) + 1) for f in result_files)
    
    print(f"\nCost Estimates:")
    print(f"  Twilio (international): ${total_sms * 0.02:.2f} - ${total_sms * 0.05:.2f}")
    print(f"  Korean SMS (Aligo): ₩{total_sms * 15} - ₩{total_sms * 30}")
    print(f"  KakaoTalk (manual): Free")
    print(f"  HTML pages (hosted): Free")

if __name__ == '__main__':
    main()

