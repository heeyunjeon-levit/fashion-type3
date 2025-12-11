# Setting Environment Variable in Vercel

## Quick Guide: Connect Your Frontend to Modal Backend

### Step-by-Step Instructions

#### 1. Go to Vercel Dashboard
- Open your browser and go to: **https://vercel.com/dashboard**
- Sign in if prompted

#### 2. Select Your Project
- Find your project in the list (it's probably called `mvp` or `fashion-type3`)
- Click on the project name to open it

#### 3. Navigate to Settings
- At the top of the page, click the **Settings** tab
- You'll see a sidebar on the left with various options

#### 4. Open Environment Variables
- In the left sidebar, click **Environment Variables**
- You'll see a page with any existing environment variables

#### 5. Add New Variable
Click the **Add New** button (or **Add Another** if you already have variables)

Fill in the form:
```
Name (Key):
NEXT_PUBLIC_PYTHON_CROPPER_URL

Value:
https://heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run

Select Environments:
☑ Production
☑ Preview  
☑ Development
```

#### 6. Save
- Click **Save** button
- Vercel will show a confirmation

#### 7. Redeploy (Automatic)
- Vercel will **automatically trigger a new deployment**
- This usually takes 1-2 minutes
- You can watch the progress in the **Deployments** tab

---

## What This Does

When you set `NEXT_PUBLIC_PYTHON_CROPPER_URL`, your frontend code will use this value:

```typescript
// In app/components/Cropping.tsx
const PYTHON_CROPPER_URL = process.env.NEXT_PUBLIC_PYTHON_CROPPER_URL || 'http://localhost:8000'
```

**Before:** Tries to connect to `http://localhost:8000` (doesn't work in production)  
**After:** Connects to your Modal backend (works everywhere!)

---

## Verify It's Working

### 1. Check Deployment
- Go to the **Deployments** tab
- Wait for the latest deployment to show **Ready** status
- Click on the deployment to open it

### 2. Test the MVP
- Upload a fashion image
- Select categories (e.g., "상의 ×2", "하의 ×1")
- Click crop
- **You should see actual cropped images!** (not mock/placeholder)

### 3. Check Browser Console (Optional)
- Open browser DevTools (F12)
- Go to Console tab
- You should see logs like:
  ```
  🔄 Cropping tops ×2...
  ✅ Cropped tops: 2 images
  ```

---

## Troubleshooting

### If the deployment doesn't start automatically:
1. Go to **Settings** → **General**
2. Scroll down to **Build & Development Settings**
3. Click **Redeploy** button

### If you still see "localhost" errors:
1. Double-check the environment variable name is **exactly**: `NEXT_PUBLIC_PYTHON_CROPPER_URL`
2. Make sure you selected **Production** environment
3. Try a manual redeploy: `vercel --prod` from your terminal

### If cropping is slow (first time):
- **First request:** 60-90 seconds (models loading on Modal)
- **Subsequent requests:** 5-15 seconds (normal speed)
- This is expected behavior!

---

## Alternative: Set via Vercel CLI

If you prefer the command line:

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
cd /Users/levit/Desktop/mvp
vercel link

# Add environment variable
vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL production
# When prompted, paste:
# https://heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run

# Redeploy
vercel --prod
```

---

## Summary

**Variable Name:** `NEXT_PUBLIC_PYTHON_CROPPER_URL`  
**Variable Value:** `https://heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run`  
**Where to Set:** Vercel Dashboard → Your Project → Settings → Environment Variables  
**Environments:** Production, Preview, Development (all three)  

Once set, your **interactive MVP will be live**! 🎉

---

## Need Help?

If you run into any issues:
1. Check the Vercel deployment logs for errors
2. Check Modal logs: `modal app logs fashion-crop-api`
3. Verify the environment variable is set correctly in Vercel settings

