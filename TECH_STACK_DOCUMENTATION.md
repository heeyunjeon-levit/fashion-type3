# Fashion Search Tech Stack - Detailed Documentation

## Mode 1: OCR Mode (Text-Based Search)
**Trigger:** User selects "예" (Yes) - image has brand names/text

### Pipeline Overview:
```
Upload Image → OCR Extraction → Brand Detection → Hybrid Search → Display Results
```

### Detailed Flow:

#### Step 1: OCR Text Extraction
**Tool:** Next.js `/api/ocr-search` endpoint
- **Google Cloud Vision API** extracts all text from image
- Downloads image, converts to base64, sends to Vision API
- Gets back: full text + individual text segments
- Example: `"@coyseio 25F/W 입어봤어요.. 개기여음... ILLIT Toki Yo Tomare"`

```typescript
// Google Cloud Vision API call
POST https://vision.googleapis.com/v1/images:annotate
Body: {
  requests: [{
    image: { content: base64Image },
    features: [{ type: 'TEXT_DETECTION', maxResults: 100 }]
  }]
}
```

#### Step 2: Brand Detection with GPT-4o
**Tool:** GPT-4o (in `/api/ocr-search`)
- Takes extracted text from Vision API
- Maps text to fashion brands using AI reasoning
- **Filters out:**
  - K-pop groups (ILLIT, IVE, aespa, BLACKPINK, etc.)
  - Platform names (Musinsa, Instagram, Coupang, etc.)
  - Social media usernames (unless fashion brand pattern detected)

**Instagram Fashion Brand Recognition:**
- Pattern: `@brandname + season code (25F/W) + context (입어봤어요)`
- Regex fallback: `/@(\w+)\s+(\d{2}[SF]\/[WS])\s*(입어봤어요|샀어요)/g`
- Example: `@coyseio 25F/W 입어봤어요` → brand = "coyseio"

```typescript
// GPT-4o Brand Mapping
{
  "products": [
    {
      "brand": "coyseio",
      "exact_ocr_text": "25F/W 입어봤어요",
      "product_type": "tops",
      "model_number": "25F/W",
      "confidence": "high"
    }
  ]
}
```

#### Step 3: Hybrid Search Per Brand
**For each detected brand, calls `/api/search` with:**
- Brand name as category
- Full original image (for Lens visual search)
- Not using cropped images (full image context is better)

**Search executes TWO types:**

##### 3a. Full Image Search (Serper Lens)
- **Tool:** Serper Lens API (Google Lens visual search)
- Runs **3 times in parallel** for better coverage
- Sends: Full original image URL
- Returns: Visually similar products

```typescript
// Serper Lens call (3x parallel)
POST https://google.serper.dev/lens
Body: {
  url: originalImageUrl,
  gl: 'kr',
  hl: 'ko'
}
```

##### 3b. Text Search (Optional)
- Uses brand name + extracted text
- Fallback if visual search has few results

