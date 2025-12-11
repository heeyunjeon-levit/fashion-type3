# 🔍 Vision-Based Product Selection with Actual Thumbnails

## Problem We Solved

Previously, GPT-5.1 was looking at **Serper's low-quality search thumbnails** to select products. This led to incorrect results like:

❌ **Before:**
- GPT-5.1 saw blurry Serper thumbnail → looked beige-ish → selected it
- Actual product page showed WHITE cardigan
- White cardigan appearing in "Color Match" for beige search

## Solution: Fetch Actual Product Thumbnails BEFORE Selection

Changed GPT-5.1 to look at **ACTUAL high-quality product page images** instead of Serper's generic thumbnails.

### How It Works (UPDATED FLOW)

1. **Serper returns 30+ search results** (with low-quality thumbnails)
2. **🆕 Fetch Actual Product Thumbnails** (NEW STEP!)
   - Takes top 12 search results
   - Fetches ACTUAL product page thumbnails (from full image search results)
   - Falls back to Serper's thumbnail only if actual unavailable
3. **GPT-5.1 Visual Selection** (IMPROVED!)
   - Sees original cropped image (high detail)
   - Sees 12 ACTUAL product images (not Serper's)
   - Selects 3-5 that match BEST based on actual visuals
   - More accurate color matching, style matching
4. **Optional: Vision Verification** (Secondary Check)
   - Re-scores selected candidates with GPT-5.1 Vision
   - Keeps only candidates with score ≥ 4.0
   - Sorts by visual similarity
5. **Categorize Results**
   - High vision score (≥7.0) → Automatically Color Match
   - Low vision score (<4.0) → Reject completely
   - Medium score (4.0-6.9) → Falls through to text-based validation

### Code Location

**Function 1:** `enrichWithActualThumbnails()` in `app/api/search/route.ts` (lines 62-109)
- Fetches actual product thumbnails before GPT-5.1 selection

**Function 2:** `verifyThumbnailsWithVision()` in `app/api/search/route.ts` (lines 111-195)
- Optional secondary verification with vision scoring

**Integration:** Lines 2448-2460 (fetches actual thumbnails BEFORE GPT-5.1 selection)

### Example Prompt to GPT-5.1 (Selection Step)

```
Based on VISUAL COMPARISON of the cropped item with these 12 ACTUAL PRODUCT IMAGES, 
select 3-5 that match BEST.

SELECTION CRITERIA (in order of importance):
1. Visual similarity (colors, patterns, graphic design, style) - BE STRICT ABOUT COLORS!
2. Garment type match (same category - sweater, pants, bag, etc.)
3. Style details (collar type, button placement, fit, etc.)
4. Position in list (earlier results are from more targeted search)
5. Korean shopping sites preferred when visual quality is similar

CRITICAL COLOR MATCHING:
- White ≠ Beige ≠ Cream ≠ Off-white (be precise!)
- Navy ≠ Black ≠ Dark blue (distinguish clearly)
- These are ACTUAL product photos, so color accuracy is important!

Return ONLY valid JSON:
{"sweater_1": ["url1", "url2", "url3"]}
```

### Results

**Candidate 1 (White cardigan):**
```json
{
  "candidate": 1,
  "colorMatch": 2,
  "styleMatch": 8,
  "overallScore": 4.5,
  "reason": "Wrong color (white vs beige), but similar button-front cardigan style"
}
```

**Candidate 2 (Beige cardigan):**
```json
{
  "candidate": 2,
  "colorMatch": 9,
  "styleMatch": 9,
  "overallScore": 9.0,
  "reason": "Exact beige color match, similar ribbed knit texture and wrap style"
}
```

## Cost Optimization

- **Only verifies top 6 candidates** (not all search results)
- **Only runs when thumbnails are available** (skips if no images)
- **Batch processing**: Sends all 6 candidates in one API call
- **Uses GPT-5.1**: Same model as main search for consistency
- **Cost per search**: ~$0.01-0.02 (6 images × 2 calls = ~12 images total)

## Benefits

✅ **Accurate color matching** - No more white items in beige searches
✅ **Visual similarity scoring** - Ranks by actual appearance, not just text
✅ **Style verification** - Confirms garment type matches visually
✅ **Better user experience** - More relevant results in Color Match section

## Testing

To test the feature:

1. **Upload an image with a specific color** (e.g., beige sweater)
2. **Search for that item**
3. **Check console logs** for:
   ```
   🔍 VISION VERIFICATION: Checking 6 thumbnails against original...
   📸 Vision API response: [...]
      📸 Candidate 1: 9.0/10 - Exact beige color match...
      📸 Candidate 2: 4.5/10 - Wrong color (white vs beige)...
   ✅ Vision verification complete: 4 good matches, 2 filtered out
   ```
4. **Verify results** - White items should NOT appear in Color Match

## 🆕 NEW: Two-Stage Vision Verification (December 2025)

**We now use TWO separate vision calls for better accuracy!**

See: [`TWO_STAGE_VISION_VERIFICATION.md`](./TWO_STAGE_VISION_VERIFICATION.md)

### What Changed

**Old Approach (this document):**
- Single vision call for all verification
- Mixed results (color + style in one pass)
- Less precise filtering

**New Approach (recommended):**
- **Stage 1**: Find exact color + design matches
- **Stage 2**: Find design matches with varying colors
- Separate, focused prompts = better results
- Clear separation between Color Match and Style Match sections

### When to Use Which

- **Old single-call**: Backward compatibility, simpler setup
- **New two-stage**: Production use, better accuracy, clear result separation

## Future Improvements

- [ ] Cache vision scores to avoid re-verifying same products
- [ ] Add confidence threshold setting (user adjustable)
- [ ] Show visual similarity scores in UI
- [ ] A/B test with/without vision verification
- [ ] Experiment with Gemini 2.0 Flash (faster alternative)
- [✅] **DONE**: Two-stage vision verification for color vs style separation

## Configuration

To enable/disable vision verification, search for:
```typescript
if (candidatesForVision.length > 0 && croppedImageUrls.length > 0) {
  // Vision verification runs here
}
```

Set candidatesForVision.length check to 0 to disable.

