# Specific Category Preservation Feature

## Overview

Previously, the system was **losing valuable specificity** from DINO-X detections by normalizing specific categories to generic parent categories. This feature preserves DINO-X's specific detections throughout the entire pipeline for **dramatically improved search accuracy**.

**Updated:** Refactored to remove redundant fields and clarify the actual role of `parent_category`.

## Key Insight

**`parent_category` is ONLY used for broad exclusion filtering in search results. It is NOT used by the UI.**

## The Problem (Before)

### Old Flow:
```
1. DINO-X detects: "jeans" ✅ (specific and accurate)
2. System normalizes: "jeans" → "bottoms" ❌ (loses specificity)
3. Search uses: ["shorts", "slacks", "pants", "trousers", "jeans", "skirt"] ❌
4. Result: User searching for jeans gets skirt results!
```

### Why This Was Bad:
- **Lost DINO-X's precision**: DINO-X can distinguish "jeans" from "trousers" from "skirts"
- **Diluted search results**: Searching for all bottoms when user has jeans
- **Category confusion**: Why search for skirts if DINO-X detected pants?

## The Solution (After)

### New Flow:
```
1. DINO-X detects: "jeans" ✅
2. System preserves: 
   - specificCategory: "jeans" ✅ (for search)
   - parentCategory: "bottoms" ✅ (for UI grouping only)
3. Search uses: "jeans" ✅ (targeted and specific)
4. Result: User gets jeans results! 🎯
```

### Key Insight from DINO-X Paper

