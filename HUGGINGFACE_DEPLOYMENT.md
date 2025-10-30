# Hugging Face Spaces Deployment Guide

This guide explains how to deploy the Fashion Crop API to Hugging Face Spaces with GPU support.

## 🚀 Why Hugging Face Spaces?

- ✅ **Better PyTorch GPU Support** - No `torchvision._C` errors
- ✅ **Free GPU Tier** - A10G GPU available
- ✅ **Built for ML** - Optimized for PyTorch/TorchVision
- ✅ **Easy Deployment** - Just push to Git

## 📋 Prerequisites

1. **Hugging Face Account**
   - Sign up at https://huggingface.co
   - Get your access token from https://huggingface.co/settings/tokens

2. **Install Hugging Face CLI**
   ```bash
   pip install huggingface_hub
   ```

## 🎯 Quick Start

### Step 1: Create a Space

1. Go to https://huggingface.co/new-space
2. Fill in:
   - **Space name**: `fashion-crop-api` (or your choice)
   - **SDK**: `Docker`
   - **Hardware**: `GPU` (A10G - free tier)
   - **Visibility**: `Public` or `Private`

### Step 2: Clone Your Space

```bash
git clone https://huggingface.co/spaces/YOUR_USERNAME/fashion-crop-api
cd fashion-crop-api
```

### Step 3: Copy Files

Copy these files to your Space repository:

```bash
# From your project root
cd /path/to/your-space

# Copy deployment files
cp ../mvp/Dockerfile .
cp ../mvp/requirements-gpu.txt .

# Copy application code (directly to Space root, not in python_backend/)
cp -r ../mvp/python_backend/api .
cp -r ../mvp/python_backend/src .
cp -r ../mvp/python_backend/configs .
cp -r ../mvp/python_backend/data .
cp ../mvp/python_backend/crop_api.py .
cp ../mvp/python_backend/custom_item_cropper.py .

# Copy README for Space page
cp ../mvp/README.md .
```

**File Structure in Space:**
```
your-space/
├── Dockerfile
├── requirements-gpu.txt
├── README.md
├── api/
├── src/
├── configs/
├── data/
│   └── weights/
├── crop_api.py
└── custom_item_cropper.py
```

### Step 4: Set Environment Variables

In your Space settings, add these secrets:

- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Your Supabase URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `USE_SAM2`: `false` (for faster cropping without SAM-2)

### Step 5: Push and Deploy

```bash
cd /path/to/your-space
git add .
git commit -m "Initial deployment"
git push
```

Hugging Face Spaces will automatically build and deploy! 🎉

## 🔍 Verify Deployment

1. Go to your Space URL: `https://huggingface.co/spaces/YOUR_USERNAME/fashion-crop-api`
2. Wait for build to complete (~5-10 minutes)
3. Test the API:
   ```bash
   curl https://YOUR_USERNAME-fashion-crop-api.hf.space/
   ```

## 🔗 Update Frontend

Update your Vercel environment variable:

```
NEXT_PUBLIC_PYTHON_CROPPER_URL=https://YOUR_USERNAME-fashion-crop-api.hf.space
```

## ⚙️ Configuration

### GPU Settings

- **Hardware**: A10G (free tier) or A100 (paid)
- **GPU Memory**: Automatically allocated
- **CUDA**: Pre-installed by Hugging Face

### Port Configuration

The Dockerfile exposes port `7860` which is Hugging Face Spaces' default.

### Model Caching

Models (GroundingDINO, SAM-2) will be downloaded on first run and cached in the container.

## 🐛 Troubleshooting

### Build Fails

1. Check logs in Space settings
2. Verify all files are copied correctly
3. Ensure `requirements-gpu.txt` doesn't conflict with PyTorch install

### GPU Not Available

1. Verify Space hardware is set to `GPU`
2. Check logs for CUDA errors
3. Test with: `python -c "import torch; print(torch.cuda.is_available())"`

### `torchvision._C` Error

If you still get this error (unlikely on Hugging Face):
1. Try rebuilding the Space
2. Clear cache and rebuild
3. Check PyTorch version compatibility

## 📊 Performance

Expected performance with GPU:
- **Cold start**: ~30-60s (first request)
- **Warm start**: ~5-10s (subsequent requests)
- **Crop time**: ~8-12s per item (with GPU)

## 💰 Pricing

- **Free Tier**: A10G GPU, 16GB RAM
- **Pro Tier**: $9/month - A100 GPU, more resources
- **Enterprise**: Custom pricing

## 🔗 Resources

- [Hugging Face Spaces Docs](https://huggingface.co/docs/hub/spaces)
- [Docker Spaces Guide](https://huggingface.co/docs/hub/spaces-sdks-docker)
- [GPU Hardware](https://huggingface.co/docs/hub/spaces-gpus)

