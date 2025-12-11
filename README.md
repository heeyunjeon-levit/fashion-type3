# 🔍 Fashion Visual Search MVP

A powerful fashion image search application that uses AI to detect clothing items and find similar products from Korean fashion platforms.

## ✨ Features

- 📸 **Visual Item Detection** - AI-powered detection using GPT-4o Vision and Gemini 2.0 Flash
- ✂️ **Smart Cropping** - Automatic item isolation with bbox variations for better search coverage
- 🔍 **Multi-Platform Search** - Searches across major Korean fashion platforms (Musinsa, 29CM, W Concept, etc.)
- 📱 **SMS Notifications** - NCP Cloud SMS integration for Korean mobile numbers
- 🎯 **Interactive Selection** - Manual bbox adjustment for precise item selection
- 💾 **Background Processing** - Jobs persist in database, allowing users to close app while searching
- 🌐 **Korean + English** - Bilingual interface support

## 🏗️ Architecture

### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **React Context** for language management

### Backend
- **Next.js API Routes** (Serverless)
- **Supabase** (PostgreSQL database)
- **Job Queue System** for background processing

### AI Models
- **GPT-4o Vision** - Primary item detection and description
- **Gemini 2.0 Flash** - Secondary verification for accuracy
- **GroundingDINO** (optional) - Advanced object detection

### External APIs
- **Serper API** - Web search for product discovery
- **NCP Cloud SMS** - Korean SMS notifications
- **AWS S3** - Image storage

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
# OpenAI (GPT-4o Vision)
OPENAI_API_KEY=your_openai_key

# Google AI (Gemini)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key

# Serper (Web Search)
SERPER_API_KEY=your_serper_key

# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AWS S3 (Image Storage)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=your_region
AWS_BUCKET_NAME=your_bucket

# NCP Cloud SMS (Korean SMS)
NCP_ACCESS_KEY=your_ncp_access_key
NCP_SECRET_KEY=your_ncp_secret_key
NCP_SERVICE_ID=your_service_id
NCP_CALLING_NUMBER=your_calling_number

# App Configuration
NEXT_PUBLIC_APP_URL=your_production_url
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
2. **AI Detection** - GPT-4o detects and describes items
3. **Verification** - Gemini 2.0 verifies detection accuracy
4. **Interactive Selection** - User can adjust bounding boxes
5. **Category Selection** - User confirms item categories
6. **Search** - System searches across Korean fashion platforms
7. **SMS Notification** - User receives SMS when search completes
8. **View Results** - User views ranked results with similarity scores

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

**Backend**
- Next.js API Routes, Supabase (PostgreSQL)

**AI/ML**
- OpenAI GPT-4o Vision, Google Gemini 2.0 Flash

**External Services**
- Serper API, NCP Cloud SMS, AWS S3

**Deployment**
- Vercel (Frontend/API), Supabase (Database)

## 📄 License

Private project - All rights reserved.

## 🤝 Contributing

This is a private MVP. Contact the maintainer for contribution guidelines.

---

**Built with ❤️ for Korean Fashion Discovery**
