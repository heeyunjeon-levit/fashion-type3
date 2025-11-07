#!/bin/bash

# GPU Backend Deployment Script
# Quick deployment of GPU-accelerated fashion crop API

set -e  # Exit on error

echo "🚀 Deploying GPU Backend to Modal..."
echo ""
echo "📍 Target URL: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run"
echo ""

# Change to backend directory
cd python_backend

# Deploy with Modal
echo "📦 Deploying to Modal..."
modal deploy modal_gpu_transformers.py

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 Testing health endpoint..."
sleep 3  # Wait for deployment to stabilize

# Test the endpoint
response=$(curl -s https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/)
echo "$response"
echo ""

# Check if cropper is available
if echo "$response" | grep -q '"cropper_available":true'; then
    echo "✅ GPU Backend is healthy and ready!"
    echo ""
    echo "📊 Next steps:"
    echo "   1. Run: node test_gpu_quick.js (quick test)"
    echo "   2. Run: node batch_test_batch2_hybrid.js (full batch)"
    echo "   3. Update frontend to use GPU URL"
else
    echo "⚠️  Deployment succeeded but cropper initialization may have issues"
    echo "   Check debug endpoint: curl https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/debug"
fi

echo ""
echo "📚 Documentation:"
echo "   - Quick Reference: GPU_BACKEND_QUICKREF.md"
echo "   - Full Guide: GPU_BACKEND_COMPLETE.md"
echo ""
echo "🔗 Monitor at: https://modal.com/apps/heeyunjeon-levit/fashion-crop-api-gpu"

