#!/bin/bash

# Setup script for SMS environment variables
# Run this before using process_and_send_results.py

echo "SMS/Messaging Service Setup"
echo "==========================="
echo ""
echo "Choose your messaging service:"
echo "1. Twilio (International SMS)"
echo "2. Aligo (Korean SMS service)"
echo "3. KakaoTalk (Korean messaging)"
echo "4. Generate results page only (no messaging)"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    echo ""
    echo "Twilio Setup"
    echo "============"
    echo "Get your credentials from: https://console.twilio.com/"
    echo ""
    read -p "Twilio Account SID: " TWILIO_ACCOUNT_SID
    read -p "Twilio Auth Token: " TWILIO_AUTH_TOKEN
    read -p "Twilio Phone Number (e.g., +1234567890): " TWILIO_FROM_NUMBER
    
    export SMS_SERVICE=twilio
    export TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
    export TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
    export TWILIO_FROM_NUMBER=$TWILIO_FROM_NUMBER
    
    echo ""
    echo "✅ Twilio configured!"
    echo "Run: pip3 install twilio"
    ;;
    
  2)
    echo ""
    echo "Aligo Setup (Korean SMS)"
    echo "======================="
    echo "Get credentials from: https://smartsms.aligo.in/"
    echo ""
    read -p "Aligo API Key: " ALIGO_API_KEY
    read -p "Aligo User ID: " ALIGO_USER_ID
    read -p "Aligo Sender Number: " ALIGO_SENDER
    
    export SMS_SERVICE=aligo
    export ALIGO_API_KEY=$ALIGO_API_KEY
    export ALIGO_USER_ID=$ALIGO_USER_ID
    export ALIGO_SENDER=$ALIGO_SENDER
    
    echo ""
    echo "✅ Aligo configured!"
    ;;
    
  3)
    echo ""
    echo "KakaoTalk Setup"
    echo "==============="
    echo "Get credentials from: https://developers.kakao.com/"
    echo ""
    read -p "Kakao REST API Key: " KAKAO_REST_API_KEY
    
    export SMS_SERVICE=kakao
    export KAKAO_REST_API_KEY=$KAKAO_REST_API_KEY
    
    echo ""
    echo "✅ KakaoTalk configured!"
    ;;
    
  4)
    export SMS_SERVICE=none
    echo ""
    echo "✅ Will generate results pages only (no messaging)"
    ;;
    
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

# Backend URL
echo ""
echo "Backend Configuration"
echo "===================="
read -p "Backend URL (default: http://localhost:3000): " BACKEND_URL
BACKEND_URL=${BACKEND_URL:-http://localhost:3000}
export BACKEND_URL=$BACKEND_URL

echo ""
echo "✅ Environment configured!"
echo ""
echo "To use these settings, run:"
echo "  source scripts/setup_sms_env.sh"
echo ""
echo "Or add to your ~/.zshrc:"
echo "  export SMS_SERVICE=$SMS_SERVICE"
echo "  export BACKEND_URL=$BACKEND_URL"
if [ "$SMS_SERVICE" = "twilio" ]; then
  echo "  export TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID"
  echo "  export TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN"
  echo "  export TWILIO_FROM_NUMBER=$TWILIO_FROM_NUMBER"
fi

