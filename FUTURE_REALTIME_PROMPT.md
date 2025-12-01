# 🔮 Future Prompt: Implement Real-Time OCR Status Updates

## When You're Ready

Copy and paste this prompt to your AI assistant:

---

## 📋 THE PROMPT:

```
I want to implement real-time status updates for the OCR search pipeline instead of 
the current time-based approach.

Current situation:
- OCR search uses fixed setTimeout intervals to simulate progress
- Frontend doesn't know actual backend status
- Located in: app/page.tsx (ocrStep state with setTimeout)

Requirements:
1. Backend should track OCR pipeline progress in real-time
2. Frontend should poll or use SSE to get actual status
3. Show these steps as they actually happen:
   - "extracting" - OCR text extraction with Google Vision
   - "mapping" - GPT-4 brand/product mapping  
   - "searching" - Visual + text search on platforms
   - "selecting" - GPT selecting best matches
4. Handle errors and show which step failed
5. Keep the existing Apple Intelligence-style loading animation

Backend files to modify:
- python_backend/api/server.py (add status tracking)
- python_backend/ocr_search_pipeline.py (emit status updates)

Frontend files to modify:
- app/page.tsx (replace setTimeout with polling)
- app/api/search/route.ts (add status endpoint proxy)

Please implement:
1. Backend async processing with status tracking
2. Status storage (in-memory is fine for MVP)
3. Status endpoint: GET /ocr-search/status/{request_id}
4. Frontend polling every 2 seconds
5. Cleanup old status entries after completion

Keep it simple - no Redis/database needed for now, just in-memory dictionary.
```

---

## 📝 Alternative Shorter Prompt:

If you want a quicker version:

```
Replace the time-based OCR progress (setTimeout in app/page.tsx) with real-time 
status updates from the backend. The backend should emit status as it progresses 
through: extracting → mapping → searching → selecting. Frontend should poll 
for updates. Keep the Apple Intelligence loading animation.
```

---

## 🎯 Specific Implementation Prompts:

### Option 1: Polling (Simplest)

```
Implement real-time OCR status using polling:

1. Backend: Add in-memory status tracker in server.py
2. Backend: Create GET /ocr-search/status/{id} endpoint
3. Backend: Update status in ocr_search_pipeline.py as it progresses
4. Frontend: Poll status every 2s in app/page.tsx
5. Frontend: Update ocrStep state based on actual backend status

No database/Redis needed - just a Python dictionary is fine.
```

### Option 2: Server-Sent Events (Better UX)

```
Implement real-time OCR status using Server-Sent Events (SSE):

1. Backend: Add streaming endpoint /ocr-search/stream
2. Backend: Yield status updates as JSON events
3. Frontend: Use EventSource to receive updates
4. Frontend: Update ocrStep state from event stream

This avoids polling and provides instant updates.
```

### Option 3: WebSocket (Most Advanced)

```
Implement real-time OCR status using WebSocket:

1. Backend: Add WebSocket endpoint with FastAPI
2. Backend: Send status messages over WebSocket
3. Frontend: Connect WebSocket and listen for messages
4. Frontend: Update ocrStep based on messages
5. Handle reconnection and errors gracefully
```

---

## 📂 Files You'll Need to Share

When you give the prompt, make sure to mention or provide access to:

1. **Current Implementation:**
   - `app/page.tsx` - Lines 35-40 (ocrStep state and setTimeout)
   - `app/page.tsx` - Lines 549-605 (loading UI)

2. **Backend Files:**
   - `python_backend/api/server.py` - OCR search endpoint
   - `python_backend/ocr_search_pipeline.py` - Pipeline that needs status updates

3. **API Route:**
   - `app/api/search/route.ts` - Might need status proxy endpoint

---

## 🎨 Expected Outcome

After implementing, you'll have:

### Backend:
```python
# Status tracker
ocr_status = {}

# Update status as pipeline runs
def update_status(request_id, step, message):
    ocr_status[request_id] = {
        'step': step,
        'message': message,
        'timestamp': time.time()
    }

# In pipeline
update_status(req_id, 'extracting', 'Running Google Vision OCR...')
# ... OCR code ...
update_status(req_id, 'mapping', 'Identifying brands with GPT-4...')
# ... mapping code ...
```

### Frontend:
```typescript
// Poll for status
const pollStatus = async (requestId: string) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/ocr-status/${requestId}`)
    const { step } = await response.json()
    setOcrStep(step) // Real-time update!
    
    if (step === 'complete') {
      clearInterval(interval)
    }
  }, 2000)
}
```

---

## ⚡ Quick Reference: Implementation Approaches

| Approach | Complexity | Real-Time | Best For |
|----------|-----------|-----------|----------|
| **Polling** | Low | ~2s delay | MVP, simple |
| **SSE** | Medium | Instant | Production |
| **WebSocket** | High | Instant | Advanced features |

**Recommendation:** Start with polling, upgrade to SSE later if needed.

---

## 🔧 Debugging Tips to Include

When you implement, ask for:

```
Also add:
1. Logging so I can see status updates in backend console
2. Error handling if polling fails
3. Timeout if OCR takes too long (>5 minutes)
4. Cleanup of old status entries (older than 10 minutes)
5. Loading state while waiting for first status update
```

---

## 💡 What NOT to Ask For

Avoid these complications for first version:

- ❌ Database/Redis storage (in-memory is fine)
- ❌ Authentication (not needed for now)
- ❌ Retry logic (keep it simple)
- ❌ Progress percentages (just steps is enough)
- ❌ Multiple simultaneous requests (one at a time is fine)

---

## ✅ Checklist Before Asking

Make sure you have:
- [ ] Confirmed current time-based approach isn't good enough
- [ ] Decided which approach (polling/SSE/WebSocket)
- [ ] Know which files need changes
- [ ] Ready to test the implementation
- [ ] Backend is running and accessible

---

## 🎯 The Simplest Possible Prompt

If you just want me to do it:

```
Make the OCR loading steps real-time instead of time-based. Use polling.
```

That's it! I'll figure out the rest. 😊

---

## 📚 Context to Provide

To get the best implementation, share:

1. **Your Priority:**
   - "I want the simplest solution that works"
   - OR "I want the best UX even if complex"

2. **Your Timeline:**
   - "Quick implementation for demo tomorrow"
   - OR "Proper implementation for production"

3. **Your Constraints:**
   - "Keep backend simple, no new dependencies"
   - OR "I'm okay with adding new packages"

---

## 🚀 Ready-to-Use Prompt Template

```
I want to upgrade the OCR loading animation to show real-time progress.

Current: Uses setTimeout with fixed intervals (app/page.tsx lines 35-40)
Goal: Show actual backend progress as it happens

Approach: [polling / SSE / WebSocket - pick one]
Priority: [simplicity / UX / production-ready - pick one]

Files to modify:
- python_backend/api/server.py
- python_backend/ocr_search_pipeline.py  
- app/page.tsx
- app/api/search/route.ts (if needed)

Keep the Apple Intelligence gradient animation!

Requirements:
- Track these steps: extracting → mapping → searching → selecting
- Update UI as each step actually completes
- Handle errors gracefully
- Clean up old status entries

Please implement and let me know what to test.
```

---

**Just copy the template, fill in your preferences, and paste it!** 🎯

