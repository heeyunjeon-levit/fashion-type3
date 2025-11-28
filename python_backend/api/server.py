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
    use_dinox: Optional[bool] = False  # Use DINO-X instead of GPT-4o


class DetectRequest(BaseModel):
    imageUrl: str  # URL to uploaded image


class BboxItem(BaseModel):
    id: str  # Unique identifier for this bbox
    bbox: List[float]  # [x1, y1, x2, y2]
    category: str  # Raw category from detector (e.g., "shirt")
    mapped_category: str  # Mapped to our categories (e.g., "top")
    confidence: float  # Detection confidence (0-1)


class DetectResponse(BaseModel):
    bboxes: List[BboxItem]
    image_size: List[int]  # [width, height]
    processing_time: float  # Seconds


class ProcessItemRequest(BaseModel):
    imageUrl: str  # URL to uploaded image
    bbox: List[float]  # [x1, y1, x2, y2]
    category: str  # Category from detection


class ProcessItemResponse(BaseModel):
    description: str  # Detailed description from GPT-4o-mini
    croppedImageUrl: str  # URL to cropped image
    category: str  # Mapped category
    processing_time: float  # Seconds


class DetectedItem(BaseModel):
    category: str  # e.g., "tops", "bottoms", "bag"
    groundingdino_prompt: str  # e.g., "gray shirt"
    description: str  # Detailed description
    croppedImageUrl: Optional[str] = None  # URL to cropped image
    confidence: Optional[float] = None  # Detection confidence (0-1)


class TimingData(BaseModel):
    # Chronological order of pipeline operations:
    download_seconds: float
    gpt4o_seconds: float
    groundingdino_seconds: float
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


@app.post("/detect", response_model=DetectResponse)
async def detect_items(request: DetectRequest):
    """
    Fast DINO-X detection - returns only bounding boxes without descriptions or cropping.
    Perfect for interactive UX where user selects items first.
    
    Speed: ~6-7s (vs 15-20s for full analyze+crop)
    
    Args:
        request: DetectRequest with imageUrl
        
    Returns:
        Bounding boxes with categories for interactive selection
    """
    try:
        print(f"\n{'='*80}")
        print(f"⚡ FAST DETECT REQUEST RECEIVED")
        print(f"   Image URL: {request.imageUrl}")
        print(f"{'='*80}\n")
        
        # Import the fast detection function
        from src.analyzers.dinox_analyzer import detect_bboxes_only
        
        # Run fast detection
        print("✅ Running DINO-X fast detection...")
        result = detect_bboxes_only(request.imageUrl)
        
        print(f"✅ Detection complete: {len(result['bboxes'])} items found in {result['meta']['processing_time']}s")
        
        return DetectResponse(
            bboxes=result['bboxes'],
            image_size=result['image_size'],
            processing_time=result['meta']['processing_time']
        )
            
    except Exception as e:
        print(f"❌ Detection error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process-item", response_model=ProcessItemResponse)
