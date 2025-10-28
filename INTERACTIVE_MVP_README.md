# Making Your MVP Interactive 🚀

## Current Status

✅ **Frontend**: Deployed on Vercel (static batch results viewer working)  
❌ **Backend**: Running locally only (localhost:8000)  
🎯 **Goal**: Make the full interactive experience work online

---

## What Needs to Happen

To make your MVP interactive (where users can upload images and get results), you need to:

1. **Deploy Python Backend** - The cropping API needs to be hosted online
2. **Connect Frontend to Backend** - Update the frontend to use the deployed backend URL
3. **Test** - Verify everything works end-to-end

---

## Quick Start (10 Minutes)

Follow **[QUICK_DEPLOY.md](./QUICK_DEPLOY.md)** for a fast deployment checklist.

For detailed instructions, see **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**.

For visual step-by-step, see **[DEPLOYMENT_SCREENSHOTS.md](./DEPLOYMENT_SCREENSHOTS.md)**.

---

## Why Can't Vercel Host the Python Backend?

Vercel is optimized for serverless functions with:
- ⏱️ 10-second timeout (your model loading takes 30-60s)
- 💾 Limited memory (SAM-2 needs ~2GB)
- 🚫 No GPU support (needed for faster inference)

That's why we need a separate hosting platform like Railway, Render, or Cloud Run.

---

## Deployment Options

| Platform | Pros | Cons | Best For |
|----------|------|------|----------|
| **Railway** | • Easy setup<br>• $5 free credit<br>• Auto-deploy from GitHub | • Limited free tier<br>• Slower cold starts | **Testing & MVP** |
| **Render** | • Free tier available<br>• Simple UI<br>• Auto-scaling | • Slower than Railway<br>• Limited resources | **Small projects** |
| **Cloud Run** | • Pay-per-use<br>• Fast scaling<br>• GPU support | • More complex setup<br>• Requires Google Cloud | **Production** |

**Recommendation**: Start with Railway for testing, migrate to Cloud Run for production.

---

## Files Created for Deployment

### Backend Configuration
- ✅ `python_backend/railway.json` - Railway configuration
- ✅ `python_backend/Procfile` - Start command for deployment
- ✅ `python_backend/.railwayignore` - Files to exclude from deployment

### Frontend Update
- ✅ `app/components/Cropping.tsx` - Updated to use environment variable for backend URL

### Documentation
- 📖 `DEPLOYMENT_GUIDE.md` - Complete deployment instructions
- 📋 `QUICK_DEPLOY.md` - Fast deployment checklist
- 📸 `DEPLOYMENT_SCREENSHOTS.md` - Visual step-by-step guide

### CI/CD (Optional)
- 🔄 `.github/workflows/deploy-backend.yml` - Auto-deploy on push to main

---

## Architecture After Deployment

```
User's Browser
    │
    ├─→ Vercel (Frontend - Next.js)
    │   ├─ Upload image
    │   ├─ Display results
    │   └─ Call backend API
    │
    ├─→ Railway (Backend - FastAPI)
    │   ├─ GPT-4o analysis
    │   ├─ GroundingDINO detection
    │   └─ SAM-2 cropping
    │
    ├─→ Supabase (Storage)
    │   └─ Store uploaded & cropped images
    │
    └─→ External APIs
        ├─ OpenAI GPT-4o
        └─ Serper Lens API
```

---

## Environment Variables Needed

### Backend (Railway)
```bash
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

### Frontend (Vercel)
```bash
NEXT_PUBLIC_PYTHON_CROPPER_URL=https://your-app.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
OPENAI_API_KEY=sk-proj-...
SERPER_API_KEY=...
```

---

## Estimated Costs

### Free Tier (Good for 100-200 searches/month)
- Railway: $5 credit (resets monthly)
- Vercel: Free (100GB bandwidth)
- Supabase: Free (500MB storage)
- **Total: $0/month**

### Production (Thousands of searches/month)
- Railway Pro: $5/month (always-on backend)
- Vercel: Free (or $20/month for team features)
- Supabase: $25/month (8GB storage + better performance)
- API costs (OpenAI + Serper): ~$50-100/month depending on usage
- **Total: $80-150/month**

---

## Performance Expectations

### Cold Start (First Request After Idle)
- Railway: 30-60 seconds (model loading)
- Cloud Run: 15-30 seconds
- Solution: Keep-alive ping every 5 minutes

### Warm Request
- Upload + Crop: 5-10 seconds
- Search: 15-20 seconds
- **Total: 20-30 seconds** per full search

### Optimization Tips
1. Use smaller models (SAM-2 small instead of large)
2. Cache common searches
3. Implement request queuing
4. Use GPU instances (Cloud Run with GPUs)

---

## Testing After Deployment

### 1. Test Backend Health
```bash
curl https://your-backend.railway.app/
# Should return: {"message": "Custom Fashion Item Cropper API"}
```

### 2. Test Crop Endpoint
```bash
curl -X POST https://your-backend.railway.app/crop \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "categories": ["tops"],
    "count": 1
  }'
```

### 3. Test Frontend
- Go to your Vercel URL
- Upload an image
- Select categories
- Click "Search Products"
- Wait for results (30-60s first time)

---

## Troubleshooting Common Issues

### "Backend not responding"
- Check Railway logs for errors
- Verify environment variables are set
- Ensure the service is running (not sleeping)

### "CORS error"
- Already configured in the backend
- If still happening, check that URL doesn't have trailing slash

### "Out of memory"
- Upgrade to Railway Pro ($5/month)
- Or switch to Cloud Run with more memory

### "Too slow"
- First request is always slow (model loading)
- Consider upgrading to GPU instances
- Implement keep-alive pings

---

## Next Steps After Deployment

1. **Monitor usage** - Check Railway dashboard for resource usage
2. **Set up alerts** - Get notified if the backend goes down
3. **Optimize** - Add caching, use smaller models
4. **Scale** - Move to Cloud Run when you outgrow Railway
5. **Add features** - User accounts, search history, sharing

---

## Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Vercel Documentation](https://vercel.com/docs)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)
- [SAM-2 Documentation](https://github.com/facebookresearch/sam2)
- [GroundingDINO](https://github.com/IDEA-Research/GroundingDINO)

---

## Support

If you encounter issues:
1. Check the logs (Railway dashboard)
2. Review error messages in browser console
3. Verify all environment variables are set correctly
4. Test each component individually (backend, frontend, APIs)

---

**Ready to deploy? Start with [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)!** 🚀

