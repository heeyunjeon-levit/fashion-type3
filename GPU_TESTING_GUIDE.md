# GPU Testing Guide - Easy Switch Between CPU and GPU

## 🎯 Overview

You can now **easily test GPU** and **instantly switch back to CPU** with just one environment variable change in Vercel!

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Vercel Frontend                             │
│                                                              │
│  Environment Variables:                                     │
│  - NEXT_PUBLIC_PYTHON_CROPPER_URL (CPU backend)            │
│  - NEXT_PUBLIC_PYTHON_CROPPER_URL_GPU (GPU backend)        │
│  - NEXT_PUBLIC_USE_GPU (true/false) ← SWITCH HERE!         │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────────┐      ┌───────────────────┐
│  CPU Backend      │      │  GPU Backend      │
│  (Current/Stable) │      │  (Test/Optional)  │
│                   │      │                   │
│  Always running   │      │  Test only        │
│  fashion-crop-    │      │  fashion-crop-    │
│  api-cpu-v2       │      │  api-gpu-test     │
└───────────────────┘      └───────────────────┘
```

---

## 📋 Step-by-Step Testing Process

### Step 1: Deploy GPU Backend (Separate Deployment)

```bash
cd /Users/levit/Desktop/mvp/python_backend
modal deploy modal_gpu_proper.py
```

**Expected output:**
```
✓ App deployed in X.Xs! 🎉

Web function: https://heeyunjeon-levit--fashion-crop-api-gpu-test-fastapi-app-gpu.modal.run
                                                    ^^^^^^^^
                                                    New GPU app name!
```

**Important**: Copy the GPU backend URL from the output!

---

### Step 2: Add GPU Backend URL to Vercel

Go to: **Vercel → Project Settings → Environment Variables**

Add this **new variable** (don't modify existing ones):

```
Name:  NEXT_PUBLIC_PYTHON_CROPPER_URL_GPU
Value: https://heeyunjeon-levit--fashion-crop-api-gpu-test-fastapi-app-gpu.modal.run
```

**Keep existing variables unchanged:**
- ✅ `NEXT_PUBLIC_PYTHON_CROPPER_URL` (CPU backend) - KEEP AS IS
- ✅ `NEXT_PUBLIC_USE_GPU` - Set to `false` (or leave unset)

---

### Step 3: Test GPU Backend

#### Option A: Test via Environment Variable (Recommended)

Go to Vercel and **temporarily change** one variable:

```
NEXT_PUBLIC_USE_GPU=true  ← Change from false to true
```

Then redeploy (or wait for auto-deploy).

**Frontend will now use GPU!**

#### Option B: Test Locally First

```bash
cd /Users/levit/Desktop/mvp

# Set environment variables
export NEXT_PUBLIC_PYTHON_CROPPER_URL="https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run"
export NEXT_PUBLIC_PYTHON_CROPPER_URL_GPU="https://heeyunjeon-levit--fashion-crop-api-gpu-test-fastapi-app-gpu.modal.run"
export NEXT_PUBLIC_USE_GPU="true"

