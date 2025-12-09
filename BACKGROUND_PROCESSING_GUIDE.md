# 🚀 Background Processing & Notifications Guide

## 🎯 Problem Solved

**Before:** Users had to keep the tab open and active while searching (30-50+ seconds). If they switched to another app, the browser would throttle the JavaScript and the search would freeze.

**After:** Search processing happens entirely on the server. Users can switch tabs/apps and get a notification when results are ready!

---

## 🏗️ Architecture Overview

### Old System (Synchronous)
```
User clicks search
     ↓
Frontend sends ONE long request (40s)
     ↓ [If user switches tabs → FREEZES]
Results arrive
```

### New System (Job Queue + Polling)
```
User clicks search
     ↓
Frontend: "Start job" → Server: "Job ID: abc123" (100ms)
     ↓
Frontend polls every 1-5s: "Is abc123 done?"
Server processes in background: [||||||||||||] 
     ↓ [User can switch tabs - keeps working!]
Server: "Yes, here are results"
     ↓
🔔 Notification: "Your search is ready!"
```

---

## 📁 New Files Added

### 1. **`lib/jobQueue.ts`**
- In-memory job queue for background processing
- Stores job status, progress, and results
- Auto-cleanup after 1 hour

### 2. **`lib/searchJobClient.ts`**
- Client-side polling utility
- Page Visibility API integration
- Browser notification support
- Smart polling (fast when active, slow when hidden)

### 3. **`app/api/search-job/route.ts`**
- POST endpoint to create a new search job
- Returns job ID immediately
- Starts background processing

### 4. **`app/api/search-job/[id]/route.ts`**
- GET endpoint to check job status
- Returns progress, status, and results

---

## 🔄 How It Works

### Step-by-Step Flow

1. **User uploads image and selects items**
   - Frontend prepares search parameters

2. **Job Creation (100ms)**
   ```typescript
   POST /api/search-job
   → Returns: { jobId: "job_123", status: "processing" }
   ```

3. **Background Processing**
   - Server processes search on `/api/search` endpoint
   - Job progress updates every 3 seconds
   - Frontend polls for status

4. **Smart Polling**
   - **Tab visible:** Poll every 1.5 seconds
   - **Tab hidden:** Poll every 4 seconds (saves battery)
   - Page Visibility API detects tab state

5. **Completion**
   - Server marks job as "completed"
   - If tab is hidden → Browser notification appears
   - Results displayed to user

---

## 💻 Usage Example

### Frontend Code

```typescript
import { searchWithJobQueue } from '@/lib/searchJobClient'

// Start search with background processing
const { results, meta } = await searchWithJobQueue(
  {
    categories: ['dress', 'bag'],
    croppedImages: {
      'dress_1': 'https://...',
      'bag_1': 'https://...'
    },
    descriptions: {
      'dress_1': 'A red floral summer dress',
      'bag_1': 'Black leather handbag'
    },
    originalImageUrl: 'https://...',
    useOCRSearch: false
  },
  {
    // Callbacks
    onProgress: (progress) => {
      console.log(`Progress: ${progress}%`)
      setProgressBar(progress)
    },
    onComplete: (results, meta) => {
      console.log('Search complete!', results)
    },
    onError: (error) => {
      console.error('Search failed:', error)
    },
    
    // Configuration
    enableNotifications: true,  // Show notification when done
    fastPollInterval: 1500,     // Poll every 1.5s when active
    slowPollInterval: 4000      // Poll every 4s when hidden
  }
)
```

### API Usage

```bash
# 1. Create a job
curl -X POST http://localhost:3000/api/search-job \
  -H "Content-Type: application/json" \
  -d '{
    "categories": ["dress"],
    "croppedImages": { "dress_1": "https://..." },
    "originalImageUrl": "https://..."
  }'

# Response:
# { "jobId": "job_1234567890_abc123", "status": "processing" }

# 2. Check status (poll this endpoint)
curl http://localhost:3000/api/search-job/job_1234567890_abc123

# Response (processing):
# { "id": "job_123", "status": "processing", "progress": 45 }

# Response (completed):
# { 
#   "id": "job_123", 
#   "status": "completed", 
#   "progress": 100,
#   "results": { "dress": [...] },
#   "meta": { ... }
# }
```

---

## 🔔 Browser Notifications

### Permission Request

The system automatically requests notification permission:

```typescript
if (Notification.permission === 'default') {
  await Notification.requestPermission()
}
```

### Notification Trigger

- **Only shows** when tab is hidden
- **Auto-closes** after 10 seconds
- **Click to focus** brings user back to results

### Notification Content

```
Title: "✨ Your search is ready!"
Body: "Click to view your fashion search results"
```

---

## 🎛️ Smart Polling Behavior

