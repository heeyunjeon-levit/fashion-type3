# Vercel Environment Variable Verification Guide

**Date:** November 6, 2025  
**Target Variable:** `NEXT_PUBLIC_PYTHON_CROPPER_URL`  
**Target Value:** `https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run`

---

## ✅ Verification Results (Local)

**Your local setup is already correct:**

- ✅ Local `.env` points to GPU backend
- ✅ GPU backend is working (tested: 18.03s crop time)
- ✅ Batch scripts updated
- ⬜ **Vercel deployment needs update** (see below)

---

## 🎯 Update Vercel Environment Variable

### Method 1: Vercel Dashboard (Recommended - 2 minutes)

#### Step 1: Open Vercel Dashboard
1. Go to: **https://vercel.com/dashboard**
2. Sign in if needed
3. Click on your project (the one for this fashion app)

#### Step 2: Navigate to Environment Variables
1. Click **Settings** (in the top menu)
2. Click **Environment Variables** (in the left sidebar)
3. Scroll to find `NEXT_PUBLIC_PYTHON_CROPPER_URL`

#### Step 3: Update the Variable
You have two options:

**Option A: Edit Existing Variable**
1. Click the **⋮** (three dots) next to `NEXT_PUBLIC_PYTHON_CROPPER_URL`
2. Click **Edit**
3. Update value to:
   ```
   https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
   ```
4. Make sure all environments are selected:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Click **Save**

**Option B: Delete and Recreate**
1. Click the **⋮** (three dots) next to `NEXT_PUBLIC_PYTHON_CROPPER_URL`
2. Click **Delete**
3. Confirm deletion
4. Click **Add New** button
5. Enter:
   - **Name:** `NEXT_PUBLIC_PYTHON_CROPPER_URL`
   - **Value:** `https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run`
6. Select all environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
7. Click **Save**

#### Step 4: Redeploy
1. Go to **Deployments** tab
2. Find the latest successful deployment
3. Click the **⋮** (three dots)
4. Click **Redeploy**
5. Keep "Use existing Build Cache" checked
6. Click **Redeploy**
7. Wait for deployment to complete (~2-3 minutes)

---

### Method 2: Vercel CLI (Alternative)

```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Login to Vercel
vercel login

# Navigate to project
cd /Users/levit/Desktop/mvp

# Remove old variable (optional)
vercel env rm NEXT_PUBLIC_PYTHON_CROPPER_URL

# Add new variable for all environments
echo "https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run" | vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL production
echo "https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run" | vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL preview
echo "https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run" | vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL development

# Verify it's set
vercel env ls

# Redeploy
vercel --prod
```

---

## 🧪 Verify the Update (After Redeployment)

### Method 1: Browser DevTools (Most Reliable)

1. **Open your deployed site** in a browser
2. **Open DevTools:**
   - Mac: `Cmd + Option + J`
   - Windows/Linux: `Ctrl + Shift + J`
   - Or right-click → Inspect → Console tab
3. **Upload a test image** (any fashion photo)
4. **Select some categories** (e.g., tops, bottoms)
5. **Check the Console output** for this line:
   ```
   🔗 Using backend: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
   ```

**Expected Results:**
- ✅ Console shows GPU backend URL (not CPU URL)
- ✅ Cropping completes in **7-20 seconds** (not 40+ seconds)
- ✅ Items are detected correctly

**Screenshots of What to Look For:**

```
Console Output (What You Should See):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Using backend: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
📦 Base64 mode: false
🔄 Cropping tops ×1...
📥 Response for tops: { croppedImageUrl: "..." }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you see the OLD CPU URL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Using backend: https://...cpu-fastapi-app...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
→ If still showing old URL, check Vercel env again
```

### Method 2: Verification Script

```bash
# After redeployment, run with your Vercel URL:
node verify_backend_config.js https://your-app.vercel.app
```

This will:
- ✅ Check local .env
- ✅ Check GPU backend health
- ✅ Test GPU crop functionality
- ✅ Check if your deployed site is online

### Method 3: Performance Test

Upload an image with 2-3 items and time it:

- **GPU Backend (Correct):** 12-20 seconds total
- **CPU Backend (Wrong):** 60-90+ seconds total

If it's taking >30 seconds, the GPU backend may not be connected properly.

---