# Run locally
npm run dev
```

---

### Step 4: Monitor GPU Performance

Open browser console and check:

```
✅ Good signs:
   Backend mode: GPU
   Using URL: https://...gpu-test...
   Crop time: ~15-20s (faster than CPU's ~30-40s)
   
❌ Bad signs:
   NameError: name '_C' is not defined
   Crop time: >40s (no improvement)
   Errors in cropping
```

---

## 🔄 How to Switch Back to CPU (Instantly!)

### If GPU Doesn't Work

**Go to Vercel → Environment Variables:**

```
NEXT_PUBLIC_USE_GPU=false  ← Change from true to false
```

**That's it!** Vercel will auto-redeploy and your app will use the CPU backend again.

**No code changes needed!** ✅

---

## 📊 Comparison Matrix

| Scenario | ENV Variable | Backend Used | URL |
|----------|-------------|--------------|-----|
| **Default (Current)** | `USE_GPU=false` or unset | CPU | `...cpu-fastapi-app-v2...` |
| **Testing GPU** | `USE_GPU=true` | GPU | `...gpu-test-fastapi-app-gpu...` |
| **GPU Failed, Switch Back** | `USE_GPU=false` | CPU | `...cpu-fastapi-app-v2...` |

---

## 🧪 What to Test

### Test 1: Basic Functionality
1. Upload an image with 1-2 items
2. Check browser console for "Backend mode: GPU"
3. Verify crops are generated correctly
4. Check timing (should be ~15-20s instead of ~30-40s)

### Test 2: Parallel Processing
1. Upload an image with 2-3 items
2. Select multiple categories
3. Check that parallel processing works
4. Verify total time is still fast

### Test 3: Error Handling
1. If you see `_C` errors in Modal logs:
   - GPU compilation failed
   - Switch back to CPU immediately
2. If crops are wrong/missing:
   - GPU detection may be less accurate
   - Switch back to CPU

---

## 💰 Cost Monitoring

### During Testing Phase

Monitor your Modal dashboard: https://modal.com/apps

**CPU backend** (your stable one):
- Should show regular usage
- Cost: ~$0.50-1.00/day

**GPU backend** (test):
- Will show usage when you test
- Cost: ~$1.00-2.00/day during active testing
- **Stop it after testing** to avoid costs:
  ```bash
  modal app stop fashion-crop-api-gpu-test
  ```

---

## 🎯 Decision Matrix

### Keep CPU If:
- ✅ GPU doesn't provide 2x+ speed improvement
- ✅ GPU has `_C` errors
- ✅ GPU detection is less accurate
- ✅ GPU costs are too high for your usage
- ✅ Current CPU performance is acceptable

### Switch to GPU If:
- ✅ GPU is 2x+ faster (15s vs 40s)
- ✅ No errors or compilation issues
- ✅ Detection accuracy is same or better
- ✅ You're processing 50+ images/day (GPU becomes cost-effective)

---

## 🚨 Emergency Rollback

If anything goes wrong during testing:

### Immediate Fix (30 seconds)
```
Go to Vercel → Environment Variables
Set: NEXT_PUBLIC_USE_GPU=false
Wait for auto-deploy (1-2 minutes)
✅ Back to stable CPU backend!
```

### Complete Rollback
```bash
# Stop GPU backend entirely
modal app stop fashion-crop-api-gpu-test

# Remove GPU env var from Vercel (optional)
Delete: NEXT_PUBLIC_PYTHON_CROPPER_URL_GPU
Delete: NEXT_PUBLIC_USE_GPU
```

---

## 📝 Testing Checklist

- [ ] Deploy GPU backend (`modal deploy modal_gpu_proper.py`)
- [ ] Copy GPU backend URL
- [ ] Add `NEXT_PUBLIC_PYTHON_CROPPER_URL_GPU` to Vercel
- [ ] Test locally first (optional but recommended)
- [ ] Set `NEXT_PUBLIC_USE_GPU=true` in Vercel
- [ ] Test 1-2 images, verify crops work
- [ ] Check browser console for "Backend mode: GPU"
- [ ] Compare timing with CPU baseline
- [ ] If good: Consider keeping GPU
- [ ] If bad: Set `NEXT_PUBLIC_USE_GPU=false` (instant rollback!)

---

## 🎉 Benefits of This Setup

1. ✅ **Zero risk** - CPU backend stays unchanged
2. ✅ **Instant switching** - One environment variable
3. ✅ **Easy testing** - No code changes needed
4. ✅ **Quick rollback** - 30 seconds if GPU fails
5. ✅ **Both backends available** - Can A/B test

---

## 💡 Pro Tips

### Tip 1: Test During Low Traffic
Test GPU during off-peak hours to minimize impact on real users.

### Tip 2: Use Different URLs
Your setup now has:
- Production URL: `fashion-type3.vercel.app` (CPU backend)
- Test URL: Use Vercel preview deployments for GPU testing

### Tip 3: Monitor Logs
Keep both Modal logs open during testing:
- CPU: `modal app logs fashion-crop-api-cpu-v2`
- GPU: `modal app logs fashion-crop-api-gpu-test`

### Tip 4: Gradual Rollout
If GPU works well, you can:
1. Test with 10% of users (change env var on preview deployment)
2. Monitor for 24 hours
3. If stable, roll out to 100% (change on production)

---

## 🎊 You're Ready!

You now have a **production-grade setup** where you can:
- ✅ Test GPU safely
- ✅ Switch back to CPU instantly
- ✅ Monitor both backends
- ✅ Make data-driven decisions

**Start with GPU testing whenever you're ready!** 🚀

