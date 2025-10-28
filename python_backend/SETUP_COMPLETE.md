# Python Backend Setup Complete ✅

## What Was Created

### ✅ Files Created
- `api/server.py` - FastAPI server
- `crop_api.py` - Wrapper for image cropping
- `requirements.txt` - All dependencies
- `start.sh` - Startup script
- `.env` - Environment variables (needs OPENAI_API_KEY)

### ✅ Files Copied from fashion_crop_bakeoff_v7_gallery
- `custom_item_cropper.py` - Main cropper logic
- `src/analyzers/gpt4o_analyzer.py` - GPT-4o analysis
- `src/core/main_pipeline.py` - Core pipeline
- `configs/` - Configuration files
- `sam2_hiera_l.yaml` - SAM-2 config

### ✅ Next.js Integration
- Updated `app/api/search/route.ts` to call Python cropper
- Added graceful fallback if Python server not running
- Added `PYTHON_CROPPER_URL` to `.env`

## Next Steps

### 1. Install Python Dependencies

```bash
cd python_backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

**Note**: The weights and GroundingDINO/sam2 repos are large (~4GB). You may need to:
- Copy them from fashion_crop_bakeoff_v7_gallery, OR
- Use Docker for production

### 2. Copy Model Weights (Required)

From `/Users/levit/Desktop/fashion_crop_bakeoff_v7_gallery`:

```bash
# Create weights directory
mkdir -p python_backend/data/weights

# Copy weights (if they fit)
cp data/weights/*.pth python_backend/data/weights/
cp data/weights/*.pt python_backend/data/weights/

# Or copy large repos (optional, can use Docker instead)
cp -r GroundingDINO python_backend/
cp -r sam2 python_backend/
```

### 3. Update .env

Edit `python_backend/.env`:
```bash
OPENAI_API_KEY=your_actual_openai_key_here
```

Copy from `mvp/.env` if available.

### 4. Start the Servers

**Terminal 1 - Python Backend:**
```bash
cd /Users/levit/Desktop/mvp/python_backend
./start.sh
```

Should see:
```
🚀 Starting Python Cropper Server...
✅ Starting FastAPI server...
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Terminal 2 - Next.js:**
```bash
cd /Users/levit/Desktop/mvp
env -u OPENAI_API_KEY npm run dev
```

### 5. Test the Integration

Visit `http://localhost:3000` and upload an image. Check logs:

**Python terminal should show:**
```
📥 Received crop request:
   Image URL: https://...
   Categories: ['tops']
✅ Cropped successfully: ...
```

**Next.js terminal should show:**
```
✂️ Calling Python cropper API...
✅ Image cropped successfully
📡 Calling Serper Lens API with image: ...
```

## Current Flow

```
User uploads image
    ↓
Imgbb (upload to cloud)
    ↓
Next.js calls Python: POST http://localhost:8000/crop
    ↓
Python downloads image, crops it, returns cropped URL
    ↓
Next.js sends cropped image to Serper Lens
    ↓
GPT-4 parses results → product links
    ↓
Return to user
```

## Troubleshooting

**"Cropper not available" in logs:**
- Check if `configs/GroundingDINO_SwinT_OGC.py` exists
- Check if weights are in `data/weights/`
- Check if GroundingDINO and sam2 repos are copied

**"Connection refused" when calling cropper:**
- Make sure `./start.sh` is running in python_backend/
- Check port 8000 is available

**Weights not found:**
- The weights (~3.2GB) are in fashion_crop_bakeoff_v7_gallery/data/weights/
- Copy them to python_backend/data/weights/

## Next: Copy Large Files

The remaining large files to copy:
- `GroundingDINO/` (if not using Docker)
- `sam2/` (if not using Docker)  
- `data/weights/*.pth` and `*.pt` (required)

Would you like me to copy these now?

