# Railway Deployment Guide

## 🚂 Deploy Python Backend to Railway

### **Step 1: Sign Up & Connect GitHub**

1. Go to: https://railway.app/
2. Click **"Login"** → **"Login with GitHub"**
3. Authorize Railway to access your GitHub account

### **Step 2: Create New Project**

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose: `heeyunjeon-levit/fashion-type3`
4. Railway will auto-detect the project

### **Step 3: Configure Service**

After deployment starts:

1. Click on the service card
2. Go to **Settings** tab
3. **Root Directory**: Enter `python_backend`
4. **Start Command**: `uvicorn api.server:app --host 0.0.0.0 --port $PORT`
5. Save changes

### **Step 4: Add Environment Variables**

Click **Variables** tab and add these three variables:

```bash
OPENAI_API_KEY=<your key from .env>
SUPABASE_URL=https://ssfiahbvlzepvddglawo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzZmlhaGJ2bHplcHZkZGdsYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Mzc1OTIsImV4cCI6MjA3NzIxMzU5Mn0.obUNhgNmYIMlzQBT-_gaNdza52kCaFazqe6F8AF8Gh4
```

**Note:** Get your `OPENAI_API_KEY` from `/Users/levit/Desktop/mvp/.env`

### **Step 5: Adjust Resources (Important!)**

Your Python backend uses heavy ML models. You need sufficient resources:

1. Go to **Settings** → **Resources**
2. **RAM**: Select at least **2GB** (4GB recommended)
3. **CPU**: 1 vCPU should work (2 recommended)
4. Save changes

💰 **Cost**: ~$10-15/month for 2GB RAM plan

### **Step 6: Wait for Deployment**

- First build takes ~5-10 minutes (downloading model weights)
- Railway will show build logs
- Wait for ✅ **"Deployed"** status

### **Step 7: Get Your Backend URL**

1. Click **Settings**
2. Find **"Public Networking"** section
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `https://fashion-type3-production.up.railway.app`)

---

## 🔗 Step 8: Update Frontend

Once Railway gives you the backend URL:

### **Option A: Vercel Dashboard**
1. Go to https://vercel.com/dashboard
2. Select your `mvp` project
3. Go to **Settings** → **Environment Variables**
4. Add: `NEXT_PUBLIC_PYTHON_CROPPER_URL` = `<your Railway URL>`
5. Redeploy: **Deployments** → **Redeploy**

### **Option B: Command Line**
```bash
cd /Users/levit/Desktop/mvp
npx vercel env add NEXT_PUBLIC_PYTHON_CROPPER_URL production
# Paste your Railway URL when prompted
npx vercel --prod
```

---

## ✅ Testing

Once both are deployed:

1. Visit your Vercel URL: https://mvp-rhy27hpsj-heeyun-jeons-projects.vercel.app
2. Upload an image
3. Select categories (e.g., tops, bottoms)
4. Click "Find Similar Items"
5. ✨ It should work!

---

## 🐛 Troubleshooting

### **Build Fails: "Out of Memory"**
- Increase RAM to 4GB or 8GB in Railway settings

### **Timeout Errors**
- Increase **healthcheckTimeout** to 600 in `railway.json`
- Railway might kill the process if model loading takes too long

### **Cold Start Issues**
- First request after inactivity takes ~30-60s (model loading)
- This is normal for heavy ML models
- Consider keeping the service "always on"

### **Check Logs**
- Railway Dashboard → Service → **Logs** tab
- Look for errors during model loading

---

## 💡 Alternative: Lighter Model

If Railway is too slow/expensive, consider:
1. **Use smaller models** (MobileSAM instead of SAM-2)
2. **Pre-compute embeddings** (cache results)
3. **Deploy to AWS EC2** with GPU (~$0.50/hour)
4. **Use HuggingFace Inference API** (pay per request)

---

## 📝 Summary

1. ✅ Sign up at Railway
2. ✅ Deploy `python_backend` directory
3. ✅ Set 3 environment variables
4. ✅ Increase RAM to 2-4GB
5. ✅ Generate public domain
6. ✅ Add `NEXT_PUBLIC_PYTHON_CROPPER_URL` to Vercel
7. ✅ Test your MVP!

Your MVP will be fully interactive once both backends are deployed! 🚀

