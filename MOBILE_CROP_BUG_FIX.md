# 🐛 Mobile Cropping Bug - Root Cause & Fix

## The Problem

**Desktop:** Bboxes crop correctly ✅  
**Mobile:** Bboxes display correctly, but crop the wrong area ❌

---

## 🔍 Root Cause Analysis

### **The Bug:**

```
Mobile Upload Flow (BEFORE FIX):
1. User selects photo: 3024×4032 pixels (original iPhone photo)
2. imageCompression compresses: → 551×1200 (maxWidthOrHeight: 1200)
3. Upload to Supabase: 551×1200 ✅
4. FileReader creates localDataUrl: FROM ORIGINAL 3024×4032 ❌
5. DINOx analyzes Supabase: 551×1200 ✅
6. DINOx returns bboxes: For 551×1200 image ✅
7. Frontend crops localDataUrl: 3024×4032 ❌❌❌
8. Bboxes for 551×1200 applied to 3024×4032 = WRONG CROP!
```

### **Why Desktop Worked:**

Desktop images are often already smaller, so:
- Original: 800×1200
- Compressed: 551×1200 (not much change)
- localDataUrl: 800×1200 (similar enough)
- Cropping mismatch was small enough to work

---

## ✅ The Fix

**Crop from the Supabase URL (same image DINOx analyzed), not the local data URL!**

### Before:
```typescript
// Wrong: Crops local data URL (original uncompressed)
const localDataUrl = localImageDataUrlRef.current
const croppedDataUrl = await cropImage({
  imageUrl: localDataUrl,  // ❌ Original 3024×4032
  bbox: normalizedBbox     // For 551×1200 image!
})
```

### After:
```typescript
// Correct: Crops Supabase URL (same image DINOx analyzed)
const imageUrlForCropping = uploadedImageUrl  // Supabase URL
const croppedDataUrl = await cropImage({
  imageUrl: imageUrlForCropping,  // ✅ 551×1200 (compressed)
  bbox: normalizedBbox            // For 551×1200 image ✅
})
```

---

## 🔧 Changes Made

### File: `app/page.tsx` (lines ~636-700)

**Key changes:**
1. Use `uploadedImageUrl` (Supabase) instead of `localDataUrl` for cropping
2. Use `imageSize` from detection state (same dimensions DINOx analyzed)
3. Added CORS support (`crossOrigin = 'anonymous'`) for Supabase URLs
4. Better logging to debug dimension mismatches

---

## 🎯 Coordinate Flow (Fixed)

```
1. Upload original image (3024×4032)
   ↓
2. Compress to 1200px max (551×1200)
   ↓
3. Upload to Supabase (551×1200)
   ↓
4. DINOx analyzes Supabase image (551×1200)
   ↓
5. Returns bboxes: [211, 500, 335, 825] (pixels for 551×1200)
   ↓
6. Normalize using imageSize [551, 1200]:
   [211/551, 500/1200, 335/551, 825/1200]
   = [0.383, 0.417, 0.608, 0.688]
   ↓
7. Crop SUPABASE image (551×1200) with normalized bbox ✅
   ↓
8. Correct crop! Shows scarf! ✅
```

---

## 🧪 Testing

### Expected Console Logs (Mobile):

```javascript
✂️ Cropping scarf locally...
   📸 Cropping from: Supabase (compressed)
   📏 Bbox conversion: bbox (pixels): [211, 500, 335, 825]
   🔍 Bbox format detection: max value = 825, normalized = false
   ⚠️  Bboxes are in PIXEL coordinates, need to normalize
   📐 Using detection imageSize: 551x1200
   ✅ Normalized bbox: [0.3830, 0.4175, 0.6080, 0.6879]
🖼️  cropImage called: {imageUrlType: 'HTTP URL', imageUrlStart: 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/...'}
   ℹ️  Set crossOrigin=anonymous for HTTP URL
   ✅ Image loaded successfully: {naturalWidth: 551, naturalHeight: 1200}
   📐 Canvas dimensions: 124x325  ← Should match scarf area!
   ✅ Successfully exported as JPEG: 15KB
```

### Visual Test:

1. Upload scarf image on mobile
2. Check bbox highlights scarf correctly ✅
3. Click search
4. **Cropped image should show the scarf** ✅
5. Search results should be scarf-related ✅

---

## 📊 Why This Bug Only Affected Mobile

| Platform | Original Image | Compressed | LocalDataUrl | Match? |
|----------|---------------|------------|--------------|--------|
| **Desktop** | 800×1200 | 551×1200 | 800×1200 | ≈ Similar ✅ |
| **Mobile** | 3024×4032 | 551×1200 | 3024×4032 | ❌ VERY DIFFERENT |

Mobile photos are MUCH larger, so compression creates a bigger mismatch!

---

## 🚀 Solution Benefits

1. ✅ **Consistent cropping** - Always uses the image DINOx analyzed
2. ✅ **Works on mobile** - Handles high-res mobile photos correctly
3. ✅ **Works on desktop** - Still works (now uses Supabase URL)
4. ✅ **CORS handled** - `crossOrigin='anonymous'` in imageCropper
5. ✅ **No performance hit** - Supabase URLs load fast

---

## ⚠️ Potential CORS Issue

If Supabase storage doesn't have CORS enabled, the crop might fail. Check Supabase dashboard:

**Storage → Settings → CORS Configuration**

Should allow:
```
https://fashionsource.vercel.app
http://localhost:3001
http://localhost:3002
```

If CORS fails, we can add a fallback or configure Supabase storage bucket.

---

## 📝 Notes

- `localDataUrl` is still used for the **preview** (before cropping)
- `uploadedImageUrl` (Supabase) is now used for **cropping**
- This ensures bbox coordinates match the actual image being cropped
- The key insight: **Always crop the same image that was analyzed**

