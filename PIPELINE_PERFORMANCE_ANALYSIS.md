# Fashion Search MVP - Performance Analysis & Bottlenecks

## 🔍 Complete Pipeline Overview

```
User uploads image
    ↓ [1-3s]
1. Upload to Supabase
    ↓ [0-90s - MAJOR BOTTLENECK]
2. Crop with Modal (GroundingDINO + SAM-2)
    ↓ [15-30s - MAJOR BOTTLENECK]
3. Product search via Serper API (3 calls × N items)
    ↓ [5-10s]
4. Filter results with GPT-4o
    ↓ [1-2s]
5. Display results
```

---

## ⏱️ Detailed Timing Breakdown

### Phase 1: Image Upload to Supabase
**Time:** 1-3 seconds  
**Bottleneck Level:** 🟢 Low

**What happens:**
- Frontend uploads image file
- Supabase stores in `images` bucket
- Returns public URL

**Optimization potential:** Minimal - already fast

---

### Phase 2: Image Cropping (Modal Backend)
**Time:** 5-90 seconds  
**Bottleneck Level:** 🔴 **CRITICAL**

This is the **biggest bottleneck** in your pipeline!

#### Cold Start (First request after idle):
⏱️ **60-90 seconds**

**Breakdown:**
1. **Model Loading** (50-70s) 🔴
   - GroundingDINO weights: ~500MB
   - SAM-2 weights: ~800MB
   - Total: ~1.3GB loaded into memory
   - PyTorch initialization
   - CUDA setup (even on CPU)

2. **GPT-4o API Call** (3-5s)
   - Analyze image
   - Generate detection prompts
   - Network latency to OpenAI

3. **GroundingDINO Detection** (2-5s)
   - Run object detection
   - Process all prompts
   - Generate bounding boxes

4. **SAM-2 Segmentation** (5-10s per item)
   - Segment each detected item
   - Generate masks
   - Crop and save images

5. **Upload cropped images to Supabase** (1-2s per item)

#### Warm Requests (Within 10 minutes):
⏱️ **5-15 seconds**

**Breakdown:**
1. ~~Model Loading~~ (SKIP - already in memory)
2. GPT-4o API Call (3-5s)
3. GroundingDINO Detection (1-2s)
4. SAM-2 Segmentation (2-5s per item)
5. Upload crops to Supabase (1-2s per item)

**Example for 2 items:**
- GPT: 3s
- Detection: 2s
- SAM per item: 5s × 2 = 10s
- Upload: 2s × 2 = 4s
- **Total: ~19s**

---

### Phase 3: Product Search (Serper API)
**Time:** 15-30 seconds  
**Bottleneck Level:** 🟡 **MODERATE**

**What happens:**
- For each cropped image, we make **3 Serper API calls**
- Each call takes ~5-10 seconds
- Calls are made **sequentially** per image
- If you have 2 cropped items = 6 total Serper calls

**Current Implementation:**
```typescript
// For each cropped image
for (const [resultKey, croppedUrl] of Object.entries(croppedImages)) {
  // Call 1: Search cropped image
  const serper1 = await fetch(SERPER_URL) // ~5-10s
  
  // Call 2: Search cropped image again
  const serper2 = await fetch(SERPER_URL) // ~5-10s
  
  // Call 3: Search cropped image again
  const serper3 = await fetch(SERPER_URL) // ~5-10s
  
  // Total per image: 15-30s
}
```

**For 2 items:** 30-60 seconds total

---

### Phase 4: GPT-4o Result Filtering
**Time:** 5-10 seconds  
**Bottleneck Level:** 🟢 Low

**What happens:**
- GPT-4o analyzes aggregated Serper results
- Extracts top 3 product links
- Gets thumbnails and titles

**Current Implementation:**
- One GPT call per cropped image
- Processes ~60-100 search results per call
- Returns top 3 links

---

## 📊 Total Pipeline Time

### Scenario 1: Cold Start (First Request)
```
Upload:           2s
Crop (cold):     75s  🔴 BOTTLENECK
Search (2 items): 40s  🟡 BOTTLENECK
Filter:          10s
─────────────────────
TOTAL:          127s (~2 minutes)
```

### Scenario 2: Warm Request (Within 10 min)
```
Upload:           2s
Crop (warm):     15s  🟢
Search (2 items): 40s  🟡 BOTTLENECK
Filter:          10s
─────────────────────
TOTAL:           67s (~1 minute)
```

---

## 🚀 Optimization Opportunities

### Critical (High Impact):

#### 1. Keep Modal Backend Warm 🔥
**Current:** Cold start every 5-10 minutes of idle  
**Impact:** Saves 50-70 seconds on every request  

**Solutions:**
- **Ping endpoint every 5 minutes** (simple cron job)
- **Use Modal's @app.function(keep_warm=1)** parameter
- **Pre-warm on demand** (ping before user uploads)

```python
# In modal_final.py
@app.function(
    image=image,
    cpu=2,
    memory=16384,
    timeout=600,
    keep_warm=1,  # Keep 1 container warm
    secrets=[modal.Secret.from_name("fashion-api-keys")],
)
```

**Cost:** ~$10-20/month to keep 1 container warm 24/7

---

#### 2. Parallelize Serper API Calls 🚀
**Current:** Sequential (3 calls per item, one after another)  
**Impact:** Saves 20-40 seconds per item  

**Current Code:**
```typescript
// Sequential - SLOW
const results1 = await serperCall1()
const results2 = await serperCall2()
const results3 = await serperCall3()
// Takes 30s for 3 calls
```

