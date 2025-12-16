# Fashion Search App - Tech Stack Documentation

**Last Updated**: December 2024  
**Status**: ✅ Production-Ready

---

## Architecture Overview

This is a Next.js application that uses AI-powered visual search to find fashion items. The entire pipeline runs **serverless** without any Python backend.

---

## Frontend Stack

### Core Framework
- **Next.js 14** (App Router)
  - TypeScript
  - React 18
  - Server-side rendering + API routes

### UI Libraries
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Lucide React** - Icons
- **react-dropzone** - File uploads

### State Management
- React hooks (useState, useEffect, useContext)
- LanguageContext for i18n (Korean/English)

---

## Backend Services

### 1. Object Detection → **DINO-X API** 🔥
- **Endpoint**: `/app/api/detect-dinox/route.ts`
- **Service**: DeepDataSpace DINO-X API (`api.deepdataspace.com`)
- **Model**: DINO-X-1.0 (open-vocabulary object detection)
- **Speed**: ~5-7 seconds
- **What it does**:
  - Detects fashion items in uploaded images
  - Returns bounding boxes with categories (e.g., "jacket", "jeans", "necklace")
  - Category-aware confidence thresholds (dress=0.25, ring=0.60)
  - Filters by "main subject score" (size + centrality + confidence)
  - Returns top 5 items max

### 2. Image Cropping → **Canvas API**
- **Where**: `/app/components/Cropping.tsx` + `/lib/imageCropper.ts`
- **Technology**: HTML5 Canvas API (client-side)
- **What it does**:
  - User selects items from detected bounding boxes
  - Browser crops images using Canvas API
  - Converts to data URLs (base64)
  - Smart cropping for tops/bottoms (excludes overlapping garments)

