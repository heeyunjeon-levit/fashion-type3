# 🔍 Fashion Visual Search MVP

A powerful fashion image search application that uses AI to detect clothing items and find similar products from Korean fashion platforms.

## ✨ Features

- 📸 **Visual Item Detection** - DINO-X API for fast, accurate object detection
- ✂️ **Smart Cropping** - Client-side Canvas API for instant item isolation
- 🔍 **Multi-Platform Search** - Searches across major Korean fashion platforms
- 📱 **SMS Notifications** - NCP Cloud SMS integration for Korean mobile numbers
- 🎯 **Interactive Selection** - User selects items before searching
- 💾 **Shareable Results** - Persistent links for sharing search results
- 🌐 **Korean + English** - Bilingual interface support

## 🏗️ Architecture

### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **React Context** for language management
- **Canvas API** for client-side image cropping

### Backend (Serverless)
- **Next.js API Routes** - All backend logic
- **Supabase** - PostgreSQL database + image storage
- **No Python Backend** - Fully serverless architecture

### AI Services
- **DINO-X API** - Object detection (5-7s)
- **Google Gemini 2.0 Flash** - Item descriptions
- **OpenAI GPT-4o** - Result filtering and quality control

### External APIs
- **Serper API** - Visual + text search via Google Lens
- **NCP Cloud SMS** - Korean SMS notifications
- **DeepDataSpace** - DINO-X object detection API

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- API keys (see Environment Variables)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables (see .env.example)
cp .env.example .env.local

# Run development server
npm run dev
```

Visit `http://localhost:3000` to see the app.

### Environment Variables

Required API keys and configuration:

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

## 📁 Project Structure

```
mvp/
├── app/                        # Next.js app directory
│   ├── api/                   # API routes
│   │   ├── search/           # Main search endpoint
│   │   ├── search-job/       # Job queue endpoints
│   │   ├── describe-item/    # GPT-4o item description
│   │   ├── detect-dinox/     # GroundingDINO detection
│   │   └── ...
│   ├── components/           # React components
│   │   ├── ImageUpload.tsx
│   │   ├── InteractiveBboxSelector.tsx
│   │   ├── CategorySelection.tsx
│   │   ├── Results.tsx
│   │   └── ...
│   ├── contexts/            # React contexts
│   └── page.tsx            # Main page
├── lib/                    # Utility libraries
│   ├── sms.ts             # NCP SMS integration
│   ├── jobQueue.ts        # Job queue with DB persistence
│   ├── searchJobClient.ts # Client-side job polling
│   └── imageCropper.ts    # Image cropping utilities
├── public/                # Static assets
├── scripts/               # Utility scripts
├── docs/                  # Documentation
│   ├── features/         # Feature documentation
│   ├── deployment/       # Deployment guides
│   ├── debugging/        # Debug & fix logs
│   └── archived/         # Historical documentation
└── archive/              # Old test data and scripts
```

## 🔄 How It Works

1. **Upload Image** - User uploads a fashion image
2. **DINO-X Detection** - AI detects items and returns bounding boxes (5-7s)
3. **Interactive Selection** - User selects which items to search for
4. **Client-Side Cropping** - Browser crops selected items using Canvas API
5. **Gemini Descriptions** - Generate detailed fashion descriptions (2-3s per item)
6. **Serper Search** - Visual + text search via Google Lens (1-2s per item)
7. **GPT Filtering** - Remove irrelevant results (2-3s per item)
8. **View Results** - Shareable link with top 6 matches per item

**Total Time**: ~15-25 seconds for 3 items

## 🧪 Testing

```bash
# Run in development mode
npm run dev

# Test on mobile
# - Use ngrok or similar for HTTPS
# - Test SMS notifications with real phone number
```

## 🚢 Deployment

The app is deployed on **Vercel** with automatic deployments from the `main` branch.

```bash
# Deploy to Vercel
vercel --prod

# Or push to main branch for auto-deployment
git push origin main
```

### Post-Deployment Checklist
- ✅ Verify all environment variables are set in Vercel
- ✅ Test SMS notifications
- ✅ Test image upload to S3
- ✅ Test background job processing
- ✅ Check Supabase database connectivity

## 📚 Documentation

- **Features**: See `/docs/features/` for detailed feature documentation
- **Deployment**: See `/docs/deployment/` for deployment guides
- **Debugging**: See `/docs/debugging/` for troubleshooting tips

Key docs:
- `docs/features/TWO_STAGE_VISION_VERIFICATION.md` - AI detection system
- `docs/features/BBOX_VARIATIONS_FEATURE.md` - Bbox variation generation
- `docs/features/NCP_SMS_SETUP.md` - SMS notification setup
- `docs/deployment/DEPLOYMENT_GUIDE.md` - Deployment instructions

## 🐛 Known Issues & Limitations

- SMS only works for Korean phone numbers (+82)
- Search limited to Korean fashion platforms
- Background jobs timeout after ~6 minutes on Vercel free tier
- Some browsers don't support all image formats (HEIC conversion provided)

## 🔧 Tech Stack

**Frontend**
- Next.js 14, React 18, TypeScript, Tailwind CSS

**Backend (Serverless)**
- Next.js API Routes, Supabase (PostgreSQL + Storage)

**AI Services**
- DINO-X API (Object Detection)
- Google Gemini 2.0 Flash (Descriptions)
- OpenAI GPT-4o (Result Filtering)

**External Services**
- Serper API (Visual Search)
- NCP Cloud SMS (Notifications)

**Deployment**
- Vercel (Frontend/API), Supabase (Database)

📖 **Detailed Tech Stack**: See `docs/TECH_STACK.md`

## 📄 License

Private project - All rights reserved.

## 🤝 Contributing

This is a private MVP. Contact the maintainer for contribution guidelines.

---

**Built with ❤️ for Korean Fashion Discovery**
