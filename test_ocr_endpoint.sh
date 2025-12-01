#!/bin/bash
# Quick test script for V3.1 OCR Search endpoint

echo "🧪 Testing V3.1 OCR Search Endpoint"
echo "===================================="
echo ""

# Check if backend URL is provided
if [ -z "$1" ]; then
    BACKEND_URL="http://localhost:8000"
    echo "ℹ️  No backend URL provided, using: $BACKEND_URL"
    echo "   Usage: ./test_ocr_endpoint.sh <backend_url>"
else
    BACKEND_URL="$1"
    echo "🎯 Testing backend: $BACKEND_URL"
fi

# Sample Supabase image URL (replace with your actual test image)
IMAGE_URL="https://your-supabase-url.supabase.co/storage/v1/object/public/user-uploads/test-image.jpg"

echo ""
echo "📤 Sending test request..."
echo ""

# Make the request
curl -X POST "${BACKEND_URL}/ocr-search" \
  -H "Content-Type: application/json" \
  -d "{\"imageUrl\": \"${IMAGE_URL}\"}" \
  --max-time 120 \
  --silent \
  --show-error \
  --write-out "\n\n⏱️  Response time: %{time_total}s\n" | jq '.'

echo ""
echo "✅ Test complete!"
echo ""
echo "Expected response structure:"
echo "{
  \"success\": true,
  \"product_results\": [...],
  \"mapping\": {...},
  \"summary\": {
    \"total_products\": 2,
    \"successful_searches\": 2
  }
}"

