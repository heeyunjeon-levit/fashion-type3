#!/usr/bin/env python3
"""
Generate secure result link for a specific user
"""
import sys
sys.path.insert(0, 'scripts')
from scripts.phone_hasher import hash_phone

# User's phone number
PHONE = '01024450277'
BASE_URL = 'https://fashionsource.vercel.app'

# Generate secure hash
hashed_id = hash_phone(PHONE)

print(f'\n{"="*80}')
print(f'🔗 Secure Result Link for User: {PHONE}')
print(f'{"="*80}\n')
print(f'Secure Hash ID: {hashed_id}')
print(f'\n📱 Result Link:')
print(f'   {BASE_URL}/results/{hashed_id}.html')
print(f'\n💬 SMS Message:')
print(f'   안녕하세요! 요청하신 이미지 분석 결과입니다: {BASE_URL}/results/{hashed_id}.html')
print(f'\n📊 To check if results exist:')
print(f'   1. Go to Supabase → SQL Editor')
print(f'   2. Run: SELECT * FROM sessions WHERE phone_number = \'{PHONE}\' ORDER BY created_at DESC LIMIT 1;')
print(f'   3. If session exists, the HTML file should be at: public/results/{hashed_id}.html')
print(f'\n💡 If HTML file does not exist yet:')
print(f'   User needs to upload their image at: {BASE_URL}')
print(f'   Then the system will automatically generate {hashed_id}.html')
print()

