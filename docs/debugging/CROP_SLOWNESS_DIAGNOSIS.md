# 🐌 Crop Slowness Diagnosis

## Current Situation

**Expected:** With bbox mode, crops should be ~10-15s (warm) or ~40s (cold start)  
**Actual:** Still taking too long according to user

---

## 🔍 Likely Causes

### 1. Cold Start (Most Likely) 🔴

**Problem:** Modal container was idle and shut down

**Symptoms:**
- First request takes 60-90+ seconds
- Subsequent requests are faster
- Container needs to reload models

**Why it happens:**
- Modal shuts down after ~10 minutes of inactivity
- Even with volume caching, still takes time to:
  - Spin up container: 20-30s
  - Mount volume: 5s
  - Load GroundingDINO: 15-20s
  - Initialize: 5-10s

**Solution:**
- GitHub Actions should ping every 5 minutes (already deployed)
- But needs time to establish pattern
- First few requests after deployment will be slow

---

### 2. SAM-2 Still Running? ⚠️

**Problem:** Environment variable not set correctly in Modal

**Check:**
```python
# In crop_api.py line 73:
use_sam2 = os.getenv("USE_SAM2", "false").lower() == "true"
```

**Default is "false"** but Modal needs to respect this.

**Symptoms:**
- Taking 60+ seconds consistently
- Even warm requests are slow

**How to verify:**
- Check Modal dashboard logs
- Should see: "⚡ Skipping SAM-2..."
- Should NOT see: "🔄 Loading SAM-2 model..."

---

### 3. GitHub Actions Not Running Yet ⏰

**Problem:** Keep-warm ping not active

**Check:**
```bash
# Go to: https://github.com/heeyunjeon-levit/fashion-type3/actions
# Look for: "Keep Modal Backend Warm"
# Status: Should run every 5 minutes
```

**If not running:**
- First cron job might not have triggered yet
- Takes 5-15 minutes after deployment
- Until then, every request hits cold start

---

### 4. Multiple Detections Taking Time 📊

**Problem:** Finding multiple items takes longer

**Timeline:**
- 1 item: ~40s cold / ~10s warm
- 2 items: ~60s cold / ~15s warm  
- 3+ items: ~80s+ cold / ~20s+ warm

**Why:**
- Each item needs separate GroundingDINO call
- GPT-4o describes each item
- Processing is sequential (not parallelized yet)

---

## 🎯 Diagnostic Steps

### Step 1: Check Current Mode

Run a quick test to see the timing breakdown:

```bash
cd /Users/levit/Desktop/mvp
node test_full_pipeline_timing.js
```

Look for:
- Crop time
- Any "Loading SAM-2" messages
- Cold start indicators

---

### Step 2: Check Modal Logs

Try to see recent logs (if available):

1. Go to: https://modal.com/apps/heeyunjeon-levit/main/deployed/fashion-crop-api
2. Click on recent function calls
3. Look for timing messages:
   - "⚡ Skipping SAM-2..." = Good (bbox mode)
   - "🔄 Loading SAM-2..." = Bad (SAM-2 still running)

---

### Step 3: Check GitHub Actions

1. Go to: https://github.com/heeyunjeon-levit/fashion-type3/actions
2. Look for "Keep Modal Backend Warm"
3. Check if it's running every 5 minutes

**If not running:**
- Manual trigger: Go to Actions → Keep Modal Backend Warm → Run workflow
- This will start the keep-warm cycle

---

## 💡 Quick Fixes

### Fix 1: Manually Warm Up the Backend

```bash
# Ping the backend 3 times to warm it up
for i in {1..3}; do 
  echo "Ping $i..."
  curl -s https://heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run/
  sleep 2
done
```

Then test again - should be faster!

---

### Fix 2: Verify USE_SAM2 is False

Check Modal secrets/environment:
1. Go to Modal dashboard
2. Check if USE_SAM2 is set
3. Should be "false" or not set (defaults to false)

---

### Fix 3: Force GitHub Actions to Run

```bash
# Manual trigger via GitHub CLI (if you have it)
gh workflow run keep-modal-warm.yml

# Or go to GitHub.com:
# Actions → Keep Modal Backend Warm → Run workflow
```

---

## 📊 Expected Timings

### Cold Start (First Request):
```
WITH SAM-2:     ~90s
WITHOUT SAM-2:  ~40-50s  ← Current mode
```

### Warm (Subsequent Requests):
```
WITH SAM-2:     ~20-25s
WITHOUT SAM-2:  ~10-15s  ← What you should get after warm-up
```

---

## 🎯 What to Tell Me

To help diagnose further, please share:

1. **How long is it taking?**
   - Exact seconds if possible
   - First request or subsequent?

2. **How many items?**
   - Selecting 1 category or multiple?
   - How many counts per category?

3. **GitHub Actions status?**
   - Is "Keep Modal Backend Warm" running?
   - Any recent runs in the Actions tab?

4. **Error messages?**
   - Any errors in browser console?
   - Any timeout messages?

---

## 🚨 Most Likely Scenario

**You're hitting a cold start!**

**Why:**
- Backend was just deployed
- GitHub Actions hasn't warmed it up yet
- First few requests will be slow (~40-50s)

**Solution:**
1. Wait 10-15 minutes for GitHub Actions to establish pattern
2. OR manually ping backend 3-4 times
3. Then test again - should be ~10-15s

**After GitHub Actions runs for a while:**
- Backend stays warm 24/7
- Every request will be fast (~10-15s)
- No more cold starts! ✅

---

## 💬 Next Steps

Please share:
- Exact timing you're seeing
- Whether it's first request or not
- I'll help pinpoint the exact issue!

