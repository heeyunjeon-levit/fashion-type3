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

# Lazy initialization - don't initialize at import time
# Modal secrets are only available when functions run, not at module import
try:
    print("🔧 Importing crop_api module...")
    from crop_api import crop_image_from_url, get_cropper, analyze_image_only, analyze_and_crop_all
    print("✅ crop_api module imported successfully")
    CROPPER_AVAILABLE = None  # Will be initialized on first request
except (ImportError, Exception) as e:
    print(f"⚠️ Failed to import crop_api: {e}")
    import traceback
    traceback.print_exc()
    print("⚠️ Using mock mode (returns original URL)")
    CROPPER_AVAILABLE = False
    crop_image_from_url = None
    get_cropper = None
    analyze_image_only = None
    analyze_and_crop_all = None

# Global variable to store cropper instance after lazy init
_cropper_instance = None

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
    imageUrl: Optional[str] = None  # URL to image (optional if imageBase64 provided)
    imageBase64: Optional[str] = None  # Base64 encoded image (optional if imageUrl provided)
    categories: List[str]
    count: Optional[int] = None  # Number of instances to find (defaults to len(categories) if not specified)


class CropResponse(BaseModel):
    croppedImageUrl: Optional[str] = None
    croppedImageUrls: Optional[List[str]] = None


class AnalyzeRequest(BaseModel):
    imageUrl: str  # URL to uploaded image


class DetectedItem(BaseModel):
    category: str  # e.g., "tops", "bottoms", "bag"
    groundingdino_prompt: str  # e.g., "gray shirt"
    description: str  # Detailed description
    croppedImageUrl: Optional[str] = None  # URL to cropped image
    confidence: Optional[float] = None  # Detection confidence (0-1)


class TimingData(BaseModel):
    gpt4o_seconds: float
    groundingdino_seconds: float
    download_seconds: float
    processing_seconds: float
    upload_seconds: float
    overhead_seconds: float
    total_seconds: float


class AnalyzeResponse(BaseModel):
    items: List[DetectedItem]
    cached: bool  # Whether result was from cache
    timing: Optional[TimingData] = None  # Backend timing data


def _lazy_init_cropper():
    """Lazy initialize cropper on first request (when Modal secrets are available)"""
    global _cropper_instance, CROPPER_AVAILABLE
    
    if CROPPER_AVAILABLE is None:  # First time initialization
        try:
            print("🔧 Lazy initializing cropper (secrets should now be available)...")
            _cropper_instance = get_cropper()
            CROPPER_AVAILABLE = _cropper_instance is not None
            print(f"🔧 Cropper initialization: {'SUCCESS' if CROPPER_AVAILABLE else 'FAILED'}")
        except Exception as e:
            print(f"❌ Cropper initialization failed: {e}")
            import traceback
            traceback.print_exc()
            CROPPER_AVAILABLE = False
            _cropper_instance = None
    
    return CROPPER_AVAILABLE

@app.get("/")
async def root():
    cropper_available = _lazy_init_cropper()
    return {
        "status": "online",
        "cropper_available": cropper_available,
        "endpoint": "/crop"
    }

@app.get("/debug")
async def debug():
    """Debug endpoint to check environment and errors"""
    import os
    
    # Try to initialize and catch the error
    error_info = None
    try:
        _lazy_init_cropper()
    except Exception as e:
        error_info = str(e)
    
    return {
        "cropper_available": CROPPER_AVAILABLE,
        "cropper_instance": _cropper_instance is not None,
        "has_openai_key": "OPENAI_API_KEY" in os.environ,
        "has_supabase_url": "NEXT_PUBLIC_SUPABASE_URL" in os.environ,
        "error": error_info,
        "python_path": sys.path[:5],
        "cwd": os.getcwd()
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_image(request: AnalyzeRequest):
    """
    Analyze image with GPT-4o AND crop all detected items.
    This runs immediately after upload to show users what was found.
    Results include cropped image URLs for visual selection.
    
    Args:
        request: AnalyzeRequest with imageUrl
        
    Returns:
        Detected items with categories and cropped images
    """
    try:
        # Lazy initialize cropper on first request
        _lazy_init_cropper()
        
        print(f"\n{'='*80}")
        print(f"🔍 ANALYZE + CROP REQUEST RECEIVED")
        print(f"   Image URL: {request.imageUrl}")
        print(f"   CROPPER_AVAILABLE: {CROPPER_AVAILABLE}")
        print(f"{'='*80}\n")
        
        if CROPPER_AVAILABLE and analyze_and_crop_all:
            print("✅ Analyzing and cropping image...")
            result = analyze_and_crop_all(request.imageUrl)
            print(f"✅ Complete: {len(result['items'])} items detected and cropped")
            return AnalyzeResponse(**result)
        else:
            print(f"⚠️ MOCK MODE: analyze not available")
            return AnalyzeResponse(items=[], cached=False)
            
    except Exception as e:
        print(f"❌ Analysis error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
        # Lazy initialize cropper on first request
        _lazy_init_cropper()
        
        # Validate input
        if not request.imageUrl and not request.imageBase64:
            raise ValueError("Either imageUrl or imageBase64 must be provided")
        
        # Default count to number of categories if not specified
        count = request.count if request.count is not None else len(request.categories)
        
        print(f"\n{'='*80}")
        print(f"📥 CROP REQUEST RECEIVED")
        print(f"   Image URL: {request.imageUrl if request.imageUrl else '[base64 provided]'}")
        print(f"   Categories: {request.categories}")
        print(f"   Count: {count} (requested: {request.count}, categories: {len(request.categories)})")
        print(f"   CROPPER_AVAILABLE: {CROPPER_AVAILABLE}")
        print(f"   crop_image_from_url: {crop_image_from_url}")
        print(f"{'='*80}\n")
        
        if CROPPER_AVAILABLE and crop_image_from_url:
            print("✅ Cropper available, calling crop_image_from_url...")
            # Call the actual cropper (handles both URL and base64)
            result = crop_image_from_url(
                image_url=request.imageUrl,
                image_base64=request.imageBase64,
                categories=request.categories,
                count=count
            )
            print(f"✅ Cropped successfully: {result}")
            
            # Handle both dict (multiple URLs) and string (single URL) responses
            if isinstance(result, dict):
                return CropResponse(**result)
            else:
                return CropResponse(croppedImageUrl=result)
        else:
            # Mock mode - return original URL
            print(f"⚠️ MOCK MODE: CROPPER_AVAILABLE={CROPPER_AVAILABLE}, crop_image_from_url={crop_image_from_url}")
            print("⚠️ Returning original URL")
            return CropResponse(croppedImageUrl=request.imageUrl)
            
    except Exception as e:
        print(f"❌ Crop error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

