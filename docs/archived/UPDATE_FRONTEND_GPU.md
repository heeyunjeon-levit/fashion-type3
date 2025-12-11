# Update Frontend to Use GPU Backend

**Status:** ✅ Ready to Deploy  
**New Backend URL:** `https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run`

---

## ✅ What's Already Done

1. **✅ Local `.env` file updated** - Already points to GPU backend
2. **✅ Backend deployed and tested** - 100% success rate on 3 test images
3. **⬜ Vercel environment variable** - Needs to be updated (see below)

---

## 🚀 Quick Update (2 Steps)

### Step 1: Update Vercel Environment Variable

**Via Vercel Dashboard (Recommended):**

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Find `NEXT_PUBLIC_PYTHON_CROPPER_URL`
5. Update value to:
   ```
   https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
   ```
6. Select all environments (Production, Preview, Development)
7. Click **Save**

**Via Vercel CLI (Alternative):**

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Remove old variable
vercel env rm NEXT_PUBLIC_PYTHON_CROPPER_URL

# Add new variable (will prompt for value)
vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL
# Enter: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
# Select: Production, Preview, Development (all)
```

### Step 2: Redeploy Frontend

After updating the environment variable, redeploy to apply changes:

**Option A: Via Dashboard**
1. Go to Deployments tab
2. Click "Redeploy" on latest deployment
3. Check "Use existing Build Cache"

**Option B: Via Git Push**
```bash
git add .
git commit -m "Update to GPU backend"
git push origin main
```

**Option C: Via Vercel CLI**
```bash
vercel --prod
```

---

## 🔍 Verify the Update

After redeployment, check that GPU backend is being used:

### 1. Check Browser Console

Open your deployed site and check the browser console. You should see:
```
🔗 Using backend: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
```

### 2. Test an Image Upload

Upload a test image and verify:
- ✅ Cropping completes in 7-15 seconds (was 40-90 seconds)
- ✅ All requested items are detected
- ✅ Search results are high quality

### 3. Check Vercel Logs

Go to Vercel Dashboard → Your Project → Deployments → View Function Logs

Look for crop times:
- **Old CPU:** 40-90+ seconds
- **New GPU:** 7-15 seconds ✨

---

## 📊 Expected Performance Improvements

| Scenario | CPU Backend (Old) | GPU Backend (New) | Improvement |
|----------|------------------|-------------------|-------------|
| Single item | 40-50s | 7-10s | **4-5x faster** ⚡ |
| 2 items | 60-80s | 12-15s | **5x faster** ⚡ |
| 3 items | 90-120s | 14-18s | **6x faster** ⚡ |
| User experience | "Is it broken?" | "Wow, so fast!" | 🎉 |

---

## 🛠️ Rollback Plan (If Needed)

If you encounter issues with the GPU backend, you can quickly rollback:

### Rollback to CPU Backend

**Old CPU URL:**
```
https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run
```

**Steps:**
1. Update Vercel env variable back to CPU URL
2. Redeploy
3. Report issue for debugging

---

## 📝 Environment Variable Reference

### Current Configuration

```bash
# Local (.env) - Already updated ✅
NEXT_PUBLIC_PYTHON_CROPPER_URL=https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run

# Vercel - Needs update ⬜
NEXT_PUBLIC_PYTHON_CROPPER_URL=https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
```

### All Required Vercel Environment Variables

Make sure these are all set in Vercel:

```bash
# Backend URL (UPDATE THIS)
NEXT_PUBLIC_PYTHON_CROPPER_URL=https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run

# Supabase (should already be set)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# OpenAI (should already be set)
OPENAI_API_KEY=your_openai_key

# Serper (should already be set)
SERPER_API_KEY=your_serper_key

# Base64 mode (optional, default is false)
NEXT_PUBLIC_USE_BASE64=false
```

---

## 🧪 Post-Deployment Testing

After deployment, run these tests:

### Test 1: Single Item Detection
1. Upload an image with one clear fashion item (e.g., just a shirt)
2. Select "Tops"
3. Expected: Crop completes in <10 seconds
4. Expected: Accurate crop

### Test 2: Multi-Item Detection
1. Upload an image with multiple items (e.g., outfit with top + bottom + shoes)
2. Select all visible items
3. Expected: All crops complete in <20 seconds
4. Expected: All items detected correctly

### Test 3: Search Quality
1. After cropping, check search results
2. Expected: High-quality, relevant product links
3. Expected: No Instagram/category page links

---

## 📞 Troubleshooting

### Issue: Still seeing old backend URL in console

**Solution:** Hard refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

### Issue: Cropping is still slow (>30s)

**Causes:**
1. Environment variable not updated properly
2. Vercel needs full redeploy (not just cache)
3. Browser cache (try incognito mode)

**Debug Steps:**
1. Check browser console for actual backend URL being used
2. Check Vercel deployment logs
3. Verify environment variable in Vercel dashboard

### Issue: "Failed to crop" error

**Solution:**
1. Check Modal GPU backend is running: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/
2. Check Modal logs: `modal app logs fashion-crop-api-gpu`
3. Verify all Modal secrets are set correctly

---

## 📚 Related Documentation

- **GPU Backend Setup:** `GPU_BACKEND_COMPLETE.md`
- **Quick Reference:** `GPU_BACKEND_QUICKREF.md`
- **Deployment Script:** `deploy_gpu_backend.sh`

---

## ✅ Update Checklist

- [ ] Update `NEXT_PUBLIC_PYTHON_CROPPER_URL` in Vercel
- [ ] Redeploy frontend
- [ ] Test in browser console (check URL)
- [ ] Test single item upload
- [ ] Test multi-item upload
- [ ] Verify speed improvement (7-15s vs 40-90s)
- [ ] Check search result quality
- [ ] Monitor for any errors

---

**Ready to go! 🚀**

Update the Vercel environment variable and redeploy to start using the GPU backend!

