# Integration Guide: Python Cropper

## What Was Set Up

✅ FastAPI server at `python_backend/api/server.py`  
✅ Next.js search route updated to call Python cropper  
✅ Environment variable `PYTHON_CROPPER_URL` added to `.env`  
✅ Graceful fallback if Python server is not running

## Next Steps

### 1. Copy Your Cropper Code

Copy these files from your `fashion_crop_bakeoff_v7_gallery` folder:

```bash
cd /Users/levit/Desktop/fashion_crop_bakeoff_v7_gallery

# Copy to MVP
cp custom_item_cropper.py ../mvp/python_backend/
cp -r src ../mvp/python_backend/
cp -r configs ../mvp/python_backend/
cp sam2_hiera_l.yaml ../mvp/python_backend/
cp requirements.txt ../mvp/python_backend/

# Copy large directories
cp -r GroundingDINO ../mvp/python_backend/
cp -r sam2 ../mvp/python_backend/

# Copy weights (if they fit)
mkdir -p ../mvp/python_backend/data/weights
cp data/weights/*.pth ../mvp/python_backend/data/weights/
cp data/weights/*.pt ../mvp/python_backend/data/weights/
```

### 2. Update Requirements

Add your cropper's dependencies to `python_backend/requirements.txt`:

```txt
torch
torchvision
transformers
# ... etc
```

### 3. Update the Server

Modify `python_backend/api/server.py` to integrate `custom_item_cropper.py`:

```python
from custom_item_cropper import crop_image_from_url

@app.post("/crop")
async def crop_image(request: CropRequest):
    cropped_url = crop_image_from_url(
        image_url=request.imageUrl,
        category_labels=request.categories
    )
    return CropResponse(croppedImageUrl=cropped_url)
```

### 4. Run Both Servers

**Terminal 1 - Python Backend:**
```bash
cd python_backend
./start.sh
```

**Terminal 2 - Next.js:**
```bash
cd /Users/levit/Desktop/mvp
env -u OPENAI_API_KEY npm run dev
```

## How It Works

```
User uploads image
    ↓
Imgbb (get public URL)
    ↓
Next.js API calls Python cropper (http://localhost:8000/crop)
    ↓
Python returns cropped image URL
    ↓
Serper Lens analyzes cropped image
    ↓
GPT-4 parses results → product links
    ↓
Return to user
```

## Testing

1. **Test Python cropper directly:**
```bash
curl -X POST http://localhost:8000/crop \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://...","categories":["tops"]}'
```

2. **Test full flow:**
   - Upload image in app
   - Check terminal logs for: `✂️ Calling Python cropper API...`
   - Should see: `✅ Image cropped successfully`

## Troubleshooting

- **Python server not found:** Make sure `./start.sh` is running
- **Import errors:** Install dependencies: `pip install -r requirements.txt`
- **Weights not found:** Download to `python_backend/data/weights/`
- **API errors:** Check `python_backend/api/server.py` logs

