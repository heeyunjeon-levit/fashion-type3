#!/bin/bash

# Quick start script for processing user images and generating results
# This is the easiest way to get started!

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       User Results Processing - Quick Start                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if BACKEND_URL is set
if [ -z "$BACKEND_URL" ]; then
    echo "⚠️  BACKEND_URL not set"
    echo ""
    read -p "Enter your backend URL (e.g., https://your-app.vercel.app): " BACKEND_URL
    export BACKEND_URL=$BACKEND_URL
fi

echo "Backend URL: $BACKEND_URL"
echo ""

# Check backend readiness
echo "Step 1: Testing backend connectivity..."
echo "──────────────────────────────────────"
python3 scripts/test_backend_ready.py

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Backend test failed. Please fix the issues above and try again."
    exit 1
fi

echo ""
echo "Step 2: Choose processing mode"
echo "──────────────────────────────────────"
echo "1. TEST mode (process 3 users only)"
echo "2. PRODUCTION mode (process all 41 users)"
echo ""
read -p "Enter choice (1 or 2): " MODE_CHOICE

if [ "$MODE_CHOICE" = "1" ]; then
    MODE="test"
    echo "✅ TEST mode selected (3 users)"
elif [ "$MODE_CHOICE" = "2" ]; then
    MODE="production"
    echo "⚠️  PRODUCTION mode selected (41 users)"
    echo ""
    read -p "This will process all 41 users. Continue? (y/n): " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "Cancelled."
        exit 0
    fi
else
    echo "Invalid choice"
    exit 1
fi

echo ""
echo "Step 3: Processing images..."
echo "──────────────────────────────────────"
echo "This may take a while. Each image takes ~30-60 seconds."
echo ""

python3 scripts/process_and_send_results.py --mode $MODE --skip-sending

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Processing failed. Check the errors above."
    exit 1
fi

echo ""
echo "Step 4: Generating HTML result pages..."
echo "──────────────────────────────────────"

python3 scripts/generate_results_pages.py

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ HTML generation failed. Check the errors above."
    exit 1
fi

echo ""
echo "Step 5: Preview messages (optional)"
echo "──────────────────────────────────────"
read -p "Do you want to preview the messages? (y/n): " PREVIEW

if [ "$PREVIEW" = "y" ] || [ "$PREVIEW" = "Y" ]; then
    python3 scripts/preview_messages.py | head -50
    echo ""
    read -p "Press Enter to continue..."
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    ✅ ALL DONE!                             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Results saved to:"
echo "  📁 batch_user_results/         - JSON results"
echo "  📁 batch_user_results/html_pages/  - HTML pages"
echo ""
echo "Next steps:"
echo "  1. Review results: open batch_user_results/html_pages/*.html"
echo "  2. Host on web server (Vercel, GitHub Pages, etc.)"
echo "  3. Share links with users via KakaoTalk"
echo ""
echo "Or run this to send messages automatically:"
echo "  python3 scripts/process_and_send_results.py --mode $MODE --skip-processing"
echo ""