### Page Visibility Detection

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Tab hidden - slow down polling
    pollInterval = 4000ms
  } else {
    // Tab visible - speed up polling
    pollInterval = 1500ms
  }
})
```

### Polling Frequency Table

| User Activity | Poll Interval | Reason |
|--------------|---------------|--------|
| Actively watching | 1.5 seconds | Smooth progress updates |
| Switched to another tab | 4 seconds | Battery efficient |
| Browser minimized | 4 seconds | System friendly |

---

## 🧪 Testing the Feature

### Test 1: Normal Flow (User Stays on Page)
1. Upload an image
2. Select items
3. Click search
4. **Watch the progress bar update smoothly**
5. See results when complete
6. **No notification** (user is watching)

### Test 2: Background Flow (User Switches Away)
1. Upload an image
2. Select items
3. Click search
4. **Immediately switch to another tab/app**
5. Wait 30-40 seconds
6. **Notification appears: "Your search is ready!"**
7. Click notification → Return to site with results

### Test 3: Mobile Safari
1. Start search on mobile Safari
2. Switch to Instagram/Messages
3. Get notification when complete
4. Tap notification → Back to your site

---

## 🔧 Configuration

### Environment Variables

No new environment variables needed! Uses existing:
- `NEXT_PUBLIC_APP_URL` - For internal API calls

### Polling Limits

```typescript
// Default settings in searchJobClient.ts
{
  fastPollInterval: 1500,    // 1.5 seconds when active
  slowPollInterval: 4000,    // 4 seconds when hidden
  maxAttempts: 200           // ~5 minutes max (200 * 1.5s)
}
```

### Job Expiry

```typescript
// Jobs auto-cleanup after 1 hour
const JOB_EXPIRY_MS = 60 * 60 * 1000
```

---

## 📊 Performance Comparison

### Before (Synchronous)
- ❌ Tab must stay active
- ❌ Browser throttles when backgrounded
- ❌ One 40-second blocking request
- ❌ No progress during throttle

### After (Job Queue)
- ✅ Works in background
- ✅ Never throttled (server-side)
- ✅ Many quick 50ms polling requests
- ✅ Smooth progress updates
- ✅ Browser notifications

---

## 🚨 Edge Cases Handled

### 1. Notification Permission Denied
- **Behavior:** Polling continues normally
- **Fallback:** User refreshes page and sees results

### 2. Browser Doesn't Support Notifications
- **Behavior:** Feature gracefully degrades
- **Fallback:** Polling-only mode

### 3. Job Not Found (Expired)
- **Behavior:** Returns 404 error
- **Fallback:** Frontend shows error message

### 4. Network Disconnection During Polling
- **Behavior:** Retries continue when connection restored
- **Fallback:** Max attempts prevents infinite retry

### 5. Server Restart (Job Lost)
- **Behavior:** In-memory jobs cleared
- **Future:** Consider Redis for persistence

---

## 🔮 Future Enhancements

### Production Improvements

1. **Redis Job Queue**
   ```typescript
   // Replace in-memory with Redis
   import Redis from 'ioredis'
   const redis = new Redis(process.env.REDIS_URL)
   ```

2. **WebSocket Support**
   ```typescript
   // Real-time updates instead of polling
   const ws = new WebSocket('wss://...')
   ws.onmessage = (event) => {
     const { progress } = JSON.parse(event.data)
     updateProgress(progress)
   }
   ```

3. **Push Notifications (PWA)**
   ```typescript
   // Service Worker for reliable notifications
   self.addEventListener('push', (event) => {
     self.registration.showNotification('Search Ready!')
   })
   ```

4. **Job History**
   - Store completed jobs in database
   - Allow users to view past searches

5. **Progress Streaming**
   - Server-Sent Events (SSE) for real-time updates
   - More granular progress tracking

---

## 🐛 Debugging

### Check Job Status

```bash
# View all logs
npm run dev | grep "Job"

# Expected output:
# ✅ Created job job_1234567890_abc123
# 📊 Job job_1234567890_abc123 progress: 25% (processing)
# 📊 Job job_1234567890_abc123 progress: 50% (processing)
# ✅ Job job_1234567890_abc123 completed
```

### Browser Console

```javascript
// Check notification permission
console.log(Notification.permission) // "granted" | "denied" | "default"

// Check page visibility
console.log(document.hidden) // true | false

// Manually request permission
await Notification.requestPermission()
```

### Common Issues

**Issue:** "Job not found" error
- **Cause:** Job expired (1 hour) or server restarted
- **Fix:** Start a new search

**Issue:** No notification appears
- **Cause:** Permission not granted
- **Fix:** Check browser settings → Notifications

**Issue:** Search seems slow
- **Cause:** Server is actually doing the work (normal)
- **Fix:** This is expected! But now works in background

---

## 📚 Technical Details

### Job Queue Implementation

```typescript
interface SearchJob {
  id: string                    // Unique job ID
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number              // 0-100
  createdAt: number             // Timestamp
  updatedAt: number             // Timestamp
  
  // Input
  categories: string[]
  croppedImages: Record<string, string>
  originalImageUrl?: string
  
  // Output
  results?: any
  error?: string
}
```

### Polling Algorithm

```typescript
while (attempts < maxAttempts) {
  const status = await checkJobStatus(jobId)
  
  if (status === 'completed') {
    if (document.hidden) showNotification()
    return results
  }
  
  const interval = document.hidden ? 4000 : 1500
  await sleep(interval)
  attempts++
}
```

---

## ✅ Benefits Summary

1. **✨ Background Processing**
   - Users can switch apps without freezing

2. **🔔 Smart Notifications**
   - Only when needed (tab hidden)

3. **⚡ Better UX**
   - Smooth progress updates
   - No blocking requests

4. **🔋 Battery Efficient**
   - Slower polling when backgrounded

5. **📱 Mobile Friendly**
   - Works across apps on iOS/Android

6. **🛡️ Robust**
   - Handles network issues
   - Graceful degradation

---

## 🎉 Ready to Use!

The system is fully implemented and ready to test. Just:

1. Start your dev server: `npm run dev`
2. Upload an image
3. Switch to another tab after clicking search
4. Wait for the notification! 🔔

---

**Questions?** Check the code comments in:
- `lib/jobQueue.ts` - Job queue logic
- `lib/searchJobClient.ts` - Client-side polling
- `app/api/search-job/` - API endpoints