#### Step 4: Result Filtering
**Filters applied:**
- ❌ **Blocked domains:**
  - Music stores (YES24, Aladin, KTown4U)
  - Music platforms (Spotify, Melon, Apple Music)
  - Social media (Instagram, TikTok, Threads)
  - Magazines (ELLE, Vogue, Harper's Bazaar)
  
- ❌ **Blocked keywords:**
  - Album, music, photobook, poster
  - 앨범, 음악, 화보집, 포스터

#### Step 5: Results Display
- Returns actual product pages (not category pages)
- Each brand gets up to 5 products
- Total products displayed: varies by brands detected

### Does OCR Mode Use Full Image Only?
**Yes!** OCR mode uses **only full image search** because:
- Brand detection already narrows down the search
- Full image provides best context for brand-specific items
- Cropping not needed when you know the exact brand
- Example: Searching "coyseio 25F/W" with full image is very specific

---

## Mode 2: Visual Mode (No OCR)
**Trigger:** User selects "아니오" (No) - no visible brand text

### Pipeline Overview:
```
Upload Image → DINO-X Detection → User Selects Items → Modal Processing → Hybrid Search → Display Results
```

### Detailed Flow:

#### Step 1: Object Detection
**Tool:** Modal Backend `/detect` endpoint
- Uses DINO-X API with Modal's GPU-optimized integration
- Detects fashion items with bounding boxes
- Categories: coat, jacket, sweater, pants, skirt, bag, shoes, sunglasses, etc.

**Why Modal's Detection (Not Direct API):**
- ✅ **Proven quality** (1pm results were excellent)
- ✅ **GPU-accelerated** (T4 GPU processing)
- ✅ **Battle-tested filtering** (optimized thresholds)
- ✅ **Better main subject focus** (ignores background items)
- ❌ Direct DINO-X API had inconsistent quality

**Detection Parameters:**
```python
# Modal's DINO-X integration
{
  model: "DINO-X-1.0",
  image: base64Image,
  prompt: "fur coat. fur jacket. leather jacket. coat. jacket. shirt. blouse. sweater...",
  targets: ["bbox"],
  bbox_threshold: 0.25,
  iou_threshold: 0.8
}
```

**Filtering Logic (Modal's Optimized):**
- Confidence threshold: 0.45 (higher than direct API)
- Main subject score: 0.35 (centrality 40% + size 30% + confidence 30%)
- Max items: 8 (allows more options for user selection)
- Excludes problematic categories: leggings, tights, stockings
- Focuses on foreground items (filters background objects)

**Output Example:**
```typescript
[
  { category: "jacket", bbox: [0.2, 0.1, 0.8, 0.6], confidence: 0.85 },
  { category: "sunglasses", bbox: [0.4, 0.15, 0.6, 0.25], confidence: 0.72 },
  { category: "bag", bbox: [0.1, 0.5, 0.3, 0.8], confidence: 0.68 }
]
```

#### Step 2: User Selection
- Shows detected items with bounding boxes overlay
- User selects which items to search for
- Continues with only selected items

#### Step 3: Modal Backend Processing
**For each selected item:**

**Tool:** Modal GPU Backend `/process-item` endpoint
- **Crops image** using bbox coordinates
  - Smart cropping: tops exclude bottom 15% (avoid pants), bottoms exclude top 10% (avoid tops)
  - Adds 5% padding around bbox
  - Converts to JPEG
  
- **Generates GPT-4o-mini description:**
  - Analyzes cropped image
  - Describes: color, material, style, fit
  - Example: "Black aviator sunglasses with gold metallic frames and reflective lenses"
  - Example: "Beige ribbed knit sweater with brown faux fur sleeves and fitted silhouette"
  
- **Uploads to Supabase:**
  - Stores cropped JPEG in Supabase storage
  - Returns public HTTP URL
  - Example: `https://supabase.co/storage/v1/object/public/images/cropped_sunglasses_1234567.jpg`

```python
# Modal /process-item
{
  "croppedImageUrl": "https://supabase.co/.../cropped_sunglasses_123.jpg",
  "description": "Black aviator sunglasses with gold metallic frames",
  "category": "sunglasses"
}
```

#### Step 4: Hybrid Search (Per Item)
**Tool:** `/api/search` endpoint

**For each processed item, executes TWO parallel searches:**

##### 4a. Cropped Image Search (Serper Lens)
- **Input:** Cropped image URL from Modal
- **Runs:** 3 times in parallel for coverage
- **API:** Serper Lens (Google Lens visual search)
- **Purpose:** Find visually similar products matching the specific item

```typescript
// Per-item cropped search (3x parallel)
POST https://google.serper.dev/lens
Body: {
  url: croppedImageUrl, // Specific to this item
  gl: 'kr',
  hl: 'ko'
}
```

##### 4b. Full Image Search (Serper Lens)
- **Input:** Original full image URL
- **Runs:** 3 times in parallel (shared across all items)
- **API:** Serper Lens
- **Purpose:** Find exact matches for iconic/celebrity outfits
- **Prioritized:** Results from full image placed FIRST (highest quality)

```typescript
// Full image search (3x parallel, once per session)
POST https://google.serper.dev/lens
Body: {
  url: originalImageUrl, // Full image
  gl: 'kr',
  hl: 'ko'
}
```

#### Step 5: Result Merging & Deduplication
**Per category:**
1. **Merge results:**
   - Full image results (prioritized, placed first)
   - Cropped image results (category-specific)
   
2. **Filter full image results:**
   - Only keep results relevant to this category
   - Check title/snippet for category keywords
   - Example: For "sunglasses" → must contain "sunglasses", "선글라스", "glasses"

3. **Deduplicate by URL:**
   - Remove duplicate links
   - Preserve order (full image first)

4. **Domain filtering:**
   - Block social media (Instagram, TikTok, Threads)
   - Block magazines (ELLE, Vogue, Harper's Bazaar)
   - Block music stores (YES24, Melon)

```typescript
// Merged results structure
const mergedResults = [
  ...fullImageResults,      // Prioritized (celebrity/iconic matches)
  ...croppedImageResults    // Category-specific matches
]
```

#### Step 6: GPT-4o Selection
**Tool:** GPT-4o Turbo

**Input to GPT:**
- Merged & filtered results (up to ~120 candidates)
- Item description from Modal
- Category information
- Special instructions based on category

**GPT Prompt Structure:**
```
You are analyzing aggregated image search results for {category}.

IMPORTANT: Results are ordered by quality
- First {N} results are from full image search (most accurate for iconic items)
- Remaining results are from cropped image search

The original cropped image shows: {category keywords}
SPECIFIC ITEM DESCRIPTION: "{GPT-4o-mini description from Modal}"

CRITICAL GUIDANCE: TRUST GOOGLE LENS VISUAL SIMILARITY!
- START by reviewing top results (full image search)
- Prioritize them heavily
- If strong visual match, INCLUDE even if category label varies
- Focus on: "Does this product LOOK like the item?"

SELECTION CRITERIA:
1. Visual similarity (most important!)
2. Category match (flexible for top results)
3. Product page quality (must be actual product, not category)
4. Retailer credibility

CRITICAL RULES:
- Select 3-5 best matches
- Prioritize top results from full image search
- Actual product pages only (no category/search pages)
- No social media, no magazines
```

**GPT Response Format:**
```typescript
{
  "selected_links": [
    "https://amazon.com/product1",
    "https://zara.com/product2",
    "https://nordstrom.com/product3"
  ],
  "reasoning": "Selected these 3 products because..."
}
```

**Post-GPT Processing:**
1. Extract selected links
2. Match back to original Serper results for thumbnails/titles
3. Try multiple field names: `thumbnail`, `image`, `imageUrl`, `ogImage`
4. Fallback if GPT returns 0: use top 3 filtered results

#### Step 7: Results Display
**For each category:**
- 3-5 products selected by GPT
- With thumbnails (if Serper provided them)
- With titles (from Serper metadata)
- Clickable links to product pages

---

## Key Differences Summary

### OCR Mode ON:
```
INPUT: Image with visible brand text
↓
Google Cloud Vision API → Extracts text
↓
GPT-4o → Detects brands (e.g., "coyseio")
↓
Search: Full image + brand name
↓
OUTPUT: Brand-specific products (coyseio clothing)
```

**Uses:**
- ✅ Full image search only
- ✅ Brand context from OCR
- ✅ No cropping needed
- ❌ No DINO-X detection
- ❌ No Modal processing

### OCR Mode OFF:
```
INPUT: Image without brand text
↓
DINO-X → Detects items visually (coat, bag, sunglasses)
↓
Modal → Crops + Describes each item
↓
Search: Cropped image + Full image (hybrid!)
↓
GPT → Selects best matches using description
↓
OUTPUT: Visually similar products per category
```

**Uses:**
- ✅ Cropped image search (per item)
- ✅ Full image search (iconic/exact matches)
- ✅ Both merged and prioritized
- ✅ DINO-X detection
- ✅ Modal processing
- ✅ GPT description + selection

---

## Why Hybrid Search Works So Well

### For Iconic/Celebrity Items:
- **Full image search** recognizes context
- Finds exact matches (Kendall Jenner's fur coat)
- GPT prioritizes these heavily

### For Generic Items:
- **Cropped image search** focuses on specific item
- Avoids confusion from other items in frame
- More precise category matching

### Combined:
- Best of both approaches
- Full image results placed first (highest priority)
- Cropped results add alternatives
- GPT selects top 3-5 from combined pool

---

## GPT Selection Logic Details

### What GPT Sees:
```javascript
{
  fullImageResultsCount: 20,
  croppedImageResultsCount: 45,
  totalCandidates: 65, // After deduplication
  itemDescription: "Black aviator sunglasses with gold metallic frames",
  categoryKey: "sunglasses",
  mergedResults: [
    // First 20 are from full image (prioritized)
    { title: "Ray-Ban Aviator...", link: "...", thumbnail: "..." },
    { title: "Prada Sunglasses...", link: "...", thumbnail: "..." },
    // Next 45 are from cropped image
    { title: "Black Aviator...", link: "...", thumbnail: "..." },
    ...
  ]
}
```

### GPT Decision Process:
1. **Reviews top results first** (full image search)
   - These are likely exact or very close matches
   - Heavily prioritized in selection
   
2. **Checks visual similarity**
   - Uses description: "Black aviator sunglasses with gold metallic frames"
   - Looks for: color match, style match, category match
   
3. **Validates product page quality**
   - Must be actual product page (not category page)
   - Must be from legitimate retailer
   - Rejects: social media, magazines, non-shopping sites
   
4. **Flexible category matching**
   - If top result is visually perfect but labeled differently, still include
   - Example: "Fur coat" detected as "sweater" but looks identical → INCLUDE
   
5. **Selects 3-5 best**
   - Quality over quantity
   - Ranked by visual similarity + source quality

### GPT Reasoning Example:
```
"Selected these 3 sunglasses:
1. Ray-Ban Aviator Gold - Perfect match for black frame + gold temples
2. Prada PR 0PR - Similar aviator style with metallic details
3. Gucci GG0137S - Alternative black aviator with gold accents

Rejected fashion.elle.co.kr (magazine, not shop)
Rejected instagram.com/sunglasses (social media)
Prioritized full image results as they showed exact style match."
```

---

## Search Result Quality Factors

### High Quality Indicators:
1. **Full image search results** (celebrity outfit exact matches)
2. **Detailed GPT-4o-mini descriptions** (color, material, style, fit)
3. **Visual Lens matching** (Google's image recognition)
4. **GPT-4o filtering** (intelligent selection vs keyword matching)
5. **Multiple Serper runs** (3x parallel for coverage)

### Why Results Are Good:
- **Modal's cropping:** Smart padding, category-specific adjustments
- **Modal's descriptions:** Fashion catalog quality, specific details
- **Hybrid search:** Combines broad context + narrow focus
- **GPT selection:** Understands visual similarity, not just text
- **Result prioritization:** Best results (full image) shown first

---

## Tech Stack Components

### Frontend:
- **Next.js** (React framework)
- **Canvas API** (client-side image display/cropping for OCR mode)
- **TypeScript**
- **Tailwind CSS**

### Backend:
- **Next.js API Routes** (serverless functions)
  - `/api/detect-dinox` - DINO-X detection wrapper
  - `/api/ocr-search` - OCR brand extraction
  - `/api/describe-item` - GPT-4o-mini descriptions (backup)
  - `/api/search` - Main search orchestrator
  - `/api/upload-cropped` - Supabase upload helper

- **Modal GPU Backend** (Python/FastAPI)
  - `/process-item` - Crop + describe items
  - Runs on T4 GPU
  - Uses Supabase for image storage

### AI/ML Services:
- **DINO-X API** - Object detection (computer vision)
- **Google Cloud Vision API** - OCR text extraction
- **GPT-4o** - Brand mapping, result selection
- **GPT-4o-mini** - Item descriptions (faster, cheaper)
- **Serper API** - Google Lens visual search

### Storage:
- **Supabase** - Image storage (cropped images)
- **localStorage** - Client-side state persistence

### Analytics:
- **Supabase Database** - Search session logging

---

## Performance Metrics

### OCR Mode:
- Text extraction: ~2-5s (Google Vision)
- Brand mapping: ~1-3s (GPT-4o)
- Search per brand: ~3-8s (Serper Lens 3x)
- **Total**: ~6-16s for 1-2 brands

### Visual Mode:
- Detection: ~5-10s (DINO-X API)
- Processing: ~2-3s per item (Modal)
- Search: ~3-8s per item (Serper Lens 3x + GPT)
- **Total**: ~10-30s for 2-3 items

### Why Fast:
- Parallel processing (all searches run simultaneously)
- Direct API calls (no unnecessary middleware)
- Client-side cropping for OCR (no upload delay)
- Modal GPU for heavy processing
- Efficient caching and deduplication

---

## Cost Optimization

### AI Model Usage:
- **DINO-X**: Free tier (object detection)
- **Google Vision**: ~$1.50 per 1000 images (OCR)
- **GPT-4o-mini**: ~$0.15 per 1M tokens (descriptions)
- **GPT-4o**: ~$2.50 per 1M tokens (selection, mapping)
- **Serper**: ~$50 per 1000 searches

### Cost Per Search:
- **OCR Mode**: ~$0.05-0.10 (Vision + GPT + Serper)
- **Visual Mode**: ~$0.03-0.08 (DINO-X + GPT-mini + GPT + Serper)

### Optimization Strategies:
- Use GPT-4o-mini for descriptions (10x cheaper than GPT-4)
- Parallel API calls reduce total time
- Client-side operations (Canvas) are free
- Deduplication reduces redundant processing

---

## Error Handling & Fallbacks

### DINO-X Detection:
- Timeout: 120s with polling
- Fallback: Modal backend (if deployed)
- Status checks: "success" vs "failure"

### Modal Processing:
- Timeout: 30s per item
- Fallback: Skip item, continue with others
- Errors logged but don't block other items

### Search:
- Multiple Serper runs (3x) for reliability
- If GPT selection fails: use top 3 filtered results
- Blocked domain filtering prevents low-quality results

### OCR Mode:
- If no text detected: User-friendly error message
- If no brands found: Returns reason (K-pop groups filtered, etc.)
- If search returns 0: Shows which brands failed

---

## Quality Assurance

### Pre-GPT Filtering:
1. Remove duplicate URLs
2. Block social media domains
3. Block magazine/editorial sites
4. Filter by category keywords (for multi-category searches)
5. Exclude non-product pages

### GPT Validation:
1. Must be actual product pages
2. Must match visual description
3. Must be from reputable retailers
4. Prioritize full image results (most accurate)

### Post-GPT Validation:
1. Verify links still exist in original results
2. Extract thumbnails from Serper metadata
3. Fallback to top filtered results if GPT returns 0
4. Log reasoning for debugging

---

---

## When Do We Use Direct DINO-X API vs Modal?

### NEVER Use Direct DINO-X API for Detection!
❌ **Next.js `/api/detect-dinox`** (custom wrapper)
- Created as an "optimization" but caused quality issues
- Inconsistent filtering results
- Higher latency due to polling
- This is what caused us to "get off the rails"

### ALWAYS Use Modal for Detection & Processing
✅ **Modal `/detect`** endpoint
- Proven quality from 1pm results
- GPU-optimized processing (T4)
- Battle-tested filtering parameters
- Main subject focus works reliably

✅ **Modal `/process-item`** endpoint
- Smart cropping (padding, category-specific adjustments)
- GPT-4o-mini descriptions (fast, accurate)
- Supabase upload (returns HTTP URLs)

### Architecture Decision: Keep It Simple
```
❌ OLD (Complex, unreliable):
Next.js /api/detect-dinox → direct DINO-X API → inconsistent quality
  ↓ (fallback on failure)
Modal /detect → DINO-X via Modal → good quality

✅ NEW (Simple, reliable):
Modal /detect → DINO-X via Modal → consistent quality ✅
Modal /process-item → crop + describe → perfect ✅
```

**Lesson Learned:** Sometimes "optimization" makes things worse. Modal's integration is already optimized on GPU - use what works!

---

## Why This Architecture Works

### Separation of Concerns:
- **Detection:** DINO-X (specialized computer vision)
- **Processing:** Modal (GPU-accelerated cropping + descriptions)
- **Search:** Serper Lens (Google's visual search)
- **Intelligence:** GPT-4o (reasoning and selection)

### Each tool does what it's best at:
- Computer vision models → detect objects
- GPT models → understand context and reason
- Google Lens → find visually similar products
- Human-like AI → select best matches

### Redundancy for Quality:
- 3x Serper runs per search (coverage)
- Full + cropped search (context + precision)
- GPT + fallback selection (reliability)
- Multiple thumbnail field checks (compatibility)

### Speed Optimizations:
- Parallel processing throughout
- Client-side operations where possible
- Efficient API usage (no redundant calls)
- Smart caching and deduplication

---

## Current Architecture Status (Post-1pm Quality Restoration)

### What's Working Perfectly:
✅ DINO-X detection (foreground focus, good categories)
✅ Modal processing (crop + describe + upload)
✅ Hybrid search (cropped + full image)
✅ GPT selection (visual-first, description-aware)
✅ Domain blocking (no social media, no magazines)
✅ Result quality (thumbnails, titles, accurate matches)

### Visual Mode Flow:
```
Image Upload
    ↓
DINO-X Detection (5-10s)
    ↓
User Selects Items
    ↓
Modal Processing (2-3s per item)
│   ├─ Smart crop
│   ├─ GPT-4o-mini description
│   └─ Supabase upload
    ↓
Parallel Hybrid Search
│   ├─ 3x Cropped Lens (per item)
│   └─ 3x Full Lens (shared)
    ↓
Merge & Deduplicate
    ↓
GPT-4o Selection (3-5 best)
    ↓
Display Results
```

### OCR Mode Flow:
```
Image Upload
    ↓
Google Cloud Vision OCR (2-5s)
    ↓
GPT-4o Brand Detection
│   ├─ Filter K-pop groups
│   ├─ Filter platforms
│   └─ Recognize Instagram brands
    ↓
Per-Brand Search
│   └─ 3x Full Image Lens
    ↓
Filter Results
│   ├─ Block music stores
│   └─ Block non-fashion
    ↓
Display Results (per brand)
```

---

## Summary

**OCR Mode:** Best for images with visible brand text
- Uses: Google Vision + GPT-4o + Serper Lens
- Search type: Full image only (brand-focused)
- Speed: 6-16s
- Quality: High for known brands

**Visual Mode:** Best for images without brand text
- Uses: DINO-X + Modal + GPT-4o-mini + GPT-4o + Serper Lens
- Search type: Hybrid (cropped + full image)
- Speed: 10-30s
- Quality: Excellent for visual matching

**Both modes produce high-quality results by combining:**
1. Specialized AI for each task
2. Visual + text search
3. Smart filtering and selection
4. Human-like reasoning with GPT

