#!/bin/bash

# GPU Backend Deployment Script
# Deploys to: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/

set -e  # Exit on error

echo "🚀 Deploying GPU-enabled Modal backend..."
echo ""

# Check if modal is installed
if ! command -v modal &> /dev/null; then
    echo "❌ Modal CLI not found. Install it with: pip install modal"
    exit 1
fi

# Check if we're authenticated
echo "🔐 Checking Modal authentication..."
if ! modal token list &> /dev/null; then
    echo "❌ Not authenticated with Modal. Run: modal token new"
    exit 1
fi
echo "✅ Authenticated"
echo ""

# Change to backend directory
cd "$(dirname "$0")/python_backend"

# Deploy the app
echo "📦 Deploying to Modal..."
echo "   App: fashion-crop-api-gpu"
echo "   Function: fastapi_app_v2"
echo "   URL: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/"
echo ""

modal deploy modal_gpu_transformers.py

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Your backend is live at:"
echo "   https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/"
echo ""
echo "🧪 To test it, run:"
echo "   node test_modal_gpu.js"
echo ""
echo "📊 To view logs:"
echo "   modal app logs fashion-crop-api-gpu"
echo ""

