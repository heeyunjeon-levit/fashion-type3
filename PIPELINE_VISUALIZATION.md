# Fashion Search MVP - Pipeline Visualization

## 📊 Current Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER UPLOADS IMAGE                          │
│                     (Fashion photo with clothing)                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: IMAGE UPLOAD                                              │
│  ────────────────────────                                           │
│  Location: Next.js Frontend → Supabase Storage                      │
│  File: app/api/upload/route.ts                                      │
│                                                                      │
│  [User Browser] ──(upload)──> [Next.js] ──(store)──> [Supabase]    │
│                                                                      │
│  Time: 2 seconds                                                    │
│  ████                                                                │
│                                                                      │
│  Output: https://supabase.co/.../image.jpg                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2: IMAGE CROPPING (Modal Backend)                            │
│  ────────────────────────────────────────                           │
│  Location: Modal (Python ML Backend)                                │
│  Files: python_backend/crop_api.py, custom_item_cropper.py          │
│                                                                      │
│  🔴 COLD START (First request): 75 seconds                          │
│  ███████████████████████████████████████████████████████████        │
│                                                                      │
│  Sub-steps:                                                          │
│  ┌─────────────────────────────────────────────────┐               │
│  │ 1. Load Models (COLD START ONLY)   50-70s       │               │
│  │    • GroundingDINO (500MB)                      │               │
│  │    • SAM-2 (800MB)                              │               │
│  │    ██████████████████████████████████████       │               │
│  └─────────────────────────────────────────────────┘               │
│  ┌─────────────────────────────────────────────────┐               │
│  │ 2. GPT-4o Analysis                  3-5s         │               │
│  │    • Analyze image                              │               │
│  │    • Generate detection prompts                 │               │
│  │    ████                                         │               │
│  └─────────────────────────────────────────────────┘               │
│  ┌─────────────────────────────────────────────────┐               │
│  │ 3. GroundingDINO Detection          2-5s         │               │
│  │    • Detect clothing items                      │               │
│  │    • Generate bounding boxes                    │               │
│  │    ████                                         │               │
│  └─────────────────────────────────────────────────┘               │
│  ┌─────────────────────────────────────────────────┐               │
│  │ 4. SAM-2 Segmentation              5-10s/item   │               │
│  │    • Segment each item (×2 items)               │               │
│  │    • Generate masks & crop                      │               │
│  │    ██████████                                   │               │
│  └─────────────────────────────────────────────────┘               │
│  ┌─────────────────────────────────────────────────┐               │
│  │ 5. Upload Crops to Supabase         2s/item     │               │
│  │    ████                                         │               │
│  └─────────────────────────────────────────────────┘               │
│                                                                      │
│  🟢 WARM REQUEST: 15 seconds                                        │
│  ███████████████                                                     │
│  (Steps 2-5 only, skip model loading)                               │
│                                                                      │
│  Output: 2 cropped image URLs                                       │
│  • https://supabase.co/.../crop_1.jpg                               │
│  • https://supabase.co/.../crop_2.jpg                               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 3: PRODUCT SEARCH (Per Cropped Image)                        │
│  ────────────────────────────────────────────────                   │
│  Location: Next.js API Route                                        │
│  File: app/api/search/route.ts                                      │
│                                                                      │
│  🔴 FOR EACH CROPPED IMAGE (×2 items = 40s total)                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Cropped Image #1 (Top)                                  │      │
│  │                                                           │      │
│  │  Step 1: Serper API Call #1         10s                  │      │
│  │  [Next.js] ──> [Serper/Google Lens] ──> [Results 1]     │      │
│  │  ██████████                                              │      │
│  │      ↓                                                    │      │
│  │  Step 2: Serper API Call #2         10s                  │      │
│  │  [Next.js] ──> [Serper/Google Lens] ──> [Results 2]     │      │
│  │  ██████████                                              │      │
│  │      ↓                                                    │      │
│  │  Step 3: Serper API Call #3         10s                  │      │
│  │  [Next.js] ──> [Serper/Google Lens] ──> [Results 3]     │      │
│  │  ██████████                                              │      │
│  │                                                           │      │
│  │  ⚠️ SEQUENTIAL - Each waits for previous                │      │
│  │  Total: 30 seconds for 1 item                            │      │
│  │  ██████████████████████████████                          │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Cropped Image #2 (Top)                                  │      │
│  │                                                           │      │
│  │  Same 3 sequential Serper calls                          │      │
│  │  ██████████████████████████████                          │      │
│  │                                                           │      │
│  │  Total: 30 seconds for 1 item                            │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
│  Aggregated Results: ~180 product links (many duplicates)           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 4: RESULT FILTERING (Per Cropped Image)                      │
│  ────────────────────────────────────────────                       │
│  Location: Next.js API Route                                        │
│  File: app/api/search/route.ts                                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  For Cropped Image #1                                    │      │
│  │                                                           │      │
│  │  GPT-4o API Call                    5s                    │      │
│  │  • Input: 90 Serper results                              │      │
│  │  • Task: Extract top 3 valid links                       │      │
│  │  • Output: 3 product URLs + thumbnails + titles          │      │
│  │  █████                                                    │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  For Cropped Image #2                                    │      │
│  │                                                           │      │
│  │  GPT-4o API Call                    5s                    │      │
│  │  █████                                                    │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
│  Total: 10 seconds                                                  │
│  ██████████                                                          │
│                                                                      │
│  Final Output (per item):                                           │
│  • Product 1: URL + thumbnail + title                               │
│  • Product 2: URL + thumbnail + title                               │
│  • Product 3: URL + thumbnail + title                               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 5: DISPLAY RESULTS                                           │
│  ─────────────────────────                                          │
│  Location: Next.js Frontend                                         │
│  File: app/page.tsx, app/components/                                │
│                                                                      │
│  Render product cards with images and links                         │
│  Time: <1 second                                                    │
│  █                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ⏱️ Total Pipeline Time

