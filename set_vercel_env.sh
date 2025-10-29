#!/bin/bash
# Script to set environment variable in Vercel

echo "Setting NEXT_PUBLIC_PYTHON_CROPPER_URL in Vercel..."

# Set for production
vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL production

# When prompted, paste this value:
# https://heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run

echo ""
echo "After adding the variable, redeploy with:"
echo "vercel --prod"

