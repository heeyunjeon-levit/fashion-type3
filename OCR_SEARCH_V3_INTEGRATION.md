# OCR Search V3.1 Integration Guide

## 🎯 Overview

V3.1 OCR Search Pipeline has been integrated into your MVP as a **gradual integration** - it runs alongside your existing search system and can be toggled on/off.

## ✅ What Was Changed

### 1. **New Files Created**

#### `/python_backend/ocr_search_pipeline.py`
- Complete V3.1 pipeline adapted for MVP
- Uses environment variables instead of hardcoded paths
- Works with image URLs (compatible with Supabase uploads)
- Returns FastAPI-compatible dict format

### 2. **Modified Files**

#### `/python_backend/api/server.py`
**Added:**
- New endpoint: `POST /ocr-search`
- Request model: `OCRSearchRequest` (takes `imageUrl`)
- Response model: `OCRSearchResponse` (returns products, mapping, summary)

#### `/app/api/search/route.ts`
**Added:**
- New parameter: `useOCRSearch` (boolean flag)
- OCR search mode at the beginning of POST handler
- Calls Python backend `/ocr-search` endpoint when enabled
- Transforms results to match existing frontend format
- Falls back to regular search on error

#### `/python_backend/requirements.txt`
**Added:**
- `supabase>=2.0.0` - for image hosting
- `openai>=1.0.0` - for GPT-4o analysis

## 🔑 Required Environment Variables

### For Python Backend (Modal/Railway/Vercel)

```bash
# Existing (should already be set)
SERPER_API_KEY=your_serper_key
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# New - Add this one!
GCLOUD_API_KEY=AIzaSyDIYL-tLifYDMrqUgPV0p57_MrBj-C1WSI
```

### For Next.js Frontend (Vercel)

```bash
# Should already be set (pointing to your Python backend)
PYTHON_BACKEND_URL=https://your-modal-url.modal.run
# OR
MODAL_GPU_URL=https://your-modal-url.modal.run
```

## 🚀 How to Use

### Option 1: Enable Globally (Recommended for Testing)

Add to your frontend `.env`:

```bash
NEXT_PUBLIC_USE_OCR_SEARCH=true
```

Then in your search component, read this flag:

```typescript
const useOCRSearch = process.env.NEXT_PUBLIC_USE_OCR_SEARCH === 'true'

const response = await fetch('/api/search', {
  method: 'POST',
  body: JSON.stringify({
    categories,
    croppedImages,
    originalImageUrl,
    useOCRSearch  // Pass the flag
  })
})
```

### Option 2: Toggle Per Request (Recommended for A/B Testing)

Add a toggle button in your UI:

```typescript
const [useOCR, setUseOCR] = useState(false)

// In your search function:
const response = await fetch('/api/search', {
  method: 'POST',
  body: JSON.stringify({
    categories,
    croppedImages,
    originalImageUrl,
    useOCRSearch: useOCR  // User-controlled toggle
  })
})
```

### Option 3: Enable for Specific Cases

Enable OCR search only when regular search fails or for specific scenarios:

```typescript
// Try regular search first
let response = await fetch('/api/search', { ... })
let data = await response.json()

// If no results, retry with OCR
if (Object.keys(data.results).length === 0) {
  response = await fetch('/api/search', {
    method: 'POST',
    body: JSON.stringify({
      originalImageUrl,
      useOCRSearch: true  // Enable OCR as fallback
    })
  })
}
```

## 📊 Response Format

When OCR search is used, the response format matches your existing format but with additional metadata:

```typescript
{
  "results": {
    "BRAND_NAME": {
      "query": "exact Korean product text from OCR",
      "results": [
        {
          "title": "Product title",
          "link": "https://...",
          "thumbnail": "https://...",
          "reason": "GPT's selection reasoning"
        }
      ],
      "metadata": {
        "method": "v3_hybrid_visual_priority_text",
        "total_candidates": 45,
        "visual_candidates": 23,
        "text_candidates": 22
      }
    }
  },
  "meta": {
    "mode": "ocr_v3.1",
    "success": true,
    "total_time": 35.2,
    "ocr_mapping": {
      "products": [...],
      "websites": ["brand.co.kr"],
      "image_has_multiple_products": true
    },
    "summary": {
      "total_products": 2,
      "successful_searches": 2
    }
  }
}
```

## 🎨 Frontend Integration Example

Here's a complete example of how to integrate into your search component:

```typescript
// Add toggle state
const [useOCRSearch, setUseOCRSearch] = useState(
  process.env.NEXT_PUBLIC_USE_OCR_SEARCH === 'true'
)

// Add toggle UI (optional)
<div className="flex items-center gap-2 mb-4">
  <input
    type="checkbox"
    checked={useOCRSearch}
    onChange={(e) => setUseOCRSearch(e.target.checked)}
  />
  <label>Use V3.1 OCR Search (Beta)</label>
</div>

// Modify your search call
const handleSearch = async () => {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categories: detectedCategories,
      croppedImages: croppedImageUrls,
      originalImageUrl: uploadedImageUrl,
      useOCRSearch  // Add this flag
    })
  })
  
  const data = await response.json()
  
  // Display mode indicator
  if (data.meta?.mode === 'ocr_v3.1') {
    console.log('✅ Used V3.1 OCR Search')
    console.log('Brands found:', Object.keys(data.results))
  }
}
```

## 📈 Performance Expectations

