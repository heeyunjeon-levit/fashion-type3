# Python Backend - Fashion Item Cropper

FastAPI server for intelligent fashion item cropping using GPT-4o, GroundingDINO, and SAM-2.

## ✅ Setup Complete

All files have been copied from `fashion_crop_bakeoff_v7_gallery`:

- ✅ `custom_item_cropper.py` - Main cropper
- ✅ `src/analyzers/` - GPT-4o analyzer  
- ✅ `src/core/` - Pipeline logic
- ✅ `configs/` - GroundingDINO configs
- ✅ `GroundingDINO/` - Repository (25MB)
- ✅ `data/weights/groundingdino_swint_ogc.pth` (662MB)
- ✅ `data/weights/sam2_hiera_large.pt` (856MB)
- ✅ `sam2_hiera_l.yaml` - SAM-2 config
- ✅ `.env` - Environment variables (OPENAI_API_KEY set)

**Total size: ~1.5GB**

## Quick Start

### 1. Install Dependencies

```bash
cd python_backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # macOS/Linux

# Install
pip install -r requirements.txt
```

**Note**: This will install:
- FastAPI + Uvicorn (web server)
- PyTorch (~5GB download)
- Transformers, SAM-2, GroundingDINO (~2GB download)
- Other ML dependencies

**Total download: ~8GB** (mainly PyTorch)

### 2. Start Server

```bash
./start.sh
```

Should see:
```
🚀 Starting Python Cropper Server...
✅ Starting FastAPI server...
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 3. Start Next.js (in separate terminal)

```bash
cd /Users/levit/Desktop/mvp
env -u OPENAI_API_KEY npm run dev
```

### 4. Test

1. Visit `http://localhost:3000`
2. Upload an image
3. Select categories
4. Check logs for:
   - `✂️ Calling Python cropper API...`
   - `✅ Image cropped successfully`

## API Endpoints

- `GET /` - Health check
- `POST /crop` - Crop image based on categories
  - Request: `{ imageUrl: string, categories: string[] }`
  - Response: `{ croppedImageUrl: string }`

## Current Structure

```
python_backend/
├── api/
│   └── server.py           ← FastAPI server
├── src/
│   ├── analyzers/
│   │   └── gpt4o_analyzer.py
│   └── core/
│       └── main_pipeline.py
├── configs/
│   └── GroundingDINO_SwinT_OGC.py
├── GroundingDINO/         ← Repository
├── data/
│   └── weights/
│       ├── groundingdino_swint_ogc.pth
│       └── sam2_hiera_large.pt
├── custom_item_cropper.py ← Main script
├── crop_api.py           ← API wrapper
├── sam2_hiera_l.yaml
├── requirements.txt
├── .env
└── start.sh
```

## How It Works

1. **Receive request** with `imageUrl` and `categories`
2. **Download image** from URL to temp file
3. **Analyze** with GPT-4o to understand what items are in the image
4. **Detect** with GroundingDINO to find bounding boxes
5. **Segment** with SAM-2 to extract precise masks
6. **Crop** the fashion items
7. **Upload** to imgbb (returns new URL)
8. **Return** the cropped image URL

## Troubleshooting

**Import errors:**
```bash
pip install -r requirements.txt
```

**Missing weights:**
- Check `python_backend/data/weights/` contains both .pth files

**GroundingDINO not found:**
- Check `python_backend/GroundingDINO/` exists

**SAM-2 imports fail:**
```bash
pip install segment-anything
```

**Server won't start:**
- Check Python version: `python3 --version` (need 3.8+)
- Activate venv: `source venv/bin/activate`

## Next Steps

Once both servers are running, test the full flow:

```bash
# Terminal 1
cd python_backend && ./start.sh

# Terminal 2  
cd mvp && env -u OPENAI_API_KEY npm run dev
```

Visit http://localhost:3000 and upload an image!