**Optimized Code:**
```typescript
// Parallel - FAST
const [results1, results2, results3] = await Promise.all([
  serperCall1(),
  serperCall2(),
  serperCall3()
])
// Takes 10s for 3 calls (20s saved!)
```

**For 2 items:** Saves 40 seconds!

---

#### 3. Reduce Serper Calls from 3 to 2 (or 1)
**Current:** 3 calls per cropped image  
**Impact:** Saves 10-20 seconds per item  

**Analysis from previous testing:**
- 1 call: ~60 unique results
- 3 calls: ~94 unique results (only 34 more)
- **Diminishing returns after 2 calls**

**Recommendation:** Use 2 calls instead of 3
- Still get ~85 unique results
- Save 10s per item
- For 2 items: Save 20 seconds

---

#### 4. Cache Serper Results
**Current:** Every search hits Serper API  
**Impact:** Can eliminate search time for repeat images  

**Implementation:**
```typescript
// Cache key: hash of cropped image URL
const cacheKey = hash(croppedImageUrl)
const cached = await redis.get(cacheKey)
if (cached) return cached // Instant!

// Otherwise fetch and cache
const results = await serperSearch()
await redis.set(cacheKey, results, 3600) // 1 hour TTL
```

**Benefit:** 
- First search: 40s
- Cached search: <1s
- Great for similar images

---

### Moderate (Medium Impact):

#### 5. Use Smaller/Faster Models
**Current:** GroundingDINO SwinT + SAM-2 Hiera Large  
**Impact:** Saves 5-10 seconds on warm requests  

**Options:**
- **SAM-2 Tiny** instead of Large (800MB → 150MB)
  - 3x faster inference
  - Slightly lower accuracy
  - Worth testing

**Implementation:**
```python
# In custom_item_cropper.py
# Current:
SAM2_CHECKPOINT = "data/weights/sam2_hiera_large.pt"

# Optimized:
SAM2_CHECKPOINT = "data/weights/sam2_hiera_tiny.pt"
```

---

#### 6. Optimize GPT-4o Calls
**Current:** One call per cropped image for filtering  
**Impact:** Saves 5-10 seconds  

**Options:**
- **Batch all items** in one GPT call
- Use **GPT-4o-mini** (cheaper, 2x faster)
- Reduce response length requirement

**Current:**
```typescript
// Separate call per item
for (const item of items) {
  await gptFilter(item.results) // 5s each
}
// Total: 10s for 2 items
```

**Optimized:**
```typescript
// Single call for all items
await gptFilterBatch(allResults) // 5s total
// Total: 5s (save 5s)
```

---

#### 7. Reduce Image Resolution for Processing
**Current:** Full resolution images sent to Modal  
**Impact:** Saves 2-5 seconds  

**Implementation:**
```typescript
// In frontend before upload/crop
const maxWidth = 1920
const maxHeight = 1920
// Resize image client-side before sending
```

---

### Low (Minor Impact):

#### 8. Use CDN for Supabase Storage
**Current:** Direct Supabase URLs  
**Impact:** Saves 1-2 seconds on image loads  

#### 9. Compress Cropped Images
**Current:** PNG/JPEG at full quality  
**Impact:** Saves 1-2 seconds on uploads  

---

## 🎯 Recommended Optimization Priority

### Phase 1: Quick Wins (1-2 hours work)
1. ✅ **Parallelize Serper calls** → Save 40s
2. ✅ **Reduce to 2 Serper calls** → Save 20s
3. ✅ **Batch GPT-4o filtering** → Save 5s

**Total time saved:** ~65 seconds  
**New warm request time:** 67s → **~2s** (97% faster!)

### Phase 2: Infrastructure (Ongoing cost)
4. ✅ **Keep Modal warm** → Save 50-70s on cold starts
   - Cost: $10-20/month
   - Benefit: Every request feels "warm"

### Phase 3: Advanced (More work, testing needed)
5. ⚠️ **Cache Serper results** → Variable savings
6. ⚠️ **Try SAM-2 Tiny** → Save 5-10s (test accuracy first)

---

## 📈 Performance After Optimizations

### With Phase 1 Optimizations:
```
Upload:           2s
Crop (warm):     15s
Search (parallel): 10s  (was 40s) ✅
Filter (batch):   5s   (was 10s) ✅
─────────────────────
TOTAL:           32s  (was 67s - 52% faster!)
```

### With Phase 1 + Phase 2:
```
Upload:           2s
Crop (no cold):  15s  ✅
Search (parallel): 10s
Filter (batch):   5s
─────────────────────
TOTAL:           32s  (EVERY request, no 2-minute waits!)
```

---

## 🔴 Current Bottlenecks Summary

1. **Cold start (60-90s)** 🔴 CRITICAL
   - Solution: Keep Modal warm
   
2. **Sequential Serper calls (40s)** 🟡 MAJOR
   - Solution: Parallelize + reduce to 2 calls
   
3. **SAM-2 processing (10-15s)** 🟡 MODERATE
   - Solution: Use smaller model or optimize

4. **Everything else (<10s)** 🟢 ACCEPTABLE

---

## 💰 Cost vs Performance Trade-offs

| Optimization | Time Saved | Cost Increase | Effort |
|-------------|-----------|---------------|--------|
| Parallelize Serper | 40s | $0 | Low |
| Reduce Serper calls | 20s | $0 (saves money!) | Low |
| Keep Modal warm | 50-70s | $10-20/mo | Low |
| Cache results | 0-40s | $5-10/mo | Medium |
| Smaller models | 5-10s | $0 | Medium |

**Best ROI:** Parallelize Serper calls (free, huge impact, easy)

