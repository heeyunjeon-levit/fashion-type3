# Deployment Guide: Making the MVP Interactive

This guide walks you through deploying your image search MVP so it works interactively on the web.

## Architecture Overview

- **Frontend (Next.js)**: Deployed on Vercel (already done ✅)
- **Python Backend (FastAPI)**: Needs to be deployed separately on Railway/Render/Cloud Run
- Once both are deployed, update the frontend to use the deployed backend URL

---

## Option 1: Deploy Python Backend to Railway (Recommended)

Railway offers a generous free tier and is very easy to use for Python APIs.

### Step 1: Prepare for Deployment

The necessary files have been created:
- `railway.json` - Railway configuration
- `Procfile` - Process file for deployment
- `.railwayignore` - Files to ignore during deployment

### Step 2: Deploy to Railway

1. **Sign up for Railway**:
   - Go to https://railway.app/
   - Sign up with GitHub (free tier: $5/month credit, no card required)

2. **Create a new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account if not already connected
   - Select the repository containing this code
   - Railway will auto-detect it's a Python project

3. **Configure the deployment**:
   - Railway will automatically use the `Procfile` and `railway.json`
   - Set the **Root Directory** to `python_backend`
   - Click "Deploy"

4. **Add environment variables**:
   After deployment, go to your project → Variables → Add the following:
   ```
   OPENAI_API_KEY=your_openai_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_key
   SERPER_API_KEY=your_serper_key (if needed for cropper)
   ```

5. **Get your deployment URL**:
   - Once deployed, Railway will give you a URL like: `https://your-app.railway.app`
   - Copy this URL - you'll need it for the frontend

### Step 3: Update Frontend to Use Deployed Backend

Add the backend URL as an environment variable in Vercel:

1. Go to your Vercel project dashboard
2. Go to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `NEXT_PUBLIC_PYTHON_CROPPER_URL`
   - **Value**: `https://your-app.railway.app` (your Railway URL)
   - **Environment**: Production, Preview, Development (check all)
4. Click **Save**

Alternatively, you can edit `.env.local` file locally:
```bash
NEXT_PUBLIC_PYTHON_CROPPER_URL=https://your-app.railway.app
```

### Step 4: Redeploy Frontend to Vercel

After updating the cropper URL:
```bash
cd /Users/levit/Desktop/mvp
npx vercel --prod
```

### Step 5: Test Your Interactive MVP

Visit your Vercel URL and try uploading an image with category selection!

---

## Option 2: Deploy Python Backend to Render

Render is another great option with a free tier.

### Step 1: Create Render Account
- Sign up at https://render.com (free tier available)

### Step 2: Create a Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `fashion-cropper-api`
   - **Root Directory**: `python_backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn api.server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free

### Step 3: Add Environment Variables
Same as Railway - add all API keys in the Environment section.

### Step 4: Deploy & Update Frontend
Follow steps 3-5 from Option 1 above.

---

## Option 3: Deploy Python Backend to Google Cloud Run

For production workloads, Cloud Run offers excellent scaling and pay-per-use pricing.

### Prerequisites
- Google Cloud account
- `gcloud` CLI installed

### Step 1: Create Dockerfile
Create `/Users/levit/Desktop/mvp/python_backend/Dockerfile`:

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Start server
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Step 2: Deploy to Cloud Run
```bash
cd /Users/levit/Desktop/mvp/python_backend

# Build and deploy
gcloud run deploy fashion-cropper-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=xxx,SUPABASE_URL=xxx,SUPABASE_ANON_KEY=xxx
```

### Step 3: Update Frontend
Follow steps 3-5 from Option 1 above.

---

## Important Notes

### CORS Configuration
The Python backend already has CORS enabled for all origins in `api/server.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Model Files
**Important**: The model weights are very large (sam2_hiera_large.pt is ~800MB).

For Railway/Render:
- Models will be downloaded on first deployment (slow first build)
- Consider storing models in cloud storage (S3/GCS) and loading them at runtime

For Cloud Run:
- Use Cloud Storage to store model weights
- Load them at container startup

### Cost Considerations

- **Railway**: $5/month free credit (enough for testing)
- **Render**: Free tier with 750 hours/month
- **Cloud Run**: Pay per use (~$0.40 per 1M requests)

### Performance
- Cold start times will be longer (~30-60s) due to model loading
- Consider keeping the backend warm with periodic health checks
- For production, use a GPU-enabled service (Cloud Run with GPUs, AWS Lambda with container GPUs)

---

## Testing After Deployment

1. Test the backend health endpoint:
   ```bash
   curl https://your-backend-url.railway.app/
   ```

2. Test the crop endpoint:
   ```bash
   curl -X POST https://your-backend-url.railway.app/crop \
     -H "Content-Type: application/json" \
     -d '{
       "imageUrl": "https://your-image-url.jpg",
       "categories": ["tops"],
       "count": 1
     }'
   ```

3. Visit your Vercel frontend and try uploading an image!

---

## Troubleshooting

### Backend not starting
- Check logs in Railway/Render dashboard
- Verify all environment variables are set
- Ensure model files are accessible

### CORS errors
- Verify CORS middleware is configured in `api/server.py`
- Check that the frontend URL is allowed

### Slow cold starts
- Consider using a paid tier with always-on instances
- Implement model caching
- Use smaller models for faster loading

### Out of memory
- Increase instance memory (paid tier)
- Optimize model loading
- Process images in smaller batches

---

## Next Steps

Once deployed:
1. Monitor usage and costs
2. Set up error tracking (Sentry)
3. Add rate limiting
4. Implement user authentication
5. Cache common search results
6. Optimize model loading for faster cold starts

Good luck! 🚀