### Cold Start (First Request)
```
┌─────────────────────────────────────────────────────────────────┐
│                    TOTAL TIME: 127 SECONDS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: Upload              2s    ████                        │
│  Phase 2: Crop (COLD)        75s    ███████████████████████████ │
│  Phase 3: Search (2 items)   40s    ████████████████████        │
│  Phase 4: Filter (2 items)   10s    ██████                      │
│  Phase 5: Display            <1s    █                           │
│                                                                 │
│  🔴 Bottleneck: Modal Cold Start (75s = 59% of total time)     │
└─────────────────────────────────────────────────────────────────┘
```

### Warm Request (Within 10 Minutes)
```
┌─────────────────────────────────────────────────────────────────┐
│                     TOTAL TIME: 67 SECONDS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: Upload              2s    ███                         │
│  Phase 2: Crop (WARM)        15s    ██████████████             │
│  Phase 3: Search (2 items)   40s    ████████████████████████   │
│  Phase 4: Filter (2 items)   10s    ████████                   │
│  Phase 5: Display            <1s    █                           │
│                                                                 │
│  🔴 Bottleneck: Sequential Serper Calls (40s = 60% of time)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Detailed Phase 3 Breakdown (Serper Calls)

**Current Implementation (SEQUENTIAL):**

```
Time ────────────────────────────────────────────────────────────>

Item 1:
│ Call 1 ││ Call 2 ││ Call 3 │
│  10s   ││  10s   ││  10s   │ = 30s
└────────┴─────────┴─────────┘

Item 2:
                              │ Call 1 ││ Call 2 ││ Call 3 │
                              │  10s   ││  10s   ││  10s   │ = 30s
                              └────────┴─────────┴─────────┘

TOTAL: 60 seconds (all sequential)
```

**Optimized Implementation (PARALLEL):**

```
Time ────────────────────────────────────────────────────────────>

Item 1:
│ Call 1 │
│ Call 2 │  All 3 calls happen
│ Call 3 │  at the same time!
│  10s   │ = 10s
└────────┘

Item 2:
          │ Call 1 │
          │ Call 2 │  All 3 calls happen
          │ Call 3 │  at the same time!
          │  10s   │ = 10s
          └────────┘

TOTAL: 20 seconds (parallelized within each item)
```

**Savings: 40 seconds! (67% faster)**

---

## 📊 Bottleneck Analysis

### Time Distribution (Warm Request)

```
                 Current Pipeline (67s)
    ┌────────────────────────────────────────┐
    │                                        │
  2s│██                                      │ Upload
 15s│████████████                            │ Crop
 40s│███████████████████████████             │ Search 🔴 BOTTLENECK
 10s│███████                                 │ Filter
    │                                        │
    └────────────────────────────────────────┘
     0s      20s     40s     60s     80s
