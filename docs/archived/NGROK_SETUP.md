# Ngrok Setup Guide - Quick MVP Solution

## Why Ngrok?

Railway/Render deployments are failing due to the heavy ML dependencies (PyTorch, GroundingDINO, SAM-2). Using Ngrok allows you to:
- Run the Python backend locally (where it already works)
- Expose it via a public URL
- Connect Vercel frontend to it
- **No complex deployment needed!**

## 📋 Setup Steps (5 minutes)

### **1. Install Ngrok**

```bash
# On macOS
brew install ngrok

# Or download from: https://ngrok.com/download
```

### **2. Sign Up & Get Auth Token**

1. Go to: https://dashboard.ngrok.com/signup
2. Sign up (free account)
3. Copy your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

### **3. Configure Ngrok**

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### **4. Start Your Python Backend**

```bash
cd /Users/levit/Desktop/mvp/python_backend
source venv/bin/activate
uvicorn api.server:app --host 0.0.0.0 --port 8000
```

### **5. In a New Terminal, Start Ngrok**

```bash
ngrok http 8000
```

You'll see output like:
```
Forwarding   https://abcd-1234-xyz.ngrok-free.app -> http://localhost:8000
```

**Copy that `https://...ngrok-free.app` URL!**

### **6. Update Vercel Environment Variable**

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Find `NEXT_PUBLIC_PYTHON_CROPPER_URL`
5. Update it to your ngrok URL (e.g., `https://abcd-1234-xyz.ngrok-free.app`)
6. **Redeploy** your frontend

### **7. Test Your Interactive MVP!**

Visit your Vercel URL and try uploading an image!

---

## 🔄 Keeping It Running

- **Ngrok URL changes** every time you restart ngrok (free tier)
- To keep a **static URL**, upgrade to ngrok Pro ($8/month)
- **For production**, you'll need proper deployment (Google Cloud Run, AWS Lambda, etc.)

---

## ✅ This is Perfect for MVP Testing!

You can now:
- Demo your MVP to users
- Test the full pipeline end-to-end
- Iterate quickly without deployment headaches
- Decide on production deployment later

---

## 🚀 When Ready for Production

Once your MVP is validated, consider:
1. **Google Cloud Run** - Best for ML workloads, auto-scaling
2. **AWS Lambda + EFS** - Serverless with persistent storage for models
3. **Dedicated Server** (DigitalOcean, Linode) - Full control, ~$20/month

