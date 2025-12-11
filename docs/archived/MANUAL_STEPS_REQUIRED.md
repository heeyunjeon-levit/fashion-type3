# ⚠️ Manual Steps Required

## ✅ What's Already Done

1. ✅ Frontend code updated (GPU backend disabled)
2. ✅ Code pushed to GitHub
3. ✅ Vercel will auto-deploy (in progress)
4. ✅ CPU backend is running and warm
5. ✅ GitHub Actions is pinging CPU backend

---

## 🔴 What YOU Need to Do (2 Minutes)

### Step 1: Update Vercel Environment Variables

Go to your Vercel project: **https://vercel.com/heeyunjeon-levit/fashion-type3/settings/environment-variables**

#### ✅ KEEP These Variables:
- `NEXT_PUBLIC_PYTHON_CROPPER_URL` = `https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SERPER_API_KEY`
- `OPENAI_API_KEY`
- `IMGBB_API_KEY`

#### ❌ DELETE These Variables (No Longer Needed):
- `NEXT_PUBLIC_PYTHON_CROPPER_URL_GPU` ← DELETE THIS
- `NEXT_PUBLIC_USE_GPU_BACKEND` ← DELETE THIS

### Step 2: Redeploy Frontend (if needed)

After deleting the env vars, Vercel should automatically redeploy. If not:
1. Go to: https://vercel.com/heeyunjeon-levit/fashion-type3
2. Click "Redeploy" on the latest deployment

---

## 🧪 Testing After Deployment

1. Wait for Vercel deployment to finish (~2 minutes)

2. Open: **https://fashion-type3.vercel.app**

3. **Upload a test image**:
   - Try the image: `/Users/levit/Desktop/photos/0f86de4b5394-Screenshot_20250922_191711_Instagram.jpg`
   - Or any HEIC image from your phone

4. **Select categories**: tops, bottoms, shoes

5. **Open browser console** (F12 or Cmd+Option+J)

6. **Verify you see**:
   ```
   🖥️  Using CPU backend: https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run
   ```
   (Should NOT say "GPU" or "Roboflow")

7. **Wait ~60-90 seconds** for results

8. **Check results**:
   - Cropped images appear for each category
   - 3 product links per item with thumbnails
   - All links are valid e-commerce URLs

---

## 🎯 Expected Behavior

### ✅ Good (What You Should See)
```
🖥️  Using CPU backend: https://...modal.run
📊 Category counts: {tops: 1, bottoms: 1}
🔄 Cropping tops ×1...
🔄 Cropping bottoms ×1...
📥 Response for tops: {croppedImageUrl: "https://...supabase.co/..."}
📥 Response for bottoms: {croppedImageUrl: "https://...supabase.co/..."}
✅ Cropping complete!
```

### ❌ Bad (What You Should NOT See)
```
🖥️  Using GPU (Roboflow) backend: ...  ← WRONG!
```

---

## 🐛 Troubleshooting

### Problem: Frontend still says "GPU backend"

**Solution**: You didn't delete the environment variables yet.
1. Go to Vercel settings
2. Delete `NEXT_PUBLIC_PYTHON_CROPPER_URL_GPU`
3. Delete `NEXT_PUBLIC_USE_GPU_BACKEND`
4. Redeploy

### Problem: 404 error on backend URL

**Solution**: Check if Modal backend is awake.
1. Open: https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run/
2. Should see: `{"status":"online","cropper_available":true}`
3. If not, wait 30 seconds (cold start)

### Problem: Crops are taking too long (>2 minutes)

**Solution**: Backend might be cold starting.
1. Check Modal logs: Go to Modal dashboard → Apps → fashion-crop-api-cpu-v2
2. Look for "Cold start" messages
3. GitHub Actions should be keeping it warm (check if workflow is running)

### Problem: No results showing up

**Solution**: 
1. Check browser console for errors
2. Check Network tab for failed requests
3. Try a different image (maybe the current one has no detectable items)

---

## 📊 Performance Benchmarks

After you test, you should see these approximate timings:

| Step | Time |
|------|------|
| Image Upload | 2-5s |
| HEIC Conversion (if needed) | +3-5s |
| Cropping (CPU backend) | 40-60s |
| Image Search (Serper + GPT) | 10-30s |
| **Total** | **60-90s** |

This is **acceptable performance** for a production MVP! 🎉

---

## 🚀 What's Next?

Once everything is working:

1. **Monitor Usage**:
   - Check Modal dashboard for backend usage
   - Check Vercel analytics for frontend traffic

2. **Optimize if Needed**:
   - If too slow: Add GPU to CPU backend (Modal T4)
   - If too expensive: Implement caching
   - If too many errors: Add retry logic

3. **Scale**:
   - Currently handles 1 user at a time well
   - For multiple concurrent users, increase Modal concurrency

---

## ✅ Checklist

- [ ] Delete `NEXT_PUBLIC_PYTHON_CROPPER_URL_GPU` from Vercel
- [ ] Delete `NEXT_PUBLIC_USE_GPU_BACKEND` from Vercel
- [ ] Redeploy frontend (if needed)
- [ ] Test upload + crop + search flow
- [ ] Verify console shows "CPU backend"
- [ ] Verify results are accurate and complete

---

## 🎉 When Everything Works

You'll have a **production-ready image search MVP** that:
- ✅ Works with any image format (including HEIC)
- ✅ Accurately detects and crops fashion items
- ✅ Returns relevant product links with thumbnails
- ✅ Handles multiple items per category
- ✅ Runs reliably on cost-effective infrastructure
- ✅ Stays warm with automated pings

**Congratulations!** 🎊