According to the [DINO-X paper](https://arxiv.org/pdf/2411.14347):

> "DINO-X employs a **universal object prompt** to support **prompt-free open-world object detection**, making it possible to detect anything in an image without requiring users to provide any prompt."

The model is trained on **Grounding-100M** (100+ million samples) and achieves:
- **56.0 AP** on COCO zero-shot
- **63.3 AP on rare classes** (long-tailed objects)

This means:
- ✅ **Generic prompt is correct** (let DINO-X use its broad knowledge)
- ✅ **Trust the output** (don't normalize away its specific detections)

## Implementation Details

### 1. Type System Changes

**Before (Original):**
```typescript
interface DetectedItem {
  category: string // "bottoms" (generic) ❌
  groundingdino_prompt: string // "jeans" (specific, but not used!)
}
```

**After (Cleaned Up - No Redundancy):**
```typescript
interface DetectedItem {
  category: string // "jeans" (DINO-X detected category - used for search)
  parent_category: string // "bottoms" (ONLY for exclusion filtering, NOT for UI)
  description: string // GPT-4o description
  croppedImageUrl?: string
  croppedImageUrls?: string[]
  confidence?: number
}
```

**Removed redundant fields:**
- ❌ `specificCategory` (redundant with `category`)
- ❌ `groundingdino_prompt` (redundant with `category`)

### 2. Search API Changes

**File: `app/api/search/route.ts`**

**Before:**
```typescript
// Extract and normalize
const rawCategoryKey = resultKey.split('_')[0] // "jeans"
const categoryKey = categoryNormalizationMap[rawCategoryKey] || rawCategoryKey // "bottoms" ❌

// Search with generic terms
const searchTerms = categorySearchTerms[categoryKey] || [categoryKey]
// → ["shorts", "pants", "jeans", "skirt"] ❌

// Relevance check with parent category
const categoryTerms = categorySearchTerms["bottoms"] // ❌ Allows skirts!
const hasRelevantKeyword = categoryTerms.some(term => title.includes(term))
```

**After:**
```typescript
// Extract specific category from DINO-X
const specificCategory = resultKey.split('_')[0] // "jeans"

// Map to parent ONLY for exclusion filtering
const parentCategory = categoryToParentMap[specificCategory] || specificCategory
const categoryKey = parentCategory // Used ONLY for exclusion filtering

// Search with SPECIFIC category
const searchTerms = itemDescription 
  ? [itemDescription]
  : [specificCategory] // "jeans" ✅

// Relevance check with SPECIFIC category (FIXED BUG!)
const hasRelevantKeyword = combinedText.includes(specificCategory.toLowerCase())
// → Must contain "jeans", NOT just any bottom! ✅
```

### Critical Bug Fixed: Relevance Checking

**The Problem:**
Previously, relevance checking used `parentCategory`, which allowed wrong items:
```typescript
// OLD (WRONG):
categoryTerms = categorySearchTerms["bottoms"] 
// = ["shorts", "pants", "jeans", "skirt"]
// → A skirt result would PASS! ❌
```

**The Fix:**
Now uses `specificCategory` for strict matching:
```typescript
// NEW (CORRECT):
hasRelevantKeyword = combinedText.includes("jeans")
// → Only items containing "jeans" pass ✅
```

### 3. Detection API (Already Correct!)

**File: `app/api/detect-dinox/route.ts`**

The detection API was already returning specific categories:

```typescript
return {
  id: `${mappedCategory}_${idx}`,
  bbox: bbox,
  category: obj.category, // "jeans" from DINO-X ✅
  mapped_category: mappedCategory, // "bottoms" for UI
  confidence: confidence
}
```

**No changes needed** - it was already preserving the specific detection!

### 4. Frontend Processing

**File: `app/page.tsx`**

**Before:**
```typescript
return {
  category: bbox.mapped_category || bbox.category, // "bottoms" ❌
  groundingdino_prompt: bbox.category, // "jeans" (unused)
}
```

**After (Cleaned Up):**
```typescript
return {
  category: bbox.category, // "jeans" ✅
  parent_category: bbox.mapped_category, // "bottoms" (for exclusion filtering only)
  description: description,
  croppedImageUrl: uploadedUrls[0],
  croppedImageUrls: uploadedUrls,
  confidence: bbox.confidence
}
```

### 5. UI Display Names

**File: `app/components/Results.tsx`**

Added comprehensive Korean translations for all specific DINO-X categories:

```typescript
const categoryNames: Record<string, string> = {
  // Parent categories (for fallback)
  tops: '상의',
  bottoms: '하의',
  
  // Specific categories (DINO-X output)
  jacket: '재킷',
  coat: '코트',
  jeans: '청바지',
  pants: '바지',
  skirt: '치마',
  shorts: '반바지',
  // ... 50+ specific categories
}
```

## What parent_category Actually Does

**ONLY Purpose: Broad Exclusion Filtering in Search Results**

### Example: Searching for "Jeans"

```typescript
category: "jeans"           // Used for: Search query & relevance check
parent_category: "bottoms"  // Used for: Exclusion filtering only
```

**Exclusion Filtering Logic:**
```typescript
// When parent_category = "bottoms"
const categoryExclusions = {
  'bottoms': [
    'shirt', 'jacket', 'sweater', // ❌ Exclude tops
    'bag', 'backpack', 'purse',   // ❌ Exclude bags
    'shoe', 'boot', 'sneaker'     // ❌ Exclude shoes
  ]
}

// Example results:
"Blue denim jeans" ✅ (no excluded terms)
"Blue denim jacket" ❌ (contains "jacket" → excluded)
"Jeans + matching bag" ❌ (contains "bag" → excluded)
```

**NOT Used For:**
- ❌ UI display (uses specific `category` directly)
- ❌ Search query (uses specific `category`)
- ❌ Relevance checking (uses specific `category`)

## Benefits

### 1. **More Relevant Search Results**
- User uploads jeans → searches for jeans (not all bottoms)
- User uploads blazer → searches for blazers (not all tops)
- User uploads sneakers → searches for sneakers (not all shoes)

### 2. **Better User Experience**
- Accurate category labels: "청바지" instead of generic "하의"
- More targeted product recommendations
- Less irrelevant results to filter through
- **Fixed bug:** Skirt results no longer appear in jeans searches!

### 3. **Respects DINO-X's Intelligence**
- Leverages 100M+ training samples
- Uses model's ability to distinguish specific items
- Maintains the specificity DINO-X was designed for

### 4. **Cleaner Architecture**
- Removed redundant fields (`specificCategory`, `groundingdino_prompt`)
- Clear separation of concerns (`category` for search, `parent_category` for filtering)
- Single source of truth for DINO-X detections

## Example Scenarios

### Scenario 1: Jeans Detection

**Before:**
```
DINO-X: "jeans"
Search: "하의" (bottoms)
Results: Mix of jeans, pants, skirts, shorts ❌
```

**After:**
```
DINO-X: "jeans"
Search: "청바지" (jeans)
Results: Only jeans! ✅
```

### Scenario 2: Blazer Detection

**Before:**
```
DINO-X: "blazer"
Search: "상의" (tops)
Results: Mix of jackets, shirts, sweaters, blazers ❌
```

**After:**
```
DINO-X: "blazer"
Search: "블레이저" (blazer)
Results: Only blazers! ✅
```

### Scenario 3: Handbag Detection

**Before:**
```
DINO-X: "handbag"
Search: "가방" (bag)
Results: Mix of backpacks, totes, clutches, handbags ❌
```

**After:**
```
DINO-X: "handbag"
Search: "핸드백" (handbag)
Results: Only handbags! ✅
```

## Testing Recommendations

### 1. Test Specific Categories
Upload images with:
- ✅ Jeans (not generic pants)
- ✅ Blazer (not generic jacket)
- ✅ Sneakers (not generic shoes)
- ✅ Handbag (not generic bag)
- ✅ Cardigan (not generic sweater)

### 2. Verify Search Results
Check that search results match the specific item type, not generic category.

### 3. Check UI Labels
Verify Korean labels show specific names:
- "청바지" not "하의"
- "블레이저" not "상의"
- "핸드백" not "가방"

### 4. Edge Cases
- Items DINO-X can't categorize specifically → should fall back to parent
- Multiple instances of same specific item (e.g., "jeans_1", "jeans_2")
- Items with similar parent but different specifics (jeans vs trousers)

## Related Files

### Modified Files:
1. **`app/api/search/route.ts`** - Search logic to use specific categories
2. **`app/page.tsx`** - Type definitions and item processing
3. **`app/components/Results.tsx`** - Korean display names for specific categories

### Unchanged Files (Already Correct):
1. **`app/api/detect-dinox/route.ts`** - Already preserving specific categories
2. **`app/components/InteractiveBboxSelector.tsx`** - Already has translations

## Future Enhancements

### 1. Expand DINO-X Prompt (Potential)
Based on Zara's categories, could add:
```typescript
const FASHION_CATEGORIES = [
  // Current + New specific types
  "puffer jacket", "quilted coat", "trench coat",
  "dress shirt", "t-shirt", "polo shirt",
  "joggers", "sweatpants", "bermuda shorts",
  "co-ord set", "matching set",
  // ...
]
```

**However:** Current generic prompt is working well per DINO-X paper design.

### 2. Smart Category Fallback
If specific search yields < 3 results:
```typescript
if (specificResults.length < 3) {
  // Fall back to parent category search
  fallbackSearch(parentCategory)
}
```

### 3. Category Confidence Scoring
Use DINO-X confidence to decide specific vs generic:
```typescript
if (confidence > 0.8) {
  useSpecificCategory()
} else {
  useParentCategory()
}
```

## Conclusion

This feature **preserves DINO-X's intelligence** throughout the pipeline, resulting in:
- 🎯 **More accurate searches** (specific items, not generic categories)
- 📊 **Better user experience** (relevant results, clear labels)
- 🧠 **Respects ML model design** (uses DINO-X as intended)

The key insight: **Don't normalize away the model's hard-earned specificity!**

