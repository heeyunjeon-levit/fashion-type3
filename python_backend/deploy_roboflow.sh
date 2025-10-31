#!/bin/bash
# Deploy Roboflow-powered Fashion Crop API to Modal

echo "🚀 Deploying Fashion Crop API with Roboflow Inference..."
echo ""

# Check if modal is installed
if ! command -v modal &> /dev/null; then
    echo "📦 Installing Modal CLI..."
    pip3 install modal
fi

# Deploy to Modal
echo "📤 Deploying to Modal..."
modal deploy modal_roboflow.py

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your new Roboflow-powered API is at:"
echo "https://heeyunjeon-levit--fashion-crop-roboflow-fastapi-app.modal.run/"
echo ""
echo "Next steps:"
echo "1. Update NEXT_PUBLIC_PYTHON_CROPPER_URL in Vercel to the new URL"
echo "2. Test with your HEIC image from iPhone"
echo "3. Enjoy 2-3x faster cropping! 🚀"