## 📊 Verification Checklist

After updating Vercel and redeploying, verify these:

- [ ] Vercel Dashboard shows GPU URL in Environment Variables
- [ ] Deployment completed successfully (green checkmark)
- [ ] Browser console shows GPU backend URL
- [ ] Crop time is <20 seconds for 2-3 items
- [ ] All requested items are detected
- [ ] No timeout or connection errors

---

## 🔧 Troubleshooting

### Issue: Browser console still shows CPU URL

**Cause:** Browser cache or deployment not propagated

**Solutions:**
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Open in incognito/private mode
3. Clear browser cache
4. Wait 2-3 minutes for CDN to update
5. Verify environment variable in Vercel Dashboard

### Issue: Cropping still takes 40+ seconds

**Cause:** Environment variable not updated or not redeployed

**Solutions:**
1. Double-check Vercel environment variable
2. Make sure you redeployed after updating the variable
3. Check browser console to see which URL is being used
4. Try a new deployment (not just redeploy)

### Issue: "Failed to crop" error

**Cause:** GPU backend might be cold starting or having issues

**Solutions:**
1. Check GPU backend health:
   ```bash
   curl https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/
   ```
2. Check Modal logs:
   ```bash
   modal app logs fashion-crop-api-gpu
   ```
3. Try again (cold start takes 10-15s first time)

### Issue: Vercel env variable not showing up

**Cause:** Not saved correctly or wrong project

**Solutions:**
1. Make sure you're in the correct Vercel project
2. Save the variable again
3. Make sure all three environments are selected
4. Use Vercel CLI as alternative method

---

## 🎯 Success Indicators

**You'll know it's working when:**

1. ✅ Browser console log shows:
   ```
   🔗 Using backend: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
   ```

2. ✅ Performance improvement:
   - Single item: **7-10 seconds** (was 40-50s)
   - Multiple items: **12-18 seconds** (was 60-90s+)

3. ✅ Reliable detection:
   - All requested items are found
   - Crops are accurate
   - No timeouts

---

## 📸 Visual Verification Guide

### Where to Check in Vercel Dashboard

```
1. Dashboard (https://vercel.com/dashboard)
   └── Your Project
       └── Settings (top menu)
           └── Environment Variables (left sidebar)
               └── NEXT_PUBLIC_PYTHON_CROPPER_URL
                   └── Value: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
                   └── Environments: Production ✓ Preview ✓ Development ✓
```

### Where to Check in Browser

```
1. Open your deployed site
2. Right-click → Inspect
3. Console tab
4. Upload image + select categories
5. Look for:
   🔗 Using backend: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
   ✅ Should have "gpu" in URL, not "cpu"
```

---

## 📞 Need Help?

**If something's not working:**

1. **Check current configuration:**
   ```bash
   node verify_backend_config.js
   ```

2. **Check GPU backend directly:**
   ```bash
   node test_gpu_quick.js
   ```

3. **Review Vercel deployment logs:**
   - Go to Vercel Dashboard → Deployments
   - Click on latest deployment
   - Check Function Logs for any errors

4. **Rollback if needed:**
   - Update env to old CPU URL
   - Redeploy
   - Report issue

---

## 📚 Related Documentation

- **This Guide:** `VERCEL_ENV_VERIFICATION_GUIDE.md`
- **Update Summary:** `FRONTEND_UPDATE_SUMMARY.md`
- **GPU Backend Docs:** `GPU_BACKEND_COMPLETE.md`
- **Quick Reference:** `GPU_BACKEND_QUICKREF.md`

---

## ✅ Quick Checklist for Vercel Update

1. [ ] Open Vercel Dashboard
2. [ ] Go to Settings → Environment Variables
3. [ ] Update `NEXT_PUBLIC_PYTHON_CROPPER_URL` to GPU URL
4. [ ] Select all three environments (Prod, Preview, Dev)
5. [ ] Save the variable
6. [ ] Go to Deployments → Redeploy latest
7. [ ] Wait for deployment to complete
8. [ ] Open deployed site in browser
9. [ ] Open DevTools Console (F12)
10. [ ] Upload test image
11. [ ] Verify GPU URL appears in console
12. [ ] Verify crop time is <20 seconds

---

**You're almost there! Just update Vercel and redeploy! 🚀**

