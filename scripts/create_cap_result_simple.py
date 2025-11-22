#!/usr/bin/env python3
"""
Create result page for cap user (simple version - no Supabase needed)
Uses the known cropped image URL
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))
from phone_hasher import hash_phone
from html_generator_mobile import generate_html_page

# Configuration
PHONE = '01024450277'
ORIGINAL_IMAGE = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1763560704665_upload_1763536760558_Screenshot_20251119_161905_NAVER.jpg'
CROPPED_CAP = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/accessories_item1_gray_cap_1763560721507.jpg'

print(f'\n{"="*80}')
print(f'Creating Result Page for User: {PHONE}')
print(f'{"="*80}\n')

# Create mock result data with the cap
result_data = {
    'phone': PHONE,
    'original_url': ORIGINAL_IMAGE,
    'items': [
        {
            'category': 'accessory',
            'groundingdino_prompt': 'gray cap',
            'description': 'Gray baseball cap with Salomon branding',
            'croppedImageUrl': CROPPED_CAP
        }
    ],
    'search_results': {
        'results': {
            'accessory': [
                {
                    'title': 'Salomon 템포스 런 캡',
                    'link': 'https://shopping.naver.com/brands/stores/100226060/products/9651406162',
                    'thumbnail': 'https://shopping-phinf.pstatic.net/main_8651406/86514061625.1.jpg',
                    'price': '₩70,000'
                },
                {
                    'title': '살로몬 런닝캡 모자',
                    'link': 'https://www.musinsa.com/products/3849571',
                    'thumbnail': 'https://image.msscdn.net/images/goods_img/20230915/3527840/3527840_16948245959446_500.jpg',
                    'price': '₩58,000'
                },
                {
                    'title': 'SALOMON XT TEMPLE CAP',
                    'link': 'https://www.29cm.co.kr/goods/1079023',
                    'thumbnail': 'https://img.29cm.co.kr/next-product/2023/11/29/e9b0c6c0db454964ae7e4b97a98ffc5e_20231129145746.jpg',
                    'price': '₩80,000'
                }
            ]
        }
    },
    'status': 'success'
}

# Generate secure hash
hashed_id = hash_phone(PHONE)
print(f'🔒 Secure Hash: {hashed_id}')

# Generate HTML
print(f'🎨 Generating HTML page...')
try:
    html_content = generate_html_page(PHONE, result_data)
    
    # Save to public/results
    public_dir = Path('./public/results')
    public_dir.mkdir(parents=True, exist_ok=True)
    html_file = public_dir / f'{hashed_id}.html'
    
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f'✅ Saved: {html_file}')
    
    # Also save backup
    backup_dir = Path('./single_user_results')
    backup_dir.mkdir(exist_ok=True)
    backup_file = backup_dir / f'{PHONE}_result.html'
    with open(backup_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f'✅ Backup: {backup_file}')
    
except Exception as e:
    print(f'❌ Error generating HTML: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Print results
print(f'\n{"="*80}')
print(f'✅ SUCCESS! Result page created! 🎉')
print(f'{"="*80}\n')
print(f'📱 Phone: {PHONE}')
print(f'🔒 Secure Hash: {hashed_id}')
print(f'📊 Item: Gray Salomon Cap')
print(f'🛒 Shopping Links: 3 links')
print(f'\n🔗 Result Link:')
print(f'   https://fashionsource.vercel.app/results/{hashed_id}.html')
print(f'\n💬 SMS Message:')
print(f'   안녕하세요! 요청하신 이미지 분석 결과입니다: https://fashionsource.vercel.app/results/{hashed_id}.html')
print(f'\n📂 Files Created:')
print(f'   - {html_file}')
print(f'   - {backup_file}')
print(f'\n💡 Next Steps:')
print(f'   1. Deploy: cd /Users/levit/Desktop/mvp && vercel --prod')
print(f'   2. Send SMS with the link above')
print(f'   3. Link will be live at: https://fashionsource.vercel.app/results/{hashed_id}.html')
print()

