# GPU Backend Deployment Guide

## Overview

This guide helps you deploy a **GPU-accelerated** Modal backend using **HuggingFace Transformers** GroundingDINO. This is a clean, simple approach recommended by Modal support.

### Key Changes:
- ✅ Uses **HuggingFace transformers** version of GroundingDINO (no manual compilation!)
- ✅ GPU-enabled PyTorch with CUDA 12.1
- ✅ Follows Modal's official CUDA guide
- ✅ ~3-5x faster than CPU version (10-15s vs 40-50s per image)

## Prerequisites

1. Modal account with GPU access
2. Modal CLI installed: `pip install modal`
3. Modal token configured: `modal token new`
4. Fashion API keys secret configured in Modal

## Step 1: Verify Modal Secrets

Make sure your Modal secrets are configured:

```bash
modal secret list
```

You should see:
- `fashion-api-keys` - contains your API keys (OpenAI, Supabase, etc.)

If not configured, create it:

```bash
modal secret create fashion-api-keys \
  OPENAI_API_KEY=your_openai_key \
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

## Step 2: Test GPU Availability

Run the built-in tests to verify GPU works:

```bash
cd python_backend
modal run modal_gpu_transformers.py
```

This will:
1. ✅ Test GPU availability (`nvidia-smi`, PyTorch CUDA)
2. ✅ Test GroundingDINO inference with a sample image
3. ✅ Download models to persistent volume (first run only)

Expected output:
```
TEST 1: GPU Availability
✅ PyTorch version: 2.4.1+cu121
✅ CUDA available: True
✅ CUDA device: NVIDIA A10G

TEST 2: GroundingDINO Inference
📍 Using device: cuda
Detected a cat with confidence 0.479 at location [344.7, 23.11, 637.18, 374.28]
Detected a remote control with confidence 0.478 at location [38.57, 70.0, 176.78, 118.18]
```

## Step 3: Deploy to Modal

Deploy the GPU backend:

```bash
cd python_backend
modal deploy modal_gpu_transformers.py
```

This will:
- Build the Docker image (~5-10 minutes first time)
- Deploy the FastAPI app with GPU support
- Give you a public URL like: `https://your-app-name--fastapi-app-gpu.modal.run`

**Save this URL!** You'll need it for testing and for updating your Next.js frontend.

## Step 4: Test the Deployed Backend

Update `test_modal_gpu.js` with your deployment URL:

```javascript
const GPU_BACKEND_URL = 'https://your-modal-app--fastapi-app-gpu.modal.run';
```

Run the test:

```bash
node test_modal_gpu.js
```

Expected performance:
- **First request (cold start)**: 20-30s (downloading models)
- **Subsequent requests (warm)**: 10-15s (GPU accelerated)
- **CPU version (for comparison)**: 40-50s

## Step 5: Update Your Next.js Frontend

Update the backend URL in your Next.js upload API:

```typescript
// app/api/upload/route.ts
const BACKEND_URL = 'https://your-modal-app--fastapi-app-gpu.modal.run';
```

## Performance Comparison

### CPU Backend (current):
- **Crop time**: 40-50s per image
- **Batch of 64 images**: ~67 minutes
- **Failure rate**: 17% (11/64 images timed out on multi-item)

### GPU Backend (new):
- **Crop time**: 10-15s per image (warm)
- **Estimated batch time**: ~15-20 minutes
- **Expected failure rate**: <5% (much faster, less resource exhaustion)

## Troubleshooting

### Issue: "CUDA not available"
**Solution**: Make sure you're using `gpu="any"` in the function decorator. Modal automatically provides GPU containers.

### Issue: "Model not found in cache"
**Solution**: The first run downloads models (~500MB). Wait for it to complete. Models are cached in the persistent volume.

### Issue: "Slow performance (>30s per image)"
**Possible causes**:
1. **Cold start**: First request after deployment takes longer
2. **CPU fallback**: Check logs for "Using device: cpu" instead of "Using device: cuda"
3. **Network latency**: Image download from Supabase might be slow

### Issue: "Request timeout"
**Solution**: The GPU backend has a 600s (10 minute) timeout. If you still hit timeouts, it might be:
1. Very large images (>5000px) - consider resizing
2. Many items requested (>5) - break into smaller batches

## Cost Estimate

Modal GPU pricing (as of Nov 2025):
- **A10G GPU**: ~$0.75/hour
- **Scaledown window**: 10 minutes (keeps container warm)
- **Estimated cost per image**: $0.003-0.005 (0.3-0.5 cents)
- **Batch of 64 images**: ~$0.20-0.30

This is **3-5x cheaper** than CPU when you factor in speed improvements!

## Next Steps

1. ✅ Deploy GPU backend
2. ✅ Test with single images
3. ✅ Update Next.js frontend
4. ✅ Run small batch test (10 images)
5. ✅ Run full batch test (64 images)
6. 🎉 Celebrate 3-5x speedup!

## Monitoring

Monitor your Modal deployment:
- Dashboard: https://modal.com/apps
- Logs: `modal app logs fashion-crop-api-gpu`
- GPU metrics: Check the Modal dashboard for GPU utilization

## References

- [Modal CUDA Guide](https://modal.com/docs/guide/cuda)
- [HuggingFace GroundingDINO](https://huggingface.co/docs/transformers/en/model_doc/grounding-dino)
- [Modal GPU Examples](https://modal.com/docs/examples)