```

### After Parallelization (32s)

```
              Optimized Pipeline (32s)
    ┌────────────────────────────────────────┐
    │                                        │
  2s│████                                    │ Upload
 15s│███████████████████████████             │ Crop
 10s│███████████████                         │ Search ✅ FIXED
  5s│████████                                │ Filter
    │                                        │
    └────────────────────────────────────────┘
     0s      20s     40s     60s     80s

    52% FASTER! 🚀
```

---

## 🔄 Request Flow Diagram

```
┌─────────┐
│  USER   │
└────┬────┘
     │ 1. Upload Image
     ▼
┌─────────────┐
│   Vercel    │
│  (Next.js)  │
└──┬──────┬───┘
   │      │
   │      │ 2. Crop Request
   │      ▼
   │   ┌──────────┐        ┌─────────────┐
   │   │  Modal   │◄──────►│  Supabase   │
   │   │(Python)  │        │  (Storage)  │
   │   └────┬─────┘        └─────────────┘
   │        │
   │        │ 2a. GPT-4o Analysis
   │        ▼
   │   ┌──────────┐
   │   │  OpenAI  │
   │   │  GPT-4o  │
   │   └────┬─────┘
   │        │
   │        │ Returns: Cropped Images
   │        ▼
   │   Back to Next.js
   │
   │ 3. Search Each Crop
   ▼
┌──────────────┐
│  Serper API  │◄─── 3 calls per item (sequential)
│ Google Lens  │
└──────┬───────┘
       │
       │ Returns: Product results
       ▼
┌──────────────┐
│  OpenAI      │◄─── 4. Filter results
│  GPT-4o      │
└──────┬───────┘
       │
       │ Returns: Top 3 products per item
       ▼
┌──────────────┐
│    USER      │
│  (Results)   │
└──────────────┘
```

---

## 💡 Key Insights

### 1. Modal Cold Start = Single Biggest Issue
- **59% of total time** on first request
- Only happens after 5-10 min idle
- Fix: Keep warm ($10-20/mo) or ping regularly

### 2. Sequential Serper Calls = Biggest Opportunity
- **60% of warm request time**
- Easy to parallelize (30 min work)
- **FREE** optimization with huge impact

### 3. Multiple GPT Calls = Easy Win
- Currently 2 separate calls (one per item)
- Can batch into 1 call
- Save 5 seconds with minimal effort

### 4. Everything Else is Fast
- Upload: 2s ✅
- Detection: 2s ✅
- Individual operations optimized

---

## 🎯 Priority Fixes

```
┌─────────────────────────────────────────────────────┐
│ 1. Parallelize Serper (30 min)    🔥 DO THIS FIRST  │
│    Save: 20-30s per item                            │
│    Cost: FREE                                       │
│    Difficulty: EASY                                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 2. Reduce to 2 Serper calls (5 min)  🔥 QUICK WIN   │
│    Save: 10s per item                               │
│    Cost: FREE (saves money!)                        │
│    Difficulty: TRIVIAL                              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 3. Batch GPT filtering (25 min)      💎 NICE WIN    │
│    Save: 5s total                                   │
│    Cost: FREE (saves money!)                        │
│    Difficulty: MEDIUM                               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 4. Keep Modal warm (10 min)          💰 OPTIONAL    │
│    Save: 50-70s on cold starts                      │
│    Cost: $10-20/month                               │
│    Difficulty: EASY                                 │
└─────────────────────────────────────────────────────┘
```

---

## 📈 Before vs After

```
                BEFORE                          AFTER
        ┌──────────────────┐          ┌──────────────────┐
Cold    │   127 seconds    │   →      │   32 seconds     │
Start   │   (2+ minutes)   │          │   (Half minute)  │
        └──────────────────┘          └──────────────────┘
              75% FASTER! 🚀

        ┌──────────────────┐          ┌──────────────────┐
Warm    │   67 seconds     │   →      │   32 seconds     │
Request │   (1+ minute)    │          │   (Half minute)  │
        └──────────────────┘          └──────────────────┘
              52% FASTER! 🚀
```

---

Ready to implement these optimizations? Let me know which one you want to tackle first! 🚀

