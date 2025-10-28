"""
FastAPI server for fashion item cropping.
Receives image URL and categories, returns cropped image URL.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Union
import os
import sys

# Add parent directory to path so we can import from src
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Try to import the cropper, but handle gracefully if not available yet
try:
    from crop_api import crop_image_from_url, get_cropper
    CROPPER_AVAILABLE = get_cropper() is not None
except (ImportError, Exception) as e:
    print(f"⚠️ Custom item cropper not available: {e}")
    print("⚠️ Using mock mode (returns original URL)")
    CROPPER_AVAILABLE = False
    crop_image_from_url = None

app = FastAPI(title="Fashion Crop API")

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CropRequest(BaseModel):
    imageUrl: str
    categories: List[str]
    count: int = 1  # Number of instances to find


class CropResponse(BaseModel):
    croppedImageUrl: Optional[str] = None
    croppedImageUrls: Optional[List[str]] = None


@app.get("/")
async def root():
    return {
        "status": "online",
        "cropper_available": CROPPER_AVAILABLE,
        "endpoint": "/crop"
    }


@app.post("/crop", response_model=CropResponse)
async def crop_image(request: CropRequest):
    """
    Crop image based on categories.
    
    Args:
        request: CropRequest with imageUrl and categories
        
    Returns:
        Cropped image URL
    """
    try:
        print(f"📥 Received crop request:")
        print(f"   Image URL: {request.imageUrl}")
        print(f"   Categories: {request.categories}")
        
        if CROPPER_AVAILABLE and crop_image_from_url:
            # Call the actual cropper
            result = crop_image_from_url(
                image_url=request.imageUrl,
                categories=request.categories,
                count=request.count
            )
            print(f"✅ Cropped successfully: {result}")
            
            # Handle both dict (multiple URLs) and string (single URL) responses
            if isinstance(result, dict):
                return CropResponse(**result)
            else:
                return CropResponse(croppedImageUrl=result)
        else:
            # Mock mode - return original URL
            print("⚠️ Mock mode: returning original URL")
            return CropResponse(croppedImageUrl=request.imageUrl)
            
    except Exception as e:
        print(f"❌ Crop error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

