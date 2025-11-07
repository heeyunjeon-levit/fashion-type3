# Search Optimization Summary - Nov 6, 2025

**Final Decision:** Reverted to **Sequential GPT Analysis** (original approach)

---

## 🎯 What We Tested

### Attempt 1: Parallel Batching (Size 10)
```
30 results → 3 batches of 10 → Each batch picks best 3
```
**Results:**
- ✅ Speed: 16s (50% faster)
- ❌ Quality: Poor (obscure retailers, geo-restricted sites)
- ❌ Problem: Local optimization per batch, missed globally best results

**Example (Bag):**
- jeteveux.co.uk (obscure UK reseller)
- bimqp.com (unknown site)
- clubdelecoahorro.com.pe (Peru-only)

---

### Attempt 2: Larger Batches (Size 15)
```
30 results → 2 batches of 15 → Each batch picks best 3
```
**Results:**
- ✅ Speed: 20s (35% faster)
- ⚠️  Quality: Better but still not optimal
- ❌ Problem: Still local optimization, better than size-10 but not good enough

**Example (Bag):**
- vestiairecollective.com (vintage/reseller)
- bunjang.co.kr (Korean marketplace)
- Better than size-10, but still not major retailers

---

### Attempt 3: Two-Phase Approach
```
Phase 1: Score all 30 in parallel (0-10 scale)
Phase 2: Select top 5 globally by score
```
**Results:**
- ✅ Speed: 15s (50% faster)
- ⚠️  Quality: Inconsistent scoring
- ❌ Problem: Scoring not as effective as direct selection

**Example (Bag):**
- calvinklein.co.kr (score 7) - But was a category page
- thepurseaffair.com (score 7) - Vintage reseller
- ebay.com (score 6) - Marketplace

**Issue:** Even with explicit retailer quality scoring (3 pts for major retailers), GPT wasn't consistently selecting the best results.

---

## ✅ Final Decision: Sequential Analysis

### Why We Reverted

**The original sequential approach:**
```
Analyze all 30 results together → Pick best 3-5 globally
```

**Advantages:**
- ✅ **Quality:** Best possible (GPT sees all options, makes globally optimal choice)
- ✅ **Consistency:** Proven to work well in previous batch tests
- ✅ **Simplicity:** No complex batch logic, less prone to errors
- ✅ **Reliability:** Users reported good results with this approach

**Trade-off:**
- ❌ Speed: 28-31 seconds (slower than parallel approaches)

---

## 📊 Performance Comparison

| Approach | Speed | Quality | User Satisfaction | Decision |
|----------|-------|---------|------------------|----------|
| Sequential (Original) | 31s | ⭐⭐⭐⭐⭐ | ✅ Good | **KEEP** |
| Parallel (size 10) | 16s | ⭐⭐ | ❌ Poor | ❌ Rejected |
| Parallel (size 15) | 20s | ⭐⭐⭐ | ⚠️  Mediocre | ❌ Rejected |
| Two-Phase | 15s | ⭐⭐⭐ | ❌ Poor | ❌ Rejected |

---

## 💡 Key Learnings

### 1. Quality > Speed for E-commerce Search

**Why:** 
- Users expect accurate, relevant results
- Bad results = lost trust + abandoned searches
- 10-15 seconds saved is not worth poor quality

### 2. Global Optimization Matters

**Problem with parallel batching:**
- Each batch makes locally optimal decisions
- Misses globally optimal results
- Even with 2-phase scoring, harder to get consistency

**Why sequential works:**
- GPT sees ALL options at once
- Can compare across all results
- Makes better trade-offs (quality vs. accessibility vs. price)

### 3. Retailer Quality Scoring is Hard

**Issue:** Even with explicit scoring criteria (3 pts for major retailers), GPT:
- Sometimes scored boutiques highly
- Gave high scores to marketplace sellers
- Inconsistent between batches

**Why:** Retailer reputation is nuanced and context-dependent

---

## 🎯 Current Implementation

### Sequential GPT Analysis

**What it does:**
1. Get 30 top search results (cropped + full image)
2. Pre-filter wrong sub-types (skirts when searching pants, etc.)
3. Send ALL 30 results to GPT-4-turbo in one call
4. GPT analyzes all, picks best 3-5 globally
5. Post-filter for blocked domains and category pages

**Performance:**
- Time: 28-31 seconds
- Quality: High (proven in batch tests)
- Consistency: Good

**Optimizations already in place:**
- ✅ Parallel Serper calls (3 runs simultaneously)
- ✅ Pre-filtering (removes wrong sub-types before GPT)
- ✅ Post-filtering (safety net for bad links)
- ✅ Deduplication (across multiple Serper runs)
- ✅ Category/search page filtering

---

## 🔧 Other Improvements Made Today

### 1. Fixed Korean Filename Issue ✅
**Problem:** Filenames with Korean characters caused Supabase upload errors  
**Solution:** Sanitize filenames to remove non-ASCII characters  
**File:** `app/api/upload/route.ts`

### 2. GPU Backend Verified ✅
**Status:** GPU backend working correctly  
**Crop Time:** 11-12 seconds per image (4-5x faster than CPU)  
**URL:** `https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run`

### 3. Frontend Crops in Parallel ✅
**Status:** Frontend already sends crop requests in parallel  
**Issue identified:** Backend may be processing sequentially (7s gap between crops)  
**Action:** Monitor in future, may need Modal concurrency tuning

---

## 📈 Overall Performance (Current)

### End-to-End Timing
```
Upload:    4-5s   (Supabase storage)
Crop:      12s    (GPU backend, parallel requests)
Search:    30s    (Sequential GPT, best quality)
────────────────────────────────
TOTAL:     46-47s
```

### Quality Metrics
- **Crop accuracy:** High (GPU GroundingDINO working well)
- **Search relevance:** High (sequential GPT, proven quality)
- **Retailer quality:** Good (major brands, accessible sites)

---

## 🎯 Recommendations

### Short-term (Current)
- ✅ **Keep sequential GPT** - Quality is priority
- ✅ **Monitor crop parallelization** - Backend may need tuning
- ✅ **Deploy GPU backend update** to production

### Medium-term (Future consideration)
If speed becomes critical:
- Investigate GPT-4o (newer, faster model)
- Consider caching common item searches
- Explore hybrid: Fast for preview, thorough for final results

### Long-term (If needed)
- Custom ML model for search result filtering
- Pre-computed embeddings for faster matching
- Result caching layer

---

## ✅ Summary

**What we learned:**
- Parallel batching sacrifices too much quality for speed
- Sequential analysis is the right choice for e-commerce search
- Users value result quality over 10-15 second speed improvement

**What we kept:**
- Sequential GPT analysis (original, proven approach)
- GPU backend (4-5x faster crops)
- Parallel Serper calls (already optimized)

**What we removed:**
- Parallel batch GPT optimization
- Two-phase scoring approach

**Net result:**
- Same high-quality search results as before
- Faster crops (GPU backend)
- Reliable, consistent performance

---

**Decision: Quality over speed. Sequential GPT is the right choice.** ✅

