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
    from crop_api import crop_image_from_url, get_cropper
    print("✅ crop_api module imported successfully")
    CROPPER_AVAILABLE = None  # Will be initialized on first request
    analyze_image_only = None
    analyze_and_crop_all = None
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
        
        # Use existing analyze_image_with_dinox and filter results
        from src.analyzers.dinox_analyzer import analyze_image_with_dinox
        
        # Run DINO-X analysis
        print("✅ Running DINO-X detection...")
        analysis_result = analyze_image_with_dinox(request.imageUrl)
        
        # Import category mapping function
        from src.analyzers.dinox_analyzer import map_dinox_category
        
        # Filter items by confidence threshold (increased to reduce false positives)
        CONFIDENCE_THRESHOLD = 0.45  # Increased from 0.40 to focus on main subject
        items = analysis_result.get('items', [])
        total_detections = len(items)
        
        # Problematic categories that often produce false positives (socks detected as leggings, etc.)
        EXCLUDED_CATEGORIES = ['leggings', 'tights', 'stockings']
        
        print(f"📦 DINO-X detected {total_detections} total items")
        
        # Calculate image dimensions for main subject filtering
        # Assume normalized coordinates [0, 1] if no image size provided
        image_center_x = 0.5
        image_center_y = 0.5
        
        # Filter by confidence and convert to bbox format
        bboxes_with_scores = []
        for idx, item in enumerate(items):
            confidence = item.get('confidence', 0.0)
            
            # Apply confidence filter
            if confidence < CONFIDENCE_THRESHOLD:
                print(f"   ⏭️  Skipping low-confidence: {item.get('category', 'unknown')} ({confidence:.2f})")
                continue
            
            # Get raw and mapped categories
            raw_category = item.get('groundingdino_prompt', item.get('category', 'unknown'))
            mapped_cat = item.get('category', 'unknown')  # This is already mapped from analyze_image_with_dinox
            
            # Filter out problematic categories (often confused with socks, etc.)
            if raw_category.lower() in EXCLUDED_CATEGORIES:
                print(f"   🚫 Excluding problematic category: {raw_category} (often confused with socks)")
                continue
            
            # Calculate bbox properties for main subject filtering
            bbox = item.get('bbox', [])
            if len(bbox) == 4:
                x1, y1, x2, y2 = bbox
                bbox_width = abs(x2 - x1)
                bbox_height = abs(y2 - y1)
                bbox_area = bbox_width * bbox_height
                
                # Calculate distance from center (normalized)
                bbox_center_x = (x1 + x2) / 2
                bbox_center_y = (y1 + y2) / 2
                distance_from_center = ((bbox_center_x - image_center_x) ** 2 + 
                                       (bbox_center_y - image_center_y) ** 2) ** 0.5
                
                # Calculate main subject score:
                # - Larger items score higher (bbox_area)
                # - More centered items score higher (1 - distance_from_center)
                # - Higher confidence scores higher
                centrality_score = max(0, 1 - distance_from_center * 2)  # Penalize distance
                size_score = min(1, bbox_area * 10)  # Normalize area (assuming coords 0-1)
                main_subject_score = (confidence * 0.4 + centrality_score * 0.35 + size_score * 0.25)
                
                print(f"   📊 {raw_category}: conf={confidence:.2f}, area={bbox_area:.3f}, center_dist={distance_from_center:.2f}, score={main_subject_score:.2f}")
            else:
                # If bbox format is invalid, use confidence only
                main_subject_score = confidence * 0.4
            
            # Create bbox item with score
            bbox_item = {
                'id': f"{mapped_cat}_{idx}",
                'bbox': bbox,
                'category': raw_category,  # Raw category from detector
                'mapped_category': mapped_cat,  # Mapped category
                'confidence': round(confidence, 3),
                'main_subject_score': round(main_subject_score, 3)
            }
            bboxes_with_scores.append(bbox_item)
        
        # Filter out background items: only keep items with score >= 0.35
        MAIN_SUBJECT_THRESHOLD = 0.35
        bboxes = [b for b in bboxes_with_scores if b['main_subject_score'] >= MAIN_SUBJECT_THRESHOLD]
        
        # Sort by main subject score (highest first)
        bboxes.sort(key=lambda x: x['main_subject_score'], reverse=True)
        
        # Limit to top 8 items to avoid clutter
        MAX_ITEMS = 8
        if len(bboxes) > MAX_ITEMS:
            print(f"   ⚠️  Limiting to top {MAX_ITEMS} items (from {len(bboxes)})")
            bboxes = bboxes[:MAX_ITEMS]
        
        # Log final items
        for bbox_item in bboxes:
            print(f"   ✅ {bbox_item['mapped_category']} ({bbox_item['category']}, score: {bbox_item['main_subject_score']:.2f})")
        
        filtered_count = len(bboxes)
        processing_time = analysis_result.get('meta', {}).get('processing_time', 0.0)
        
        print(f"✅ Detection complete: {filtered_count}/{total_detections} items (conf ≥{CONFIDENCE_THRESHOLD}, main_subject ≥{MAIN_SUBJECT_THRESHOLD})")
        
        # Get image size (default to 0,0 if not available)
        image_size = [0, 0]
        
        return DetectResponse(
            bboxes=bboxes,
            image_size=image_size,
            processing_time=processing_time
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
        
        # Crop using the provided bbox coordinates with smart adjustments
        x1, y1, x2, y2 = request.bbox
        
        # Smart cropping: For tops, reduce bottom margin to avoid including pants
        # For bottoms, reduce top margin to avoid including tops
        category_lower = request.category.lower()
        
        # Define top keywords (including raw detector categories)
        top_keywords = ['top', 'shirt', 'jacket', 'coat', 'sweater', 'hoodie', 'blouse', 
                       'cardigan', 'blazer', 'vest', 'button up', 't-shirt', 'tshirt',
                       'sweatshirt', 'pullover', 'outerwear']
        
        # Define bottom keywords
        bottom_keywords = ['bottom', 'pant', 'jean', 'short', 'skirt', 'trouser', 'slack']
        
        is_top = any(keyword in category_lower for keyword in top_keywords)
        is_bottom = any(keyword in category_lower for keyword in bottom_keywords)
        
        if is_top:
            # For tops: crop tighter on the bottom to exclude pants/bottoms
            # Reduce height by 15% from bottom to ensure we don't capture pants
            height = y2 - y1
            y2 = y2 - (height * 0.15)  # Cut off bottom 15%
            print(f"   🎯 Top category '{request.category}': Cropping tighter on bottom to exclude pants")
            
        elif is_bottom:
            # For bottoms: crop tighter on the top to exclude tops
            # Reduce from top by 10% to ensure we don't capture tops
            height = y2 - y1
            y1 = y1 + (height * 0.10)  # Cut off top 10%
            print(f"   🎯 Bottom category '{request.category}': Cropping tighter on top to exclude tops")
        
        cropped_image = image.crop((x1, y1, x2, y2))
        
        print(f"   Original size: {image.size}, Cropped size: {cropped_image.size}")
        
        # Save cropped image to bytes
        cropped_buffer = BytesIO()
        cropped_image.save(cropped_buffer, format='JPEG', quality=90)
        cropped_buffer.seek(0)
        
        # Try Supabase first, but use data URL as fallback for speed
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
            import traceback
            traceback.print_exc()
            # Use data URL as fallback for immediate display
            print("📸 Creating data URL for cropped image...")
            cropped_base64 = base64.b64encode(cropped_buffer.getvalue()).decode('utf-8')
            cropped_url = f"data:image/jpeg;base64,{cropped_base64}"
            print(f"✅ Data URL created ({len(cropped_base64)} chars)")
        
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


@app.get("/ocr-search-stream")
async def ocr_search_stream(imageUrl: str):
    """
    V3.1 OCR search with Server-Sent Events for real-time progress.
    
    Returns streaming progress updates followed by final results.
    """
    from fastapi.responses import StreamingResponse
    import asyncio
    import json
    
    async def event_generator():
        try:
            print(f"\n{'='*80}")
            print(f"🔍 OCR SEARCH STREAM REQUEST")
            print(f"   Image URL: {imageUrl}")
            print(f"{'='*80}\n")
            
            # Import V3.1 pipeline
            from ocr_search_pipeline import EnhancedHybridPipelineV2
            
            # Store progress updates
            progress_data = {'progress': 0, 'message': '시작...'}
            
            def progress_callback(progress, message):
                """Callback to capture progress updates"""
                progress_data['progress'] = progress
                progress_data['message'] = message
                print(f"📊 Progress: {progress}% - {message}")
            
            # Initialize pipeline with progress callback
            pipeline = EnhancedHybridPipelineV2(progress_callback=progress_callback)
            
            # Run pipeline in a thread to allow async progress updates
            import concurrent.futures
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            future = executor.submit(pipeline.process_image_url, imageUrl)
            
            # Stream progress updates
            last_progress = 0
            while not future.done():
                current_progress = progress_data['progress']
                if current_progress > last_progress:
                    yield f"data: {json.dumps({'type': 'progress', 'progress': current_progress, 'message': progress_data['message']})}\n\n"
                    last_progress = current_progress
                await asyncio.sleep(0.5)
            
            # Get final result
            result = future.result()
            
            # Send final progress
            yield f"data: {json.dumps({'type': 'progress', 'progress': 100, 'message': '완료!'})}\n\n"
            
            # Send results
            if result.get('success'):
                yield f"data: {json.dumps({'type': 'complete', 'success': True, 'results': result})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'complete', 'success': False, 'reason': result.get('reason')})}\n\n"
                
        except Exception as e:
            print(f"❌ OCR stream error: {e}")
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


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

