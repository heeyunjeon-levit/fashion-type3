# Search Job Issues - Diagnosis & Fixes

## Issues Identified

### 1. Missing Search Jobs (Only 1 of 2 Items Searched)
**Problem**: When user selects 2 items, only 1 search job is created
**Root Cause**: Items without valid `croppedImageUrl` are silently skipped during search

### 2. Function Timeout Errors
**Problem**: `FUNCTION_INVOCATION_TIMEOUT` errors during deployment/processing
**Root Cause**: Cron worker processes multiple jobs in parallel, exceeding 5-minute Vercel timeout

---

## Fixes Applied

### Fix 1: Enhanced Logging & Validation (app/page.tsx)

**Added comprehensive logging** to track each item through the search flow:

```typescript
// Before searching - log all items with their status
console.log(`📋 Items to search:`, items.map((item, idx) => ({
  idx: idx + 1,
  category: item.category,
  hasCroppedUrl: !!item.croppedImageUrl,
  croppedUrlType: item.croppedImageUrl?.startsWith('data:') ? 'data URL' : 'HTTP URL'
})))

// During search - track each job
console.log(`🔍 [ITEM ${idx + 1}/${totalItems}] Starting job for ${itemName}...`)

// After search - show completion stats
console.log(`📊 Search promises resolved: ${searchPromises.length} total`)
console.log(`📊 Non-null results: ${searchResults.filter(r => r !== null).length}`)
console.log(`📊 Null results: ${searchResults.filter(r => r === null).length}`)
```

**Added safety checks** to prevent silent failures:

```typescript
// Filter out items without cropped URLs and warn user
const validItems = items.filter(item => item.croppedImageUrl)
const skippedItems = items.filter(item => !item.croppedImageUrl)

if (skippedItems.length > 0) {
  console.error(`❌ SKIPPING ${skippedItems.length} item(s) without cropped URLs`)
  alert(`Warning: ${skippedItems.length} item(s) failed to upload and will be skipped.`)
}
```

### Fix 2: Sequential Job Processing (app/api/cron/process-jobs/route.ts)

**Changed from parallel to sequential** processing:

```typescript
// BEFORE: Process.allSettled (5 jobs in parallel = 10-15 min potential)
const results = await Promise.allSettled(
  pendingJobs.map(async (job) => { /* ... */ })
)

// AFTER: Sequential for loop (2 jobs × 2-3 min = safer)
for (const job of pendingJobs) {
  await processSearchJob(job.id, jobData)
}
```

**Reduced job batch size**:
- Was: 5 jobs per cron run
- Now: 2 jobs per cron run
- Rationale: Each job takes 2-3 minutes, so 2 jobs = 4-6 min (within 5 min limit)

**Added timeout protection**:

```typescript
const MAX_CRON_DURATION_MS = 280000 // 4 min 40 sec (20s safety buffer)

for (const job of pendingJobs) {
  const remainingMs = MAX_CRON_DURATION_MS - elapsedMs
  
  if (remainingMs < 30000) {
    console.warn(`⏰ Approaching timeout - stopping gracefully`)
    break // Stop processing, remaining jobs will be picked up next run
  }
  
  // Process job...
}
```

---

## Expected Behavior After Fixes

### When User Selects 2 Items:

1. **Item Processing Phase** (0-20% progress)
   - Both items cropped ✅
   - Both items described with Gemini ✅
   - Both items uploaded to Supabase ✅
   - Any upload failures now visible with alert

2. **Search Job Creation** (20% progress)
   - 2 separate jobs created in database ✅
   - Jobs have status "pending" ✅
   - Frontend starts polling both jobs

3. **Background Processing** (20-95% progress)
   - Cron worker picks up jobs (runs every minute)
   - Processes Job 1 (~2-3 minutes)
   - Processes Job 2 (~2-3 minutes)
   - If approaching timeout, stops gracefully

4. **Results Display** (100%)
   - Both items show results ✅
   - SMS sent with shareable link (if phone provided)

### Console Output Example:

```
🔍 Searching 2 items with background job queue...
📋 Items to search: [
  { idx: 1, category: 'sweater', hasCroppedUrl: true, croppedUrlType: 'HTTP URL' },
  { idx: 2, category: 'jeans', hasCroppedUrl: true, croppedUrlType: 'HTTP URL' }
]
✅ No items skipped - all items valid
🔍 [ITEM 1/2] Starting job for sweater...
   📞 Phone for search: +821012345678
   🔑 Search key: sweater_1
🚀 Created search job job_1765450009760_5z8rnbU
🔍 [ITEM 2/2] Starting job for jeans...
   📞 Phone for search: +821012345678
   🔑 Search key: jeans_1
🚀 Created search job job_1765450009823_7k2pmwX
✅ All searches complete
📊 Search promises resolved: 2 total
📊 Non-null results: 2
📊 Null results: 0
```

---

## Debugging Steps (If Issue Persists)

### If Still Only 1 Job Created:

1. **Check browser console** for:
   ```
   ❌ SKIPPING N item(s) without cropped URLs
   ```
   → This means upload failed for item N

2. **Check network tab** for failed requests:
   - `/api/upload-cropped` failures
   - CORS errors
   - Large payload errors

3. **Check item status** in logs:
   ```
   📋 Items to search: [...]
   ```
   → Look for `hasCroppedUrl: false`

### If Timeout Errors Persist:

1. **Check Vercel function logs** for:
   ```
   ⏰ Approaching timeout - stopping gracefully
   ```
   → Cron worker is running out of time (normal behavior)

2. **Check cron timing**:
   - Jobs process every minute
   - If you have many pending jobs, they queue up
   - Solution: Be patient, or increase cron frequency

3. **Check individual job duration**:
   - If a single job takes >3 minutes, investigate why
   - Check `/api/search` route for slow API calls
   - Check Gemini vision API response times

---

## Performance Improvements (Future)

1. **Optimize Gemini vision API calls** (currently 15 images × 2-4s each = 30-60s)
2. **Cache vision API results** for duplicate products
3. **Batch multiple items** into single search job (requires refactoring)
4. **Use Redis** for job queue (faster than Supabase polling)
5. **Increase cron frequency** to 30 seconds (requires Vercel Pro+)

---

## Testing Checklist

- [ ] Upload image with 2 detected items
- [ ] Verify both items get descriptions
- [ ] Verify both items have cropped URLs
- [ ] Verify 2 search jobs are created
- [ ] Verify both jobs complete (check Supabase `search_jobs` table)
- [ ] Verify both items show results
- [ ] Check for timeout errors in Vercel logs
- [ ] Test with 3+ items to ensure scalability


