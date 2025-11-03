# GPU Testing Guide - Easy Switch Between CPU and GPU

## 🎯 Overview

You can now **easily test GPU** and **instantly switch back to CPU** with just one environment variable change in Vercel!

---

## 🏗️ Architecture (Simplified!)

```
┌─────────────────────────────────────────────────────────────┐
│                  Vercel Frontend                             │
│                                                              │
│  Environment Variable (just one!):                          │
│  NEXT_PUBLIC_PYTHON_CROPPER_URL ← CHANGE THIS TO SWITCH!   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Points to one backend URL
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

### Step 2: Save CPU Backend URL (for easy rollback)

**Current CPU URL** (save this somewhere):
```
https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run
```

---

### Step 3: Test GPU Backend

Go to: **Vercel → Project Settings → Environment Variables**

**Change** the existing variable:

```
Name:  NEXT_PUBLIC_PYTHON_CROPPER_URL
Value: https://heeyunjeon-levit--fashion-crop-api-gpu-test-fastapi-app-gpu.modal.run
       ^^^^^^^^
       Change from cpu-v2 to gpu-test
```

Then redeploy (or wait for auto-deploy).

**Frontend will now use GPU!**

#### Option B: Test Locally First

```bash
cd /Users/levit/Desktop/mvp

# Set GPU backend URL
export NEXT_PUBLIC_PYTHON_CROPPER_URL="https://heeyunjeon-levit--fashion-crop-api-gpu-test-fastapi-app-gpu.modal.run"

# Run locally
npm run dev
```

---

### Step 4: Monitor GPU Performance

Open browser console and check:

```
✅ Good signs:
   Using backend: https://...gpu-test...
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
Name:  NEXT_PUBLIC_PYTHON_CROPPER_URL
Value: https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run
       ^^^^^^^^
       Change back from gpu-test to cpu-v2
```

**That's it!** Vercel will auto-redeploy and your app will use the CPU backend again.

**Takes 30 seconds!** ✅

---

## 📊 Comparison Matrix (Simplified!)

| Scenario | NEXT_PUBLIC_PYTHON_CROPPER_URL Value |
|----------|--------------------------------------|
| **Default (Current - CPU)** | `https://...cpu-fastapi-app-v2.modal.run` |
| **Testing GPU** | `https://...gpu-test-fastapi-app-gpu.modal.run` |
| **GPU Failed, Switch Back** | `https://...cpu-fastapi-app-v2.modal.run` |

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

### Stop GPU Backend (Optional)
```bash
# If you're done testing, stop GPU to avoid costs
modal app stop fashion-crop-api-gpu-test
```

---

## 📝 Testing Checklist (Simplified!)

- [ ] Deploy GPU backend (`modal deploy modal_gpu_proper.py`)
- [ ] Copy GPU backend URL from deploy output
- [ ] Save current CPU URL somewhere safe
- [ ] Test locally first (optional but recommended)
- [ ] Change `NEXT_PUBLIC_PYTHON_CROPPER_URL` to GPU URL in Vercel
- [ ] Test 1-2 images, verify crops work
- [ ] Check browser console for "Using backend: ...gpu-test..."
- [ ] Compare timing with CPU baseline
- [ ] If good: Keep GPU URL
- [ ] If bad: Change URL back to CPU (30 seconds!)

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

