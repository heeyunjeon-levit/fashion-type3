# 🔧 Fix Cropping Issue - Wrong Search Results

## The Problem

You're seeing:
- ✅ Detection works (finds Sweater, Pants, etc.)
- ✅ Interactive selection works
- ❌ Search returns wrong products (LED lights, Mercedes Benz, etc.)

## Root Cause

The **cropping backend is either:**
1. Not accessible from production (Missing `NEXT_PUBLIC_GPU_API_URL`)
2. Returning errors (causing fallback to original image)
3. Creating bad crops (wrong bbox coordinates)

When crops fail → Falls back to **full image search** → Returns random products!

---

## 🔍 Diagnosis

### Check Browser Console on Production

After clicking "Search 2 Items", check console for:

```javascript
// GOOD (Working):
🎯 Processing 2 selected items...
✅ Processed Sweater in 2.5s
✅ Processed Pants in 2.3s
🔍 Searching Sweater_1...
   📸 Cropped image URL: https://...supabase.co/storage/v1/object/public/images/cropped_Sweater_...

// BAD (Failing):
❌ Failed to process Sweater: 405
// OR
❌ Processing error: fetch failed
// OR
⚠️ No cropped image for Sweater_1
```

If you see errors → Backend not accessible!

---

## ✅ Solution 1: Set Environment Variable

The `/process-item` endpoint needs `NEXT_PUBLIC_GPU_API_URL` set in Vercel.

### Go to Vercel Dashboard

1. **Project** → **Settings** → **Environment Variables**
2. **Confirm this is set:**

```
Name: NEXT_PUBLIC_GPU_API_URL
Value: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
Environments: ✅ Production ✅ Preview ✅ Development
```

### Redeploy

After adding, click **"Redeploy"** or:

```bash
git commit --allow-empty -m "trigger: Redeploy after env vars"
git push origin main
```

---

## ✅ Solution 2: Verify Modal Backend is Running

The backend might be sleeping or stopped.

### Test Backend Directly

```bash
# Test detection endpoint
curl -X POST https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/detect \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://test.jpg"}'

# Test process-item endpoint
curl -X POST https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/process-item \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://test.jpg","bbox":[0,0,100,100],"category":"tops"}'
```

**Expected:** Should return JSON (or error about bad image)
**If 405/404:** Backend is not deployed or stopped!

### Redeploy Modal Backend

```bash
cd /Users/levit/Desktop/mvp
modal deploy python_backend/modal_gpu_transformers.py
```

---

## ✅ Solution 3: Check Supabase Permissions

Cropped images need to be uploaded to Supabase. If uploads fail, crops won't work.

### Verify in Backend Logs

Check Modal logs for:

```
✅ Cropped image uploaded: https://...supabase.co/storage/v1/object/public/images/cropped_...
```

OR errors like:

```
❌ Failed to upload cropped image: 403 Forbidden
⚠️ Falling back to original image
```

If uploads fail → Check Supabase bucket permissions!

---

## 📊 How It Should Work

### Normal Flow (Working):

```
1. User selects "Sweater" & "Pants"
   └─ handleBboxSelectionConfirm() called

2. For each selected item:
   ├─ POST /process-item
   │  ├─ Crop image using bbox
   │  ├─ Upload crop to Supabase
   │  └─ Return: { croppedImageUrl: "https://...cropped_Sweater_..." }
   │
   └─ DetectedItem created with croppedImageUrl

3. handleItemsSelected(processedItems)
   └─ POST /api/search with croppedImages

4. For each croppedImage:
   ├─ Google Lens search with cropped image
   ├─ Get product results
   └─ GPT filters best matches
```

### Broken Flow (Current):

```
1. User selects "Sweater" & "Pants"
   └─ handleBboxSelectionConfirm() called

2. For each selected item:
   ├─ POST /process-item → ❌ 405 Error (backend not found)
   │
   └─ ❌ No DetectedItem created OR DetectedItem with empty croppedImageUrl

3. handleItemsSelected([])
   └─ POST /api/search with empty croppedImages

4. Fallback triggered:
   ├─ Google Lens search with FULL image (not crop!)
   ├─ Returns random products (LED, Mercedes, etc.)
   └─ ❌ Wrong results
```

---

## 🔧 Quick Fix Steps

### Step 1: Add Environment Variable

**Vercel** → **Settings** → **Environment Variables** → **Add:**

```
NEXT_PUBLIC_GPU_API_URL=https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
```

### Step 2: Verify Backend

```bash
# Should return detection results
curl -X POST https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/detect \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/test.jpg"}'
```

### Step 3: Redeploy Vercel

```bash
cd /Users/levit/Desktop/mvp
git commit --allow-empty -m "trigger: Redeploy for cropping fix"
git push origin main
```

### Step 4: Test Again

1. Wait 3 minutes for deployment
2. Visit production site
3. Upload outfit image
4. Select Sweater & Pants
5. Click "Search 2 Items"
6. **Check console for crop URLs!**
7. Should see actual sweater & pants products! ✅

---

## 🐛 Debugging Checklist

If still not working after fix:

### Check 1: Environment Variable Loaded
```javascript
// In browser console on production:
console.log(process.env.NEXT_PUBLIC_GPU_API_URL)
// Should show: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
```

### Check 2: Backend Response
```javascript
// In Network tab, find /process-item request
// Status: 200 ✅ or 405 ❌?
// Response: { croppedImageUrl: "..." } ✅ or error ❌?
```

### Check 3: Cropped Image URL
```javascript
// In console logs after "Search 2 Items":
// Look for: 🔍 Searching Sweater_1...
//           📸 Cropped image URL: https://...
// URL should be Supabase cropped image, NOT original!
```

### Check 4: Search Results
```javascript
// After search completes:
// Results should match selected items (Sweater, Pants)
// NOT random products (LED, Mercedes)
```

---

## 🎯 Expected Results After Fix

### Before (Broken):
```
Select: Sweater + Pants
Results: LED lights 💡, Mercedes Benz 🚗, Random pants 👖
```

### After (Working):
```
Select: Sweater + Pants  
Results: Similar sweaters 👕, Similar pants 👖
From: Musinsa, 29cm, Zigzag, etc.
```

---

## 💡 Why This Happens

**Local Development:**
- Modal backend accessible ✅
- `.env.local` has GPU URL ✅
- Cropping works perfectly ✅

**Production:**
- Modal backend URL not set in Vercel ❌
- Frontend can't reach `/process-item` ❌
- Falls back to full image search ❌
- Returns random results ❌

---

## 📝 Summary

**Problem:** Cropping backend not accessible from production  
**Solution:** Add `NEXT_PUBLIC_GPU_API_URL` to Vercel  
**Result:** Cropped image search works correctly ✅

**Go add that environment variable now!** 🚀

(Same fix as the detection issue - both use the same backend URL!)


