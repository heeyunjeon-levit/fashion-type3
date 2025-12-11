# Debugging OCR Search - No Results Issue

## Current Situation

From your screenshot:
- ✅ OCR toggle is enabled (shows in console)
- ✅ Image uploaded successfully
- ✅ "OCR Mode: Skipping detection" message appears
- ❌ Returns 0 results
- ❌ No server-side logs visible in browser console

## Things to Check

### 1. Check Browser Console After Upload

After you upload with OCR enabled, look for this new log message:

```
📦 OCR Search Response: {
  success: true/false,
  mode: "ocr_v3.1",
  resultsCount: X,
  meta: {...}
}
```

**What to look for:**
- `mode`: Should be "ocr_v3.1" if OCR ran
- `success`: Should be true
- `resultsCount`: Should be > 0

### 2. Check Terminal Running `npm run dev`

The server-side logs will appear in the terminal where you ran `npm run dev`. Look for:

```
🎯 Using V3.1 OCR Search Pipeline...
   useOCRSearch flag: true
   originalImageUrl: https://...
   Backend URL from env: PYTHON_BACKEND_URL=http://localhost:8000
   Using: http://localhost:8000
   Calling: http://localhost:8000/ocr-search
```

### 3. Check Backend Logs

```bash
tail -f /Users/levit/Desktop/mvp/python_backend/backend.log
```

Should show:
```
POST /ocr-search
📝 Extracting OCR text...
```

## Quick Tests

### Test 1: Check if backend is responding

```bash
curl http://localhost:8000/health 2>&1
```

Expected: `{"status":"ok"}` or similar

### Test 2: Test OCR endpoint directly

```bash
curl -X POST http://localhost:8000/ocr-search \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"YOUR_IMAGE_URL_HERE"}' \
  --max-time 60
```

Expected: Should process for 30-50 seconds and return results

### Test 3: Check environment variables

```bash
# In terminal running npm run dev, press Ctrl+C to stop it, then:
cd /Users/levit/Desktop/mvp
cat .env | grep PYTHON_BACKEND_URL
npm run dev
```

## Most Likely Issues

### Issue 1: Environment Variable Not Loaded

**Symptom:** Terminal shows "PYTHON_BACKEND_URL=undefined"

**Fix:**
```bash
# Stop dev server (Ctrl+C)
# Verify .env has the variable
grep PYTHON_BACKEND_URL .env

# Should show:
# PYTHON_BACKEND_URL=http://localhost:8000

# If not there, add it:
echo 'PYTHON_BACKEND_URL=http://localhost:8000' >> .env

# Restart dev server
npm run dev
```

### Issue 2: Backend Not Running or Wrong Port

**Check:**
```bash
lsof -i :8000
```

**Fix if not running:**
```bash
cd python_backend
source venv/bin/activate
export $(grep -v '^#' ../.env | xargs)
uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload
```

### Issue 3: Request Not Reaching Backend

**Check browser Network tab:**
1. Open DevTools → Network tab
2. Upload image with OCR enabled
3. Look for request to `/api/search`
4. Check the request payload - should have `useOCRSearch: true`
5. Check the response - should have `meta.mode: "ocr_v3.1"`

### Issue 4: Backend Error

**Check backend logs:**
```bash
tail -50 /Users/levit/Desktop/mvp/python_backend/backend.log
```

Look for errors like:
- "GCLOUD_API_KEY not set"
- "SERPER_API_KEY not set"  
- "Connection refused"
- Any Python tracebacks

## Step-by-Step Debugging

1. **Refresh browser** (F5)
2. **Open DevTools** (F12)
3. **Go to Console tab**
4. **Enable OCR toggle** (should turn purple)
5. **Upload image**
6. **Watch for these messages in order:**
   ```
   🚀 OCR Mode: Skipping detection
   🔍 Starting V3.1 OCR Search with full image...
   📦 OCR Search Response: {...}  ← NEW! Check this
   ```

7. **Switch to Network tab**
8. **Find `/api/search` request**
9. **Check Response tab** - should see `meta.mode: "ocr_v3.1"`

10. **Check terminal running npm run dev**
11. **Should see server-side logs** with backend URL and OCR messages

## What I've Already Fixed

- ✅ Added `PYTHON_BACKEND_URL=http://localhost:8000` to .env
- ✅ Restarted backend with OCR endpoint and env vars
- ✅ Verified `/ocr-search` endpoint exists and responds
- ✅ Added fallback to localhost:8000 in code
- ✅ Added more detailed logging to debug the issue

## Next Steps

1. **Try uploading again** with OCR enabled
2. **Check browser console** for the new `📦 OCR Search Response` log
3. **Check terminal** running npm run dev for server logs
4. **Share the output** so we can see what's happening

## Quick Checklist

- [ ] OCR toggle is enabled (purple)
- [ ] Browser console shows "OCR Mode: Skipping detection"
- [ ] Browser console shows "📦 OCR Search Response"
- [ ] Terminal shows "🎯 Using V3.1 OCR Search Pipeline"
- [ ] Terminal shows "Calling: http://localhost:8000/ocr-search"
- [ ] Backend logs show "POST /ocr-search"
- [ ] Results appear (not 0 products)

---

**If you can share a screenshot of:**
1. Browser console (full output)
2. Terminal running npm run dev (recent logs)
3. Network tab showing /api/search request/response

**I can diagnose exactly what's wrong!**

