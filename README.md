---
title: Fashion Crop API
emoji: 🖼️
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# Fashion Crop API

FastAPI service for cropping fashion items from images using GroundingDINO and SAM-2.

## Features

- 🎯 **Smart Cropping** - Automatically detects and crops fashion items
- 🚀 **GPU Accelerated** - Uses A10G GPU for fast processing
- 📦 **Multiple Items** - Handles multiple instances of the same category
- 🌐 **Production Ready** - FastAPI with CORS support

## API Endpoints

### Health Check
```
GET /
```

### Crop Image
```
POST /crop
```

**Request Body:**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "categories": ["top", "bottom"],
  "count": 1
}
```

**Response:**
```json
{
  "croppedImageUrl": "https://example.com/cropped.jpg"
}
```

## Environment Variables

Set these in your Space settings:

- `OPENAI_API_KEY` - OpenAI API key for GPT-4o analysis
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `USE_SAM2` - Set to `false` for faster bounding-box-only cropping

## Usage

```python
import requests

response = requests.post(
    "https://YOUR_USERNAME-fashion-crop-api.hf.space/crop",
    json={
        "imageUrl": "https://example.com/image.jpg",
        "categories": ["top"],
        "count": 1
    }
)

print(response.json())
```

## Model Information

- **GroundingDINO**: Object detection (open-vocabulary)
- **SAM-2**: Image segmentation (optional, disabled by default)
- **GPT-4o**: Natural language analysis for item descriptions

## Performance

- **Cold Start**: ~30-60s (first request)
- **Warm Start**: ~5-10s
- **Crop Time**: ~8-12s per item (with GPU)
