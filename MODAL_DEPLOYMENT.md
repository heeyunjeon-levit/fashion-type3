# Modal Deployment Guide - Easiest ML Hosting

Modal is **THE EASIEST** way to deploy heavy ML models like yours. It's specifically built for Python AI/ML applications.

## ✨ Why Modal?

- ✅ **Built for ML** - Handles PyTorch, GroundingDINO, SAM-2 perfectly
- ✅ **Simple setup** - 3 commands to deploy
- ✅ **Auto-scaling** - Scales to zero when not in use (saves money!)
- ✅ **Free credits** - $30/month free tier
- ✅ **Fast cold starts** - Cached images load in seconds

## 📋 Setup Steps (10 minutes)

### **Step 1: Install Modal**

```bash
pip install modal
```

### **Step 2: Sign Up & Authenticate**

```bash
modal setup
```

This will:
1. Open a browser to create your Modal account (free)
2. Authenticate your CLI

### **Step 3: Set Secrets**

```bash
# Add OpenAI API Key
modal secret create openai-api-key OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# Add Supabase credentials
modal secret create supabase-credentials \
  SUPABASE_URL=https://ssfiahbvlzepvddglawo.supabase.co \
  SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzZmlhaGJ2bHplcHZkZGdsYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Mzc1OTIsImV4cCI6MjA3NzIxMzU5Mn0.obUNhgNmYIMlzQBT-_gaNdza52kCaFazqe6F8AF8Gh4
```

Replace `YOUR_KEY_HERE` with your actual OpenAI API key.

### **Step 4: Deploy!**

```bash
cd /Users/levit/Desktop/mvp/python_backend
modal deploy modal_deploy.py
```

That's it! 🎉

Modal will:
1. Build a Docker image with all your dependencies (~5 min first time)
2. Upload your code
3. Deploy and give you a public URL

### **Step 5: Get Your URL**

After deployment, Modal will show:
```
✓ Deployed! View at: https://your-username--fashion-crop-api-fastapi-app.modal.run
```

**Copy that URL!**

### **Step 6: Update Vercel**

1. Go to Vercel dashboard
2. Settings → Environment Variables
3. Update `NEXT_PUBLIC_PYTHON_CROPPER_URL` to your Modal URL
4. Redeploy your frontend

---

## 💰 Pricing

**Free Tier:**
- $30/month credits
- Perfect for MVP testing!

**After free tier (~$5-15/month for light usage):**
- $0.000161 per CPU-second
- $0.00028 per GB-second of memory
- Auto-scales to zero when not in use

---

## 🔄 Updating Your Code

Whenever you change your Python code:

```bash
cd /Users/levit/Desktop/mvp/python_backend
modal deploy modal_deploy.py
```

Modal will update the deployment in ~30 seconds!

---

## 📊 Monitoring

View logs and usage:
```bash
modal app logs fashion-crop-api
```

Or check the dashboard: https://modal.com/apps

---

## 🎯 Next Steps

1. Run `modal setup`
2. Add your secrets
3. Deploy with `modal deploy modal_deploy.py`
4. Update Vercel with the Modal URL
5. Test your interactive MVP! 🚀

**Need help?** Modal has excellent docs: https://modal.com/docs/guide