### 3. Item Description → **Google Gemini 2.0 Flash**
- **Endpoint**: `/app/api/describe-item/route.ts`
- **Model**: `gemini-2.0-flash-exp` (Google's latest experimental model)
- **What it does**:
  - Receives cropped image + category
  - Generates detailed fashion descriptions:
    - Color, style, fit, material, pattern
    - Special handling for accessories (jewelry gets `metal_color`, `material`, `style`, `length`)
  - Returns description for search

### 4. Image Search → **Serper API**
- **Endpoint**: `/app/api/search/route.ts`
- **Service**: Serper.dev (Google Lens API wrapper)
- **What it does**:
  - Visual search using cropped image
  - Text search using Gemini description
  - Returns shopping results (images, links, prices)

### 5. Result Filtering → **OpenAI GPT-4o**
- **Endpoint**: `/app/api/search/route.ts` (after Serper results)
- **Model**: `gpt-4o-2024-11-20` (latest GPT-4 with vision)
- **What it does**:
  - Filters Serper results for relevance
  - Removes mismatched items (e.g., dresses when searching for necklaces)
  - Returns top 6 results with explanations

### 6. Database & Storage → **Supabase**
- **Endpoints**: `/lib/supabase.ts`, `/app/api/share-results/route.ts`
- **Services**:
  - **PostgreSQL**: Store search results, user sessions, search jobs
  - **Object Storage**: Store uploaded images
- **Tables**:
  - `shared_results` - Shareable search result links
  - `search_jobs` - Background search job tracking
  - `user_sessions` - User tracking & analytics

### 7. SMS Notifications → **NCP SENS**
- **Endpoint**: `/lib/sms.ts`
- **Service**: Naver Cloud Platform SMS (NCP SENS)
- **What it does**:
  - Sends search results via SMS
  - Korean phone format: `010-XXXX-XXXX`
  - Backend format: `+82XXXXXXXXX`

---

## Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main UI (upload → detect → select → search) |
| `app/api/detect-dinox/route.ts` | DINO-X object detection |
| `app/api/describe-item/route.ts` | Gemini item descriptions |
| `app/api/search/route.ts` | Serper + GPT filtering |
| `app/api/share-results/route.ts` | Save & share results |
| `app/api/search-job/route.ts` | Background search job processing |
| `lib/sms.ts` | SMS notifications |
| `lib/supabase.ts` | Database client |
| `lib/imageCropper.ts` | Client-side image cropping |

---

## Environment Variables

```bash
# DINO-X Detection
DINOX_API_TOKEN=your_dinox_token

# Google Gemini (Descriptions)
GEMINI_API_KEY=your_gemini_key

# OpenAI (Result Filtering)
OPENAI_API_KEY=your_openai_key

# Serper (Image Search)
SERPER_API_KEY=your_serper_key

# Supabase (Database + Storage)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# NCP SMS
NCP_SERVICE_ID=your_ncp_service_id
NCP_ACCESS_KEY=your_ncp_access_key
NCP_SECRET_KEY=your_ncp_secret_key
NCP_PHONE_NUMBER=your_sender_number

# App URLs
NEXT_PUBLIC_BASE_URL=https://fashionsource.vercel.app
NEXT_PUBLIC_APP_URL=https://fashionsource.vercel.app
```

---

## Deployment

- **Platform**: Vercel
- **Region**: Auto (Edge Functions)
- **Build Command**: `npm run build`
- **Output**: `.next/`

### Deploy Command
```bash
vercel --prod
```

---

## What We DON'T Use Anymore ❌

### Removed (Dec 2024)
- ❌ **Modal Python Backend** - Previously used for GroundingDINO + GPT-4o detection
- ❌ **`/api/analyze` endpoint** - Old detection pipeline
- ❌ **GroundingDINO** - Replaced by DINO-X API
- ❌ **GPT-4o for detection** - Now only used for filtering
- ❌ **Railway/Render deployment** - Python backend no longer needed

### Why We Switched
- **Faster**: DINO-X API (5s) vs Modal (15-20s with cold starts)
- **Simpler**: No GPU backend to manage
- **More Reliable**: No cold start issues
- **Cheaper**: No Modal compute costs

---

## Pipeline Flow

```
1. User uploads image
   ↓
2. DINO-X API detects items (5-7s)
   → Returns bounding boxes with categories
   ↓
3. User selects items to search
   ↓
4. Browser crops selected items (Canvas API)
   ↓
5. Gemini generates descriptions (2-3s per item)
   → "Navy blue denim high-waisted flared jeans..."
   ↓
6. Serper searches for matches (1-2s per item)
   → Visual + text search
   ↓
7. GPT-4o filters results (2-3s per item)
   → Removes irrelevant items
   ↓
8. Results saved to Supabase
   → Shareable link generated
   ↓
9. SMS sent with link (optional)
```

**Total Time**: ~15-25 seconds for 3 items

---

## Performance Benchmarks

| Step | Time | Notes |
|------|------|-------|
| Upload | <1s | Client-side |
| Detection (DINO-X) | 5-7s | API call |
| Cropping | <1s | Client-side Canvas |
| Description (Gemini) | 2-3s | Per item |
| Search (Serper) | 1-2s | Per item |
| Filtering (GPT-4o) | 2-3s | Per item |
| **Total (3 items)** | **15-25s** | End-to-end |

---

## API Rate Limits

| Service | Limit | Cost |
|---------|-------|------|
| DINO-X | ~100/day (free tier) | Free/$0.001 per call |
| Gemini 2.0 Flash | 1M tokens/day | Free tier |
| OpenAI GPT-4o | 500 RPM | $2.50/1M input tokens |
| Serper | 2,500/month (free) | $0.002 per search after |

---

## Maintenance

### Adding New Categories
1. Update `FASHION_CATEGORIES` in `/app/api/detect-dinox/route.ts`
2. Update `CATEGORY_MAP` for parent category mapping
3. Adjust confidence thresholds in `CATEGORY_THRESHOLDS`

### Improving Search Quality
1. Update Gemini prompt in `/app/api/describe-item/route.ts`
2. Update GPT filtering rules in `/app/api/search/route.ts`
3. Adjust Serper parameters (num results, search type)

---

## Questions?

Check the `/docs` folder for more guides on specific features:
- `docs/features/` - Feature implementation guides
- `docs/debugging/` - Common issues & fixes
- `docs/deployment/` - Deployment guides

