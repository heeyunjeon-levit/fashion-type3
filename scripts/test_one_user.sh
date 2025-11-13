#!/bin/bash

# Test with one user and get a shareable link
# This is the EASIEST way to test before processing all 41 users

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       Test with One User - Get Shareable Link              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check BACKEND_URL
if [ -z "$BACKEND_URL" ]; then
    echo "⚠️  BACKEND_URL not set"
    echo ""
    read -p "Enter your backend URL (e.g., https://your-app.vercel.app): " BACKEND_URL
    export BACKEND_URL=$BACKEND_URL
fi

echo "Backend: $BACKEND_URL"
echo ""

# Process one user
echo "Step 1: Processing first user from Excel..."
echo "──────────────────────────────────────────────────────────────"
python3 scripts/process_single_user.py

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Processing failed. Please check the errors above."
    exit 1
fi

echo ""
echo "Step 2: Hosting the result..."
echo "──────────────────────────────────────────────────────────────"

# Find the HTML file
HTML_FILE=$(ls single_user_test/*_result.html 2>/dev/null | head -1)

if [ -z "$HTML_FILE" ]; then
    echo "❌ No HTML file found"
    exit 1
fi

PHONE=$(basename "$HTML_FILE" | sed 's/_result.html//')

# Copy to public folder
echo "📁 Copying to public/results/ for Vercel deployment..."
mkdir -p public/results
cp "$HTML_FILE" "public/results/$PHONE.html"
echo "✅ Copied to: public/results/$PHONE.html"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    ✅ SUCCESS!                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Local file created: $HTML_FILE"
echo ""
echo "📱 To view locally:"
echo "   open $HTML_FILE"
echo ""
echo "🌐 To make it accessible from any device:"
echo ""
echo "Option 1: Deploy to Vercel (Recommended)"
echo "   vercel --prod"
echo "   Then access at: https://your-app.vercel.app/results/$PHONE.html"
echo ""
echo "Option 2: Quick test with ngrok (if installed)"
echo "   cd single_user_test && python3 -m http.server 8000 &"
echo "   ngrok http 8000"
echo "   Then add: /$PHONE_result.html to the ngrok URL"
echo ""
echo "Option 3: Local network only"
echo "   cd single_user_test && python3 -m http.server 8000"
echo "   Then visit: http://localhost:8000/$PHONE_result.html"
echo ""

# Ask if they want to deploy now
read -p "Do you want to deploy to Vercel now? (y/n): " DEPLOY

if [ "$DEPLOY" = "y" ] || [ "$DEPLOY" = "Y" ]; then
    echo ""
    echo "🚀 Deploying to Vercel..."
    vercel --prod
    echo ""
    echo "✅ Deployed! Access at:"
    echo "   https://your-app.vercel.app/results/$PHONE.html"
fi

echo ""
echo "Done! 🎉"

