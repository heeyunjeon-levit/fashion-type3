#!/bin/bash
# Test the frontend /api/search endpoint with OCR mode

echo "🧪 Testing Frontend OCR Search API"
echo "==================================="
echo ""

# Use a real Supabase image URL (replace with your actual URL)
IMAGE_URL="https://lwpkygpxyaxskotaazdb.supabase.co/storage/v1/object/public/user-uploads/your-image.jpg"

echo "📤 Sending request to frontend /api/search..."
echo "   With useOCRSearch: true"
echo ""

curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d "{
    \"categories\": [],
    \"croppedImages\": {},
    \"originalImageUrl\": \"${IMAGE_URL}\",
    \"useOCRSearch\": true
  }" \
  --max-time 60 \
  --verbose \
  2>&1 | head -100

echo ""
echo ""
echo "✅ Test complete!"

