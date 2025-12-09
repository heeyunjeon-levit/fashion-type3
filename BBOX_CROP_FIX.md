# 🔧 Bbox Cropping Fix for Mobile

## 🐛 The Problem

The scarf (and other items) were being cropped incorrectly on mobile. The bbox detection was selecting the wrong area of the image.

### Root Cause

The bbox coordinate system was inconsistent throughout the app:

1. **DINOx API** returns bboxes in **normalized coordinates [0-1]**
2. **detect-dinox/route.ts** was returning `image_size: [0, 0]` (hardcoded)
3. **InteractiveBboxSelector** assumes bboxes are in **pixel coordinates** and multiplies by `scale`
4. **imageCropper** expects **normalized coordinates [0-1]**
5. **page.tsx** tried to detect and convert, but with `imageSize = [0, 0]`, normalization failed

**Result:** Bboxes were drawn in wrong locations and crops were completely off!

---

## ✅ The Fix

### 1. **Consistent Coordinate System**

All bboxes are now **standardized to pixel coordinates** throughout the app:

- DINOx returns normalized [0-1] → **Convert to pixels**
- InteractiveBboxSelector uses **pixel coordinates**
- When cropping, **convert back to normalized [0-1]** for the cropImage function

### 2. **Actual Image Dimensions**

**Before:**
```typescript
image_size: [0, 0] // ❌ Hardcoded, wrong!
```

**After:**
```typescript
// Get REAL dimensions by loading the image
const img = new Image()
const actualImageSize = await new Promise<[number, number]>((resolve) => {
  img.onload = () => resolve([img.naturalWidth, img.naturalHeight])
  img.src = uploadedImageUrl
})
setImageSize(actualImageSize) // ✅ Real dimensions!
```

### 3. **Bbox Conversion**

```typescript
// Detect bbox format
const sampleBbox = bboxes[0].bbox
const maxVal = Math.max(...sampleBbox)
const areNormalized = maxVal <= 1 // If all values ≤ 1, they're normalized

if (areNormalized) {
  // Convert to pixel coordinates
  const pixelBboxes = bboxes.map(bbox => ({
    ...bbox,
    bbox: [
      bbox.bbox[0] * actualImageSize[0], // x1 * width
      bbox.bbox[1] * actualImageSize[1], // y1 * height
      bbox.bbox[2] * actualImageSize[0], // x2 * width
      bbox.bbox[3] * actualImageSize[1]  // y2 * height
    ]
  }))
  setBboxes(pixelBboxes)
}
```

### 4. **Cropping Conversion**

When cropping, the code now properly converts back to normalized:

```typescript
// Bboxes are in pixels at this point
const [x1, y1, x2, y2] = bbox.bbox
const maxVal = Math.max(x1, y1, x2, y2)

if (maxVal > 1) {
  // Convert pixels → normalized [0-1]
  const img = new Image()
  await img.load(localDataUrl)
  
  normalizedBbox = [
    x1 / img.naturalWidth,
    y1 / img.naturalHeight,
    x2 / img.naturalWidth,
    y2 / img.naturalHeight
  ]
}

// cropImage expects normalized [0-1]
await cropImage({ imageUrl, bbox: normalizedBbox })
```

---

## 🎯 Changes Made

### Files Modified:

1. **`app/page.tsx`** (lines ~469-515)
   - Added image dimension loading with `await`
   - Auto-detect bbox format (normalized vs pixel)
   - Convert normalized → pixel coordinates
   - Fixed race condition with async image loading

2. **`app/api/detect-dinox/route.ts`** (line ~215)
   - Added logging for sample bboxes
   - Added note about coordinate system

3. **`app/components/InteractiveBboxSelector.tsx`** (unchanged)
   - Already correctly handles pixel coordinates
   - Multiplies by `scale` to draw on canvas

4. **`lib/imageCropper.ts`** (unchanged)
   - Already expects normalized [0-1] coordinates
   - Works correctly with proper input

---

## 🧪 Testing

### Expected Behavior:

**Console logs should show:**
```
📐 Actual image dimensions: 710x1364
📏 Bbox format: NORMALIZED [0-1] (max value: 0.923)
🔄 Converting normalized bboxes to pixel coordinates...
✅ Sample bbox converted: [0.237,0.274,0.480,0.458] → [168.2,373.6,340.8,624.8]
🎨 Drawing bboxes: {count: 3, displaySize: {...}, scale: 0.421}
   ✂️ Cropping scarf locally...
   📏 Bbox conversion: bbox (pixels): [168.2,373.6,340.8,624.8]
   🔍 Bbox format detection: max value = 624.8, normalized = false
   ⚠️  Bboxes are in PIXEL coordinates, need to normalize
   📐 Loaded image dimensions: 710x1364
   ✅ Normalized bbox: [0.2368, 0.2739, 0.4800, 0.4580]
   ✅ Cropped locally: 15KB data URL
```

### Visual Check:

1. **Upload image on mobile**
2. **Check bounding boxes** - they should correctly highlight items (scarf, handbag, etc.)
3. **Select items and search** - cropped images should show the correct items
4. **Results** - search should return relevant products

---

## 📊 Coordinate Flow Summary

```
DINOx API
   ↓
Normalized [0-1]
   ↓
detect-dinox/route.ts (returns normalized)
   ↓
page.tsx (detects format)
   ↓
Convert to PIXEL coordinates
   ↓
InteractiveBboxSelector (draws with scale)
   ↓
User selects items
   ↓
page.tsx cropping (detects pixels)
   ↓
Convert to NORMALIZED [0-1]
   ↓
imageCropper (expects normalized)
   ↓
✅ Correct crop!
```

---

## 🔍 Debugging

If cropping is still wrong, check these logs:

1. **Image dimensions:**
   ```
   📐 Actual image dimensions: ???x???
   ```
   Should be real dimensions, not `0x0`

2. **Bbox format detection:**
   ```
   📏 Bbox format: NORMALIZED [0-1] (max value: X.XX)
   ```
   If max value > 1, they're pixels (shouldn't happen with DINOx)

3. **Conversion:**
   ```
   ✅ Sample bbox converted: [0.237,0.274,0.480,0.458] → [168.2,373.6,340.8,624.8]
   ```
   Normalized × image dimensions = pixels

4. **Drawing:**
   ```
   🎨 Drawing bboxes: {count: X, displaySize: {width: X, height: X}, scale: 0.XXX}
   ```
   Scale should be < 1 (fit to screen)

5. **Cropping:**
   ```
   ✅ Normalized bbox: [0.2368, 0.2739, 0.4800, 0.4580]
   ```
   Should be [0-1] range before cropping

---

## 🚀 Testing on Mobile

1. **Hard refresh** your mobile browser (clear cache)
2. **Upload a test image** with multiple items
3. **Check bounding boxes** - should correctly highlight items
4. **Select "scarf" (스카프)** - bbox should be around the scarf
5. **Click search** - cropped image should show the scarf

---

## ✨ Result

Bboxes should now:
- ✅ Display in correct locations on screen
- ✅ Crop the correct area of the image
- ✅ Work consistently on desktop and mobile
- ✅ Handle different image sizes correctly

---

## 📝 Notes

- **DINOx always returns normalized [0-1]** coordinates
- **InteractiveBboxSelector always uses pixel coordinates** for drawing
- **imageCropper always expects normalized [0-1]** coordinates
- **Conversion happens automatically** based on detection

The key insight: **standardize to one format in the middle** (pixel coordinates), then convert as needed at the boundaries.

