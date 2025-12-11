# Quick Deploy Checklist ✅

## 🚀 Deploy Interactive MVP in 10 Minutes

### Step 1: Deploy Backend to Railway (5 min)

1. **Go to**: https://railway.app/
2. **Sign up** with GitHub (free, no card required)
3. **New Project** → **Deploy from GitHub repo**
4. **Select** your repo → **Root Directory**: `python_backend`
5. **Add Variables**:
   ```
   OPENAI_API_KEY=sk-...
   SUPABASE_URL=https://...
   SUPABASE_ANON_KEY=eyJ...
   ```
6. **Copy** your Railway URL: `https://xxx.railway.app`

### Step 2: Update Frontend (3 min)

**Add Environment Variable in Vercel**:
1. Go to your Vercel dashboard → Your project
2. **Settings** → **Environment Variables**
3. Add:
   - Name: `NEXT_PUBLIC_PYTHON_CROPPER_URL`
   - Value: `https://your-app.railway.app` (your Railway URL)
   - Check all environments (Production, Preview, Development)
4. Save

### Step 3: Deploy Frontend (2 min)

```bash
cd /Users/levit/Desktop/mvp
npx vercel --prod
```

### 🎉 Done! Test your MVP

Visit your Vercel URL and upload an image!

---

## Alternative: Render (same steps, different platform)

1. https://render.com/ → Sign up
2. New Web Service → Connect repo
3. Root Directory: `python_backend`
4. Start Command: `uvicorn api.server:app --host 0.0.0.0 --port $PORT`
5. Add environment variables
6. Copy URL → Update frontend → Deploy

---

## Environment Variables You'll Need

```bash
OPENAI_API_KEY=sk-...          # OpenAI API key for GPT-4
SUPABASE_URL=https://...       # Your Supabase project URL
SUPABASE_ANON_KEY=eyJ...       # Supabase anon public key
```

---

## Troubleshooting

**Backend not starting?**
→ Check Railway logs for errors

**CORS error?**
→ Already configured, should work automatically

**Slow first request?**
→ Normal! Models are loading (30-60s)

**Out of memory?**
→ Upgrade to Railway Pro ($5/month)

---

## What's Next?

After deploying:
- [ ] Test with real images
- [ ] Monitor Railway usage dashboard
- [ ] Add error tracking (Sentry)
- [ ] Set up custom domain
- [ ] Add user authentication

For detailed instructions, see `DEPLOYMENT_GUIDE.md`

