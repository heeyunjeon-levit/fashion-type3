# 🧪 Testing Background Processing

## Quick Test Guide

### Test Scenario 1: User Stays on Page ✅

**Expected Behavior:** Smooth progress bar, no notification

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000

3. Upload a fashion image

4. Select items to search

5. Click search button

6. **Stay on the page** and watch

7. ✅ **You should see:**
   - Progress bar updating smoothly (1-5-10-25-50-75-90-100%)
   - Console logs showing job polling
   - Results appear when done
   - **NO notification** (you're watching!)

---

### Test Scenario 2: User Switches Away 🔔

**Expected Behavior:** Background processing + notification

1. Start search (same as above)

2. **Immediately after clicking search:**
   - Switch to another tab (YouTube, Gmail, etc.)
   - OR minimize the browser
   - OR switch to another app (on mobile)

3. Wait 30-40 seconds (do something else)

4. ✅ **You should see:**
   - Browser notification appears: "✨ Your search is ready!"
   - Click notification → Returns to your site
   - Results are already loaded!

---

### Test Scenario 3: Permission Prompt 🔔

**First-time users will see permission request**

1. Open site in **incognito/private window**

2. Start a search

3. You'll see: "Allow notifications from localhost?"

4. Click **Allow**

5. Switch to another tab

6. Wait for notification!

---

## 📱 Mobile Testing

### iOS Safari
1. Open site on iPhone
2. Start search
3. Swipe up to home screen
4. Open Instagram/Messages
5. Wait for notification banner
6. Tap notification → Back to site

### Android Chrome
1. Open site on Android
2. Start search
3. Press home button
4. Open another app
5. Wait for notification
6. Tap notification → Back to site

---

## 🔍 Console Monitoring

Open browser DevTools (F12) and watch for:

```
🚀 Starting search with job queue...
📋 Job created: job_1702345678_abc123
✅ Created job job_1702345678_abc123
⚙️ Processing job job_1702345678_abc123...
📊 Job job_1702345678_abc123 progress: 5% (processing)
📊 Job job_1702345678_abc123 progress: 10% (processing)
👁️ Page hidden - adjusting poll frequency
📊 Job job_1702345678_abc123 progress: 50% (processing)
✅ Job job_1702345678_abc123 completed
✅ Job complete for dress_1
```

---

## 🐛 Troubleshooting

### "No notification appears"

**Check 1:** Browser permission
```javascript
// In browser console:
Notification.permission
// Should return: "granted"
```

**Fix:** Visit browser settings → Notifications → Allow for localhost

**Check 2:** Are you on the page?
- Notifications only show when tab is **hidden**
- If you're watching the page, no notification needed!

---

### "Job not found" error

**Cause:** Job expired or server restarted

**Fix:** Just start a new search (jobs expire after 1 hour)

---

### "Search seems frozen"

**Check:** Open console and look for polling logs
- Should see status checks every 1-4 seconds
- If not polling, check network tab for errors

---

## 🎯 What to Look For

### ✅ Success Indicators

1. **Job creation is instant** (< 200ms)
2. **Progress bar updates** while processing
3. **Can switch tabs** without breaking
4. **Notification appears** when hidden
5. **Results load correctly**

### ❌ Problems to Report

1. Search hangs/freezes when switching tabs
2. No notification after waiting 1+ minute
3. Progress bar doesn't update
4. "Job not found" on first attempt
5. Results don't appear after notification

---

## 📊 Performance Check

### Expected Timings

| Action | Time |
|--------|------|
| Create job | < 200ms |
| Poll request | < 100ms |
| Full search | 30-50s |
| Total with polling | 30-50s (same!) |

### Network Activity

**Old system:**
- 1 long request (40s+)
- Blocked by browser throttling

**New system:**
- 1 short request (create job) - 100ms
- 20-30 quick polls (check status) - 50ms each
- Much more reliable!

---

## 🎬 Video Test (Record This!)

1. Start screen recording
2. Upload image + start search
3. Immediately switch to YouTube
4. Wait for notification (keep recording!)
5. Click notification
6. Show results loading instantly
7. 🎉 Perfect demo of the feature!

---

## 💡 Tips

### Notification Testing
- Use **incognito mode** to test permission prompt
- **Different browsers** behave differently (test Chrome + Safari)
- **Mobile is where this shines** - test on phone!

### Progress Testing
- Watch **Network tab** to see polling frequency
- Check **Console** for visibility change logs
- Monitor **Application → Background Services** (in DevTools)

### Battery Testing
- Check battery drain before/after (mobile)
- Polling should be minimal impact

---

## 🚀 Show It Off!

This feature is **impressive** to demonstrate:

1. "Watch this - I can switch tabs while searching"
2. *Switches to another app*
3. *Notification appears*
4. "See? The work happened in the background!"
5. *Click notification, results are ready*
6. 🤯 Mind = Blown

---

## Next Steps

After testing:
1. ✅ Confirm notifications work
2. ✅ Test on mobile devices
3. ✅ Check battery impact
4. 🚀 Deploy to production!

---

**Happy Testing!** 🎉

