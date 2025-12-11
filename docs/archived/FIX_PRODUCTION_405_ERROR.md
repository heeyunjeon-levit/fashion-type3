# 🔧 Fix Production 405 Error - Detection Endpoint

## The Error

```
❌ Failed to load resource: 405 ()
❌ Detection error: Detection failed: 405
```

## Root Cause

The frontend is trying to call the detection endpoint, but:

1. **Missing environment variable** - `NEXT_PUBLIC_GPU_API_URL` not set in Vercel
2. **OR Backend not responding** - Modal GPU endpoint might be sleeping/stopped

## The Detection Flow

```typescript
// Line 156 in app/page.tsx
const detectResponse = await fetch(`${process.env.NEXT_PUBLIC_GPU_API_URL}/detect`, {
  method: 'POST',
  ...
})
```

**If `NEXT_PUBLIC_GPU_API_URL` is undefined:**
- URL becomes: `undefined/detect`
- Results in 405 or network error

## ✅ Solution: Set Environment Variable in Vercel

### Step 1: Go to Vercel Dashboard

1. Visit: https://vercel.com/dashboard
2. Select your project
3. Go to: **Settings** → **Environment Variables**

### Step 2: Add GPU API URL

Add this variable:

```
Name: NEXT_PUBLIC_GPU_API_URL
Value: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
Environment: Production, Preview, Development (check all)
```

### Step 3: Redeploy

**Option A: Redeploy from Dashboard**
- Go to: Deployments
- Click latest deployment
- Click "..." → "Redeploy"

**Option B: Trigger New Deployment**
```bash
cd /Users/levit/Desktop/mvp
git commit --allow-empty -m "trigger: Redeploy after env vars"
git push origin main
```

---

## Alternative: Check Modal Backend

The backend might be stopped or sleeping. Check Modal dashboard:

### Verify Modal Backend is Running:

```bash
# Test the endpoint directly
curl https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/detect \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://test.jpg"}'
```

**Expected:** Should return detection results (or error about bad image)  
**If 405:** Backend needs to be redeployed

### Redeploy Modal Backend:

```bash
cd /Users/levit/Desktop/mvp
modal deploy python_backend/modal_gpu_transformers.py
```

---

## Quick Diagnosis

### Check 1: Environment Variable
```bash
# In your browser console on production site:
console.log(process.env.NEXT_PUBLIC_GPU_API_URL)

# Should show: https://heeyunjeon-levit--fashion-crop...
# If undefined: Environment variable not set in Vercel ❌
```

### Check 2: Backend Health
```bash
curl https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/health

# Should return: {"status": "healthy"}
# If 405/404: Backend not running ❌
```

---

## Complete Environment Variables Needed

Make sure **ALL** these are set in Vercel:

### Detection Backend:
```
NEXT_PUBLIC_GPU_API_URL=https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
```

### OCR Backend:
```
PYTHON_BACKEND_URL=http://localhost:8000  
# OR your deployed Python backend URL
```

### APIs:
```
GCLOUD_API_KEY=AIza...
OPENAI_API_KEY=sk-proj-X5tgi...
SERPER_API_KEY=86765a0b...
```

### Supabase:
```
NEXT_PUBLIC_SUPABASE_URL=https://skcxfyrmjrvdvchdpnfh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
```

---

## Expected Behavior After Fix

### Before (405 Error):
```
Upload → Detection → ❌ 405 Error
```

### After (Working):
```
Upload → Detection → ✅ Items detected → Interactive selection
```

---

## Testing After Fix

1. **Add environment variable** to Vercel
2. **Redeploy** (automatic or manual)
3. **Wait for build** (~3 minutes)
4. **Visit production URL**
5. **Upload image**
6. **Should see:** Detection screen with Instagram-style overlays! ✅

---

## Why This Happens

**Local Development:**
- `.env.local` has `NEXT_PUBLIC_GPU_API_URL`
- Everything works locally ✅

**Production:**
- Vercel doesn't automatically copy `.env.local`
- Environment variables must be set manually in dashboard ⚠️
- Missing variable = `undefined` = 405 error ❌

---

## 🎯 Quick Fix Summary

1. **Go to Vercel** → Your Project → **Settings** → **Environment Variables**
2. **Add:** `NEXT_PUBLIC_GPU_API_URL` = `https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run`
3. **Redeploy** from dashboard or push empty commit
4. **Wait 3 minutes**
5. **Test again** ✅

---

**The deployment succeeded, just needs the environment variable!** 🚀


