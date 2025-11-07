# Vercel GPU Backend Update - Quick Checklist

**Target URL:** `https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run`

---

## 📋 Update Steps (5 minutes)

### Part 1: Update Vercel (2 minutes)

- [ ] **1.1** Open https://vercel.com/dashboard
- [ ] **1.2** Click on your project
- [ ] **1.3** Go to **Settings** (top menu)
- [ ] **1.4** Click **Environment Variables** (left sidebar)
- [ ] **1.5** Find `NEXT_PUBLIC_PYTHON_CROPPER_URL`
- [ ] **1.6** Click **⋮** (three dots) → **Edit**
- [ ] **1.7** Update value to:
  ```
  https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
  ```
- [ ] **1.8** Check all environments:
  - [ ] Production
  - [ ] Preview
  - [ ] Development
- [ ] **1.9** Click **Save**

### Part 2: Redeploy (2-3 minutes)

- [ ] **2.1** Go to **Deployments** tab
- [ ] **2.2** Find latest successful deployment
- [ ] **2.3** Click **⋮** (three dots) → **Redeploy**
- [ ] **2.4** Keep "Use existing Build Cache" checked
- [ ] **2.5** Click **Redeploy**
- [ ] **2.6** Wait for green checkmark (deployment complete)

### Part 3: Verify (2 minutes)

- [ ] **3.1** Open your deployed site in browser
- [ ] **3.2** Open DevTools (F12 or right-click → Inspect)
- [ ] **3.3** Go to **Console** tab
- [ ] **3.4** Upload a test image (any fashion photo)
- [ ] **3.5** Select 2-3 categories (e.g., tops, bottoms)
- [ ] **3.6** Check console output shows:
  ```
  🔗 Using backend: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
  ```
- [ ] **3.7** Verify crop completes in **<20 seconds** (not 40+ seconds)
- [ ] **3.8** Verify all items are detected correctly

---

## ✅ Success Criteria

**Your update is successful when ALL of these are true:**

- ✅ Vercel env shows GPU URL (not CPU)
- ✅ Browser console shows GPU URL (not CPU)
- ✅ Crop time is 7-20 seconds (not 40-90+ seconds)
- ✅ Items are detected accurately
- ✅ No timeout errors

---

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| Browser console shows CPU URL | Hard refresh: `Cmd+Shift+R` or try incognito |
| Still taking 40+ seconds | Double-check Vercel env was saved and redeployed |
| "Failed to crop" error | GPU backend cold start (wait 10-15s and retry) |
| Can't find the env variable | Make sure you're in the correct Vercel project |

---

## 🔧 Quick Commands

```bash
# Verify local setup
node verify_backend_config.js

# Test GPU backend directly
node test_gpu_quick.js

# Check GPU backend health
curl https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/
```

---

## 📊 Expected Performance

| Scenario | Before (CPU) | After (GPU) | 
|----------|-------------|-------------|
| 1 item | 40-50s | **7-10s** ⚡ |
| 2 items | 60-80s | **12-15s** ⚡ |
| 3 items | 90-120s | **14-18s** ⚡ |

---

## 📚 Full Documentation

- **This Checklist:** Quick reference
- **VERCEL_ENV_VERIFICATION_GUIDE.md:** Detailed guide with screenshots
- **FRONTEND_UPDATE_SUMMARY.md:** Complete update summary
- **GPU_BACKEND_COMPLETE.md:** Full GPU backend documentation

---

**Print this checklist and follow step by step! 📝**

