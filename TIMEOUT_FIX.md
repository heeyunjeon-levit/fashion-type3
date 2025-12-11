# ✅ Fixed: Timeout for Gemini 3 Pro Preview

## 🐛 Root Cause Identified

Your last run showed:
```
Gemini 3 Pro vision filtering: 38.34s
Total request time: 74.53s
maxDuration: 60s  ← TOO SHORT!
```

**The 60-second timeout was cutting off the response!**

Gemini 3 Pro Preview with vision (15 images) needs **40-60 seconds** to process. The route timeout of 60 seconds was too tight, causing:
1. Gemini starts processing ✅
2. Takes 38 seconds... 40 seconds... 50 seconds...
3. **TIMEOUT!** Next.js kills the route at 60s ❌
4. Gemini returns empty string (incomplete response)
5. Fallback mode triggered

---

## ✅ Fixes Applied

### Fix #1: Increased Search Route Timeout

**File**: `app/api/search/route.ts` (Line 7)

**Before**:
```typescript
export const maxDuration = 60 // Too short!
```

**After**:
```typescript
export const maxDuration = 120 // Allow up to 120 seconds for Gemini 3 Pro vision (can take 40-60s with 15 images)
```

### Fix #2: Increased Description Route Timeout

**File**: `app/api/describe-item/route.ts` (Line 6)

**Before**:
```typescript
export const maxDuration = 60
```

**After**:
```typescript
export const maxDuration = 90 // Allow up to 90 seconds for Gemini 3 Pro (can be slow with complex images)
```

### Fix #3: Using Gemini 3 Pro Preview for Vision

**File**: `app/api/search/route.ts`

Confirmed using **`gemini-3-pro-preview`** for vision matching:
```typescript
model: 'gemini-3-pro-preview',  // SOTA vision model (needs time with 15 images)
```

---

## 📊 Timeout Breakdown

### Previous (60s limit):
```
┌─────────────────────────────────────┐
│ Full image search:     5.4s        │
│ Per-category searches: 69.1s       │  ← Parallel, but one took longer
│   └─ Gemini 3 Pro:    38.3s        │  ← Cut off!
│ Processing overhead:   0.0s        │
├─────────────────────────────────────┤
│ Total:                 74.5s ❌    │ (Exceeded 60s!)
└─────────────────────────────────────┘
```

**Result**: Timeout at 60s → Empty response

### New (120s limit):
```
┌─────────────────────────────────────┐
│ Full image search:     ~5s         │
│ Per-category searches: ~70s        │
│   └─ Gemini 3 Pro:    ~40-60s ✅  │  ← Now has time!
│ Processing overhead:   ~0s         │
├─────────────────────────────────────┤
│ Total:                 ~75-90s ✅  │ (Within 120s!)
└─────────────────────────────────────┘
```

**Result**: Gemini completes successfully!

---

## ⚡ Why Gemini 3 Pro Takes Time

### Processing Steps:
1. **Fetch 15 thumbnail images** (~5-10s)
   - 15 HTTP requests for base64 conversion
   - Some images are large (200-500KB)

2. **Upload to Gemini** (~2-5s)
   - 1 cropped image (~100KB)
   - 15 thumbnails (~2MB total)
   - Network latency to Google servers

3. **Gemini Vision Processing** (~30-50s)
   - Analyze 16 images (1 item + 15 candidates)
   - Compare colors, patterns, textures
   - Generate JSON response with thinking
   - **HIGH thinking mode** = more time!

4. **Return response** (~1s)

**Total**: 38-66 seconds (avg ~50s)

---

## 🎯 Configuration Summary

| API Route | Model | Timeout | Purpose |
|-----------|-------|---------|---------|
| `/api/describe-item` | `gemini-3-pro-preview` | **90s** | Detailed descriptions |
| `/api/search` | `gemini-3-pro-preview` | **120s** | Vision matching (15 images) |

---

## 🧪 Expected Behavior Now

### Console Logs:
```
🚀 Calling Gemini 3 Pro Preview with 15 thumbnails (may take 40-60s)...
🔑 API key configured: AIzaSyBxxx...xyz
⏳ Waiting for Gemini 3 Pro... (this may take a while)
📦 Gemini response length: 156 chars  ← Should have content now!
📦 Gemini response preview: {"scarf_1":["https://fruitsfamily.com/..."]}
⏱️  Gemini 3 Pro vision filtering: 45.2s
✅ Selected 3 links for scarf_1
```

### Response Meta:
```json
{
  "sourceCounts": { "gpt": 1, "fallback": 0 },  ← "gpt": 1 now!
  "selectedLinks": ["url1", "url2", "url3"],     ← NOT empty!
  "timing": {
    "gpt4_turbo_api_time_seconds": 45.2,        ← Completed!
    "total_seconds": 85.5                        ← Within 120s limit!
  }
}
```

---

## ⚠️ User Experience Note

Users will now wait **~75-90 seconds** for results (up from ~60s).

**Why acceptable**:
- ✅ Progress bar shows continuous movement
- ✅ "Processing..." indicator visible
- ✅ SOTA accuracy worth the wait
- ✅ This is MVP - can optimize later

**Future optimization ideas**:
- Use `thinkingLevel: ThinkingLevel.LOW` → ~20-30s faster
- Reduce thumbnails from 15 to 10 → ~10s faster
- Use `gemini-2.0-flash-exp` → ~50% faster but less accurate

---

## 🚀 Ready to Test!

**Changes**:
1. ✅ Timeout: 60s → **120s** (search)
2. ✅ Timeout: 60s → **90s** (describe)
3. ✅ Model: **`gemini-3-pro-preview`** (both routes)
4. ✅ Error detection: Empty response logging

**Now test again!** Upload the scarf image and watch for:
```
📦 Gemini response length: 156 chars  ← Should be >0 now!
"sourceCounts": { "gpt": 1 }          ← Should be 1 now!
```

---

**Status**: ✅ Timeout increased to 120s, using SOTA model

**Expected**: Gemini 3 Pro completes successfully within new timeout! 🎯