async def process_item(request: ProcessItemRequest):
    """
    Process a single selected item: get description and crop.
    Called after user selects a bbox from /detect results.
    
    Speed: ~2-3s per item (only process what user wants!)
    
    Args:
        request: ProcessItemRequest with imageUrl, bbox, and category
        
    Returns:
        Detailed description and cropped image URL
    """
    try:
        import time
        start_time = time.time()
        
        print(f"\n{'='*80}")
        print(f"🎯 PROCESS ITEM REQUEST RECEIVED")
        print(f"   Image URL: {request.imageUrl}")
        print(f"   BBox: {request.bbox}")
        print(f"   Category: {request.category}")
        print(f"{'='*80}\n")
        
        # Lazy initialize cropper
        _lazy_init_cropper()
        
        # Import necessary functions
        from src.analyzers.dinox_analyzer import map_dinox_category
        from PIL import Image
        import requests
        from io import BytesIO
        import base64
        
        # Get detailed description with GPT-4o-mini
        print("✅ Getting detailed description with GPT-4o-mini...")
        
        # Load image
        response = requests.get(request.imageUrl, timeout=30)
        image = Image.open(BytesIO(response.content))
        
        # Convert to base64 for GPT
        buffered = BytesIO()
        image.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Get OpenAI client
        try:
            from openai import OpenAI
            openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
            
            prompt = f"""You are a fashion expert. Describe this {request.category} in detail like a fashion catalog would:
- Color and tone
- Material/fabric (if visible)
- Style details
- Fit/silhouette

Be specific and detailed. Return ONLY the description text, no JSON or extra formatting."""
            
            gpt_start = time.time()
            gpt_response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{img_base64}"
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ],
                max_tokens=200,
                temperature=0.3
            )
            
            description = gpt_response.choices[0].message.content.strip()
            print(f"✅ Description generated in {time.time() - gpt_start:.2f}s: {description[:60]}...")
            
        except Exception as e:
            print(f"⚠️ GPT-4o-mini failed: {e}, using simple category")
            description = request.category
        
        # Crop the item using bbox coordinates
        print(f"✅ Cropping item with bbox: {request.bbox}...")
        
        # Crop using the provided bbox coordinates
        x1, y1, x2, y2 = request.bbox
        cropped_image = image.crop((x1, y1, x2, y2))
        
        print(f"   Original size: {image.size}, Cropped size: {cropped_image.size}")
        
        # Save cropped image to bytes
        cropped_buffer = BytesIO()
        cropped_image.save(cropped_buffer, format='JPEG', quality=90)
        cropped_buffer.seek(0)
        
        # Upload to Supabase
        print("✅ Uploading cropped image to Supabase...")
        from crop_api import upload_image_to_supabase
        
        # Generate unique filename
        import uuid
        from datetime import datetime
        timestamp = int(datetime.now().timestamp() * 1000)
        filename = f"cropped_{request.category}_{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
        
        try:
            cropped_url = upload_image_to_supabase(
                cropped_buffer.getvalue(),
                filename
            )
            print(f"✅ Cropped image uploaded: {cropped_url[:80]}...")
        except Exception as upload_error:
            print(f"⚠️ Failed to upload cropped image: {upload_error}")
            # Fallback to original image if upload fails
            cropped_url = request.imageUrl
        
        elapsed = time.time() - start_time
        print(f"✅ Item processed in {elapsed:.2f}s")
        
        return ProcessItemResponse(
            description=description,
            croppedImageUrl=cropped_url,
            category=map_dinox_category(request.category),
            processing_time=elapsed
        )
            
    except Exception as e:
        print(f"❌ Process item error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
        print(f"   Use DINO-X: {request.use_dinox}")
        print(f"   CROPPER_AVAILABLE: {CROPPER_AVAILABLE}")
        print(f"{'='*80}\n")
        
        if CROPPER_AVAILABLE and analyze_and_crop_all:
            # Temporarily set USE_DINOX environment variable if requested
            old_use_dinox = os.environ.get('USE_DINOX')
            if request.use_dinox:
                os.environ['USE_DINOX'] = 'true'
                print("🚀 Using DINO-X for detection")
            
            try:
                print("✅ Analyzing and cropping image...")
                result = analyze_and_crop_all(request.imageUrl)
                print(f"✅ Complete: {len(result['items'])} items detected and cropped")
                return AnalyzeResponse(**result)
            finally:
                # Restore original USE_DINOX value
                if request.use_dinox:
                    if old_use_dinox is None:
                        os.environ.pop('USE_DINOX', None)
                    else:
                        os.environ['USE_DINOX'] = old_use_dinox
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


class OCRSearchRequest(BaseModel):
    imageUrl: str  # URL to uploaded image
    

class ProductResult(BaseModel):
    product: dict
    search_result: dict


class OCRSearchResponse(BaseModel):
    success: bool
    product_results: Optional[List[ProductResult]] = None
    mapping: Optional[dict] = None
    summary: Optional[dict] = None
    reason: Optional[str] = None


@app.post("/ocr-search", response_model=OCRSearchResponse)
async def ocr_search(request: OCRSearchRequest):
    """
    V3.1 OCR-based product search pipeline.
    Uses OCR + Visual Search + Priority Text Search + GPT Selection.
    
    This is a gradual integration - can be toggled on/off in the frontend.
    
    Args:
        request: OCRSearchRequest with imageUrl
        
    Returns:
        Product results with brands, links, thumbnails, and GPT reasoning
    """
    try:
        print(f"\n{'='*80}")
        print(f"🔍 OCR SEARCH REQUEST RECEIVED (V3.1)")
        print(f"   Image URL: {request.imageUrl}")
        print(f"{'='*80}\n")
        
        # Import V3.1 pipeline (lazy import to avoid loading if not used)
        from ocr_search_pipeline import EnhancedHybridPipelineV2
        
        # Initialize and run
        print("✅ Initializing V3.1 pipeline...")
        pipeline = EnhancedHybridPipelineV2()
        
        print("✅ Processing image...")
        result = pipeline.process_image_url(request.imageUrl)
        
        print(f"✅ OCR search complete: {result.get('success')}")
        
        # Format response
        if result.get('success'):
            return OCRSearchResponse(
                success=True,
                product_results=result.get('product_results', []),
                mapping=result.get('mapping', {}),
                summary=result.get('summary', {})
            )
        else:
            return OCRSearchResponse(
                success=False,
                reason=result.get('reason', 'Unknown error')
            )
            
    except Exception as e:
        print(f"❌ OCR search error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

