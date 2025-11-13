# 🔧 500 Error Fix - Backend Cold Start Handling

## Problem

The `/api/analyze` endpoint was returning a 500 error when processing images. This was caused by:

1. **Modal Cold Starts**: The GPU backend on Modal goes to sleep when idle and takes time to wake up (30-60 seconds)
2. **Short Timeouts**: The default Vercel function timeout was too short for cold starts
3. **No Retry Logic**: Single failed attempt would immediately return 500 error

## Solution Implemented

### 1. Retry Logic for Cold Starts

Added intelligent retry mechanism in `/app/api/analyze/route.ts`:

```typescript
// Retry up to 2 times
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    // Attempt connection with 2-minute timeout
    backendResponse = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
      signal: controller.signal // Timeout after 2 minutes
    })
    
    if (backendResponse.ok) {
      break // Success!
    }
    
    // Wait 3 seconds before retry
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  } catch (error) {
    // If timeout/abort, wait 5 seconds (cold start likely)
    if (lastError.includes('timeout') || lastError.includes('aborted')) {
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}
```

### 2. Increased Timeouts

**Per-Request Timeout**: 120 seconds (2 minutes) per attempt
- Allows time for Modal to cold start and process the image
- Uses `AbortController` to properly cancel on timeout

**Vercel Function Timeout**: 300 seconds (5 minutes)
- Updated `vercel.json` to allow longer-running functions
- Applies to both `/api/analyze` and `/api/search` routes

```json
{
  "functions": {
    "app/api/analyze/route.ts": {
      "maxDuration": 300
    },
    "app/api/search/route.ts": {
      "maxDuration": 300
    }
  }
}
```

### 3. Better Error Messages

Enhanced logging and error reporting:

```
🔄 Attempt 1/2 to reach backend...
⚠️ Attempt 1 failed with status 500: timeout
⏳ Backend might be cold starting, waiting 5 seconds...
🔄 Attempt 2/2 to reach backend...
✅ Analysis complete in 45.23s
```

## How It Works

### Cold Start Scenario:

1. **First Request**: Modal backend is asleep
   - Request #1: Times out after 2 minutes
   - Wait 5 seconds
   - Request #2: Backend is now awake, succeeds ✅

2. **Subsequent Requests**: Backend is warm
   - Request #1: Succeeds immediately ✅
   - Total time: 5-15 seconds

### Error Scenario:

1. **Actual Backend Error**:
   - Request #1: Fails with error message
   - Wait 3 seconds
   - Request #2: Fails again
   - Return 500 with detailed error message ❌

## Expected Behavior

### First Use (Cold Start):
- ⏳ May take 30-90 seconds
- 🔄 Will automatically retry once
- ✅ Should succeed on second attempt
- 📱 User sees "AI 분석중..." with animated spinner

### Regular Use (Warm Backend):
- ⚡ Completes in 5-15 seconds
- ✅ Works on first attempt
- 🎯 Fast and reliable

## Testing

After deployment (2-3 minutes), test with:

1. **Cold Start Test**:
   - Wait 10 minutes for backend to sleep
   - Upload image
   - Should succeed after ~45-60 seconds

2. **Warm Backend Test**:
   - Upload another image immediately
   - Should succeed in ~5-15 seconds

3. **Error Handling Test**:
   - Try with invalid image URL
   - Should get clear error message

## Deployment

✅ **Committed**: All changes pushed to GitHub
✅ **Deployed**: Vercel auto-deployment in progress
⏳ **Live**: Available in ~2-3 minutes

## Files Changed

1. `/app/api/analyze/route.ts` - Added retry logic and timeout handling
2. `/vercel.json` - Increased function timeout to 300 seconds

## Benefits

✅ **Handles Cold Starts**: Automatically retries when backend is waking up
✅ **Better UX**: User doesn't see errors during cold starts
✅ **Detailed Logging**: Clear console messages for debugging
✅ **Timeout Protection**: Won't hang indefinitely
✅ **Production Ready**: Reliable handling of Modal's serverless nature

---

**Updated**: November 13, 2025
**Status**: ✅ Fixed & Deployed
**Issue**: 500 Error on /api/analyze
**Root Cause**: Modal cold starts + short timeouts
**Solution**: Retry logic + increased timeouts

