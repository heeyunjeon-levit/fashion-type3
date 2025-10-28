# Visual Deployment Guide 📸

Step-by-step with screenshots to deploy your interactive MVP.

---

## 🚂 Part 1: Deploy Backend to Railway

### 1. Go to Railway.app and Sign Up
- Visit: https://railway.app/
- Click "Login" → "Login with GitHub"
- Authorize Railway to access your repos

### 2. Create New Project
- Click **"New Project"**
- Select **"Deploy from GitHub repo"**
- Choose your repository from the list

### 3. Configure Root Directory
- Railway will detect it's a Python project
- Click on the service → **Settings**
- Set **Root Directory**: `python_backend`
- Click **Save**

### 4. Add Environment Variables
- In your service, go to **Variables** tab
- Click **"+ New Variable"**
- Add these one by one:

```
OPENAI_API_KEY = sk-proj-...
SUPABASE_URL = https://xxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGci...
```

- Click **Save** after each one

### 5. Deploy!
- Railway will automatically start deploying
- Wait for "Deployment successful ✓"
- Go to **Settings** → **Networking**
- Click **"Generate Domain"**
- Copy your Railway URL (e.g., `https://fashion-cropper-production.up.railway.app`)

---

## ☁️ Part 2: Configure Vercel Frontend

### 1. Go to Vercel Dashboard
- Visit: https://vercel.com/dashboard
- Find your project (should already be deployed)
- Click on it

### 2. Add Environment Variable
- Click **Settings** (top nav)
- Click **Environment Variables** (left sidebar)
- Click **Add New**

Fill in:
- **Name (Key)**: `NEXT_PUBLIC_PYTHON_CROPPER_URL`
- **Value**: `https://your-railway-url.railway.app` (paste your Railway URL)
- **Environments**: Check all three boxes:
  - ✅ Production
  - ✅ Preview
  - ✅ Development
- Click **Save**

### 3. Trigger a Redeploy
- Go to **Deployments** tab
- Click on the latest deployment
- Click the **"..."** menu (three dots)
- Select **"Redeploy"**
- Confirm

### 4. Wait for Deployment
- Watch the build logs
- Wait for "✓ Deployment Complete"
- Your interactive MVP is now live!

---

## 🧪 Part 3: Test Your Interactive MVP

### 1. Visit Your MVP
- Go to your Vercel URL: `https://mvp-xxx.vercel.app`

### 2. Upload an Image
- Click the upload area or drag an image
- Select categories (tops, bottoms, shoes, etc.)
- Click "Search Products"

### 3. Expected Behavior
- ⏳ First request might take 30-60 seconds (model loading)
- 📸 You'll see cropped images appear
- 🛍️ Product results will show below
- 🎉 It works!

---

## 🔧 Troubleshooting

### Backend not responding?
1. Check Railway logs:
   - Go to Railway → Your project → Click the service
   - Scroll down to **"View logs"**
   - Look for errors

2. Common issues:
   - ❌ Environment variables not set → Add them in Variables tab
   - ❌ Out of memory → Upgrade to Pro plan ($5/month)
   - ❌ Port binding error → Make sure Procfile is correct

### Frontend can't reach backend?
1. Check environment variable in Vercel:
   - Settings → Environment Variables
   - Make sure `NEXT_PUBLIC_PYTHON_CROPPER_URL` is set correctly
   - Must start with `https://`
   - No trailing slash

2. Check CORS:
   - Already configured in `api/server.py`
   - Should work automatically

### Slow response times?
- First request after idle: 30-60 seconds (cold start)
- Subsequent requests: 5-10 seconds
- To keep warm: Set up a cron job to ping every 5 minutes

---

## 📊 Monitoring Your Deployment

### Railway Metrics
- Go to Railway → Your project
- Click **"Metrics"** tab
- Monitor:
  - CPU usage
  - Memory usage
  - Network traffic
  - Request count

### Vercel Analytics
- Go to Vercel → Your project
- Click **"Analytics"** tab
- Monitor:
  - Page views
  - Response times
  - Error rates

---

## 💰 Cost Estimates

### Free Tier (Good for Testing)
- **Railway**: $5 credit/month (enough for ~100 searches)
- **Vercel**: 100GB bandwidth/month (enough for thousands of visitors)
- **Total**: $0/month if staying within limits

### Paid Tier (Production Ready)
- **Railway Pro**: $5/month (keeps backend always-on)
- **Vercel Pro**: $20/month (for team features, optional)
- **Total**: $5-25/month

---

## 🚀 Next Steps

After successful deployment:

1. **Set up monitoring**:
   - Add Sentry for error tracking
   - Set up uptime monitoring (UptimeRobot)

2. **Optimize performance**:
   - Add caching for common searches
   - Implement request queuing
   - Consider GPU instances for faster inference

3. **Add features**:
   - User authentication
   - Save search history
   - Share results functionality
   - Mobile app version

4. **Scale up**:
   - Move to Cloud Run for better scaling
   - Use CDN for image delivery
   - Implement API rate limiting

---

## 📞 Need Help?

- **Railway Docs**: https://docs.railway.app/
- **Vercel Docs**: https://vercel.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com/

Good luck with your deployment! 🎉