### V3.1 OCR Search
- **Time:** ~30-50s per image
- **Accuracy:** 100% (based on 24-image test)
- **Best for:**
  - Images with visible brand names/text
  - Korean products
  - Multi-product images
  - High-accuracy requirements

### Regular Search
- **Time:** ~10-20s per image
- **Accuracy:** Variable (depends on visual matching)
- **Best for:**
  - Clean product images
  - Speed-critical scenarios
  - When brand text is not visible

## 🔍 Monitoring & Debugging

### Check if OCR Search is Running

Look for these logs in your backend:

```
🎯 Using V3.1 OCR Search Pipeline...
   Calling: https://your-backend/ocr-search
📖 Step 1: OCR Text Extraction...
   ✅ Extracted 45 text segments
🧠 Step 2: Brand-Product Mapping...
   ✅ Identified 2 product(s)
🔍 Step 3: Searching for Products...
```

### Common Issues & Solutions

#### 1. OCR Search Not Running
**Problem:** Regular search runs even when `useOCRSearch=true`
**Solution:** 
- Check `PYTHON_BACKEND_URL` is set in Vercel
- Check backend is accessible: `curl https://your-backend/ocr-search`
- Look for error logs in Vercel function logs

#### 2. "GCLOUD_API_KEY not set" Error
**Problem:** Backend crashes with missing API key error
**Solution:**
- Add `GCLOUD_API_KEY` to Modal/Railway environment variables
- Redeploy Python backend after adding the key

#### 3. Slow Response Times (>60s)
**Problem:** OCR search times out
**Solution:**
- Increase timeout in `route.ts` (currently 120s)
- Check if all API keys are valid (OCR, Serper, OpenAI)
- Reduce number of platform searches in `korean_platforms` array

## 🧪 Testing V3.1

### Quick Test

1. **Deploy backend:**
   ```bash
   cd /Users/levit/Desktop/mvp/python_backend
   # Deploy to Modal/Railway with updated requirements.txt
   ```

2. **Set environment variables:**
   ```bash
   # In Modal/Railway dashboard
   GCLOUD_API_KEY=AIzaSyDIYL-tLifYDMrqUgPV0p57_MrBj-C1WSI
   ```

3. **Test OCR endpoint directly:**
   ```bash
   curl -X POST https://your-backend/ocr-search \
     -H "Content-Type: application/json" \
     -d '{"imageUrl": "https://your-supabase-url/image.jpg"}'
   ```

4. **Test from frontend:**
   - Upload an image with visible Korean brand text
   - Enable OCR search toggle
   - Click search
   - Check response has `mode: 'ocr_v3.1'`

### A/B Testing Setup

To compare V3.1 vs regular search:

```typescript
// Run both searches in parallel
const [ocrResult, regularResult] = await Promise.all([
  fetch('/api/search', { 
    body: JSON.stringify({ ...params, useOCRSearch: true })
  }),
  fetch('/api/search', { 
    body: JSON.stringify({ ...params, useOCRSearch: false })
  })
])

// Compare results
console.log('OCR found:', Object.keys(ocrData.results).length, 'brands')
console.log('Regular found:', Object.keys(regularData.results).length, 'brands')
```

## 🎯 Rollout Strategy

### Phase 1: Internal Testing (Current)
- ✅ V3.1 integrated as optional mode
- ✅ Default: OFF (existing search runs)
- Toggle in code or via env var

### Phase 2: Beta Testing
1. Enable for 10% of users
2. Track success rates (OCR vs regular)
3. Monitor performance metrics
4. Collect user feedback

### Phase 3: Gradual Rollout
1. 25% of users
2. 50% of users
3. 100% of users

### Phase 4: Full Migration
- Make OCR search the default
- Keep regular search as fallback
- Remove toggle from UI

## 📝 Key Features of V3.1

### What Makes V3.1 Better:

1. **OCR Text Extraction**
   - Extracts exact Korean product names
   - Preserves brand information
   - Handles multi-product images

2. **Visual + Text Hybrid Search**
   - `/lens` endpoint for visual matching
   - Platform-specific searches (Musinsa, 29cm, etc.)
   - Brand website discovery and site-specific search

3. **Smart Filtering**
   - Blocks social media (Instagram, TikTok)
   - Filters news/blog/editorial content
   - Removes category/list pages
   - Returns ONLY product purchase pages

4. **GPT-4o Selection**
   - Analyzes all candidates
   - Selects top 3 best matches
   - Provides reasoning for each selection
   - Fallback to filtered results if GPT finds no perfect match

5. **100% Success Rate**
   - Tested on 24 diverse images
   - Found products for all images with identifiable brands

## 🆘 Support

If you encounter issues:

1. Check backend logs for detailed error messages
2. Verify all environment variables are set
3. Test the `/ocr-search` endpoint directly with curl
4. Review the response metadata for debugging info

## 📚 Related Files

- Implementation: `/python_backend/ocr_search_pipeline.py`
- API Endpoint: `/python_backend/api/server.py` (line ~470)
- Frontend Integration: `/app/api/search/route.ts` (line ~213)
- Dependencies: `/python_backend/requirements.txt`
- Test Results: `/Users/levit/Desktop/serper/v3.1_results_visualization.html`

---

**Ready to test!** 🚀

Start by setting `GCLOUD_API_KEY` in your backend environment and pass `useOCRSearch: true` in your search requests.

