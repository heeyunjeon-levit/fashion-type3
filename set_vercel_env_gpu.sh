#!/bin/bash

# Script to update Vercel environment variable to GPU backend
# This updates NEXT_PUBLIC_PYTHON_CROPPER_URL to the new GPU backend URL

set -e

GPU_URL="https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run"

echo "🚀 Updating Vercel Environment Variable to GPU Backend"
echo ""
echo "📍 New Backend URL: $GPU_URL"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Installing..."
    npm install -g vercel
    echo ""
fi

echo "🔐 Authenticating with Vercel..."
vercel login

echo ""
echo "📝 Current project environment variables:"
vercel env ls
echo ""

echo "🔄 Removing old NEXT_PUBLIC_PYTHON_CROPPER_URL (if exists)..."
vercel env rm NEXT_PUBLIC_PYTHON_CROPPER_URL production || echo "   (Not found in production)"
vercel env rm NEXT_PUBLIC_PYTHON_CROPPER_URL preview || echo "   (Not found in preview)"
vercel env rm NEXT_PUBLIC_PYTHON_CROPPER_URL development || echo "   (Not found in development)"

echo ""
echo "✨ Adding new GPU backend URL..."

# Add to all environments
echo "$GPU_URL" | vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL production
echo "$GPU_URL" | vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL preview
echo "$GPU_URL" | vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL development

echo ""
echo "✅ Environment variable updated successfully!"
echo ""
echo "📋 Updated environments:"
vercel env ls | grep NEXT_PUBLIC_PYTHON_CROPPER_URL || echo "   Variable set (use 'vercel env ls' to verify)"

echo ""
echo "🚀 Next step: Redeploy your frontend"
echo "   Option 1: vercel --prod"
echo "   Option 2: git push origin main"
echo "   Option 3: Redeploy via Vercel Dashboard"
echo ""
echo "📚 See UPDATE_FRONTEND_GPU.md for full instructions"

