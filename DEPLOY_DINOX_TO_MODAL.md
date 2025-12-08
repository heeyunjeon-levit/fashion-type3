# Deploy DINO-X Hybrid to Modal

## 🚀 Quick Deploy Guide

### Step 1: Create DINO-X Secret in Modal

```bash
# Create a new Modal secret for DINO-X API token
modal secret create dinox-api-key DDS_API_TOKEN=your_dinox_api_token_here
```

**Where to get your DINO-X API token:**
- Go to https://cloud.deepdataspace.com/
- Sign up / Log in
- Go to API Keys section
- Copy your API token

### Step 2: Verify Existing Secrets

Make sure you have the `fashion-api-keys` secret with:
```bash
# Check existing secrets
modal secret list

# If fashion-api-keys exists, verify it has these keys:
# - OPENAI_API_KEY (for GPT-4o-mini descriptions)
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Step 3: Deploy to Modal

```bash
cd /Users/levit/Desktop/mvp/python_backend
modal deploy modal_gpu_transformers.py
```

**Expected output:**
```
✓ Created objects.
├── 🔨 Created mount /Users/levit/Desktop/mvp/python_backend/api
├── 🔨 Created mount /Users/levit/Desktop/mvp/python_backend/src
├── 🔨 Created function fastapi_app_v2
└── 🔨 Created function test_gpu

✓ App deployed! 🎉

View Deployment: https://modal.com/apps/...
```

### Step 4: Test the Deployment

```bash
# Test GPU availability
modal run modal_gpu_transformers.py

# Or test via API
curl https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/
```

## 📡 Using the API

### Option 1: GPT-4o Vision (Default)
```bash
curl -X POST "https://your-modal-url.modal.run/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://your-image-url.jpg",
    "use_dinox": false
  }'
```

**Result:**
- Detection time: ~10-15s
- Detailed descriptions from GPT-4o Vision
- Cost: ~$0.03 per image

### Option 2: DINO-X + GPT-4o-mini (Hybrid - Recommended!)
```bash
curl -X POST "https://your-modal-url.modal.run/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://your-image-url.jpg",
    "use_dinox": true
  }'
```

**Result:**
- Detection time: ~5-6s (3x faster!)
- Detailed descriptions from GPT-4o-mini
- Cost: ~$0.003 per image (10x cheaper!)

## 🔧 Troubleshooting

### Issue: `dinox-api-key secret not found`

**Solution:**
```bash
# Create the secret
modal secret create dinox-api-key DDS_API_TOKEN=your_token

# Redeploy
modal deploy modal_gpu_transformers.py
```

### Issue: `OpenAI API key not found`

**Solution:**
```bash
# Add to existing fashion-api-keys secret
modal secret update fashion-api-keys OPENAI_API_KEY=your_openai_key

# Or create new if it doesn't exist
modal secret create fashion-api-keys \
  OPENAI_API_KEY=your_openai_key \
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### Issue: `ModuleNotFoundError: No module named 'dds_cloudapi_sdk'`

**Solution:**
The `dds-cloudapi-sdk` should be installed automatically. If not:
```bash
# Force rebuild the image
modal deploy modal_gpu_transformers.py --force-build
```

### Issue: Slow cold starts

**Solution:**
Modal keeps the container warm for 10 minutes by default (`scaledown_window=600`). For production, consider:
```python
scaledown_window=1800,  # 30 minutes
keep_warm=1,  # Always keep 1 container ready
```

## 📊 Performance Comparison

| Mode | Detection | Description | Time | Cost | Use Case |
|------|-----------|-------------|------|------|----------|
| **GPT-4o Vision** | GPT-4o | Included | 10-15s | $0.03 | Maximum quality |
| **DINO-X Only** | DINO-X | Generic | 3-4s | $0.002 | Maximum speed, minimal cost |
| **Hybrid** (Recommended) | DINO-X | GPT-4o-mini | 5-6s | $0.003 | Best balance |

## 🎯 Recommended Configuration

### For Production:
```python
# In modal_gpu_transformers.py
@app.function(
    gpu="any",
    cpu=2.0,
    memory=16384,
    timeout=600,
    scaledown_window=1800,  # 30 min warm
    keep_warm=1,  # Always 1 ready
)
```

### API Request (Frontend):
```typescript
// Use hybrid mode by default
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: uploadedImageUrl,
    use_dinox: true  // Enable hybrid DINO-X + GPT-4o-mini
  })
});
```

## 🔄 Rollback Plan

If DINO-X causes issues, simply:

1. **Set `use_dinox: false` in API requests** - Instant rollback to GPT-4o
2. **No code changes needed** - Feature flag controls behavior
3. **No redeployment required** - Works immediately

## 📈 Next Steps

1. ✅ Deploy to Modal with DINO-X support
2. ⏸️ Test with real user images
3. ⏸️ Monitor performance metrics (speed, cost, quality)
4. ⏸️ A/B test with users
5. ⏸️ Set `use_dinox: true` as default if quality is good

## 🎉 Success Criteria

After deployment, verify:
- ✅ API responds within 10 seconds
- ✅ Detects 3-6 items per fashion image
- ✅ Descriptions include color, material, style
- ✅ Search results are relevant
- ✅ Cost per image < $0.01

---

**Ready to deploy?**

```bash
cd /Users/levit/Desktop/mvp/python_backend
modal secret create dinox-api-key DDS_API_TOKEN=your_token
modal deploy modal_gpu_transformers.py
```

🚀 Let's ship it!


