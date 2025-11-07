"""
GPU-accelerated Crop API using HuggingFace Transformers GroundingDINO
Simple, clean, and fast!
"""
import os
import sys
import time
import tempfile
import shutil
from typing import List, Optional, Dict
from datetime import datetime, timedelta

# Add /root to path for imports
if "/root" not in sys.path:
    sys.path.append("/root")

from custom_item_cropper import CustomItemCropper

# Global cropper instance
_cropper_instance = None

# GPT analysis cache (in-memory)
# Format: {image_url: {"result": gpt_result, "timestamp": datetime, "items": [...]}}
_gpt_cache: Dict[str, Dict] = {}
_cache_ttl_minutes = 10  # Cache expires after 10 minutes

def get_cropper():
    """Initialize and return the GPU cropper instance"""
    global _cropper_instance
    
    if _cropper_instance is None:
        print("⚙️  Initializing GPU cropper...")
        
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"📍 Device: {device}")
        
        try:
            _cropper_instance = CustomItemCropper(device=device)
            print("✅ GPU cropper initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize cropper: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    return _cropper_instance

def upload_image_to_supabase(image_bytes: bytes, original_filename: str = None) -> str:
    """Upload cropped image to Supabase"""
    import os
    from supabase import create_client
    from datetime import datetime
    
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("Supabase credentials not found in environment")
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Generate filename
    if original_filename:
        # Clean filename
        clean_name = original_filename.replace(' ', '_').replace('-', '_')
        filename = f"accessories_{clean_name.split('_crop')[0]}_{int(datetime.now().timestamp() * 1000)}.jpg"
    else:
        filename = f"crop_{int(datetime.now().timestamp() * 1000)}.jpg"
    
    # Upload to Supabase
    response = supabase.storage.from_("images").upload(
        filename,
        image_bytes,
        {"content-type": "image/jpeg"}
    )
    
    # Return public URL
    public_url = f"{supabase_url}/storage/v1/object/public/images/{filename}"
    return public_url

def _clean_cache():
    """Remove expired entries from cache"""
    global _gpt_cache
    now = datetime.now()
    expired_keys = [
        url for url, data in _gpt_cache.items()
        if (now - data["timestamp"]).total_seconds() > (_cache_ttl_minutes * 60)
    ]
    for key in expired_keys:
        del _gpt_cache[key]
    if expired_keys:
        print(f"🧹 Cleaned {len(expired_keys)} expired cache entries")

def analyze_image_only(image_url: str) -> dict:
    """
    Run GPT-4o analysis only (no cropping) and cache the result.
    This is called immediately after upload to pre-analyze the image.
    
    Args:
        image_url: Public URL of the uploaded image
        
    Returns:
        Dict with detected items:
        {
            "items": [
                {
                    "category": "tops",
                    "groundingdino_prompt": "gray shirt",
                    "description": "light gray long sleeve shirt"
                },
                ...
            ],
            "cached": false
        }
    """
    import requests
    from io import BytesIO
    from PIL import Image
    
    print(f"🔍 Analyzing image (GPT-only): {image_url}")
    
    # Check cache first
    _clean_cache()
    if image_url in _gpt_cache:
        print(f"✅ Using cached GPT result for {image_url}")
        return {
            "items": _gpt_cache[image_url]["items"],
            "cached": True
        }
    
    # Get cropper (for GPT analyzer access)
    cropper = get_cropper()
    if cropper is None:
        print("❌ Cropper not available")
        return {"items": [], "cached": False}
    
    # Download image
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    response = requests.get(image_url, headers=headers, timeout=30)
    response.raise_for_status()
    
    # Load image
    image = Image.open(BytesIO(response.content)).convert("RGB")
    print(f"✅ Image loaded: {image.size}")
    
    # Save temporarily for GPT analysis
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
        image.save(tmp_file.name, 'JPEG')
        temp_image_path = tmp_file.name
    
    try:
        # Run GPT-4o analysis
        print("🤖 Running GPT-4o analysis...")
        gpt_result = cropper.gpt_analyzer.analyze_fashion_items(temp_image_path)
    finally:
        # Clean up temp file
        if os.path.exists(temp_image_path):
            os.unlink(temp_image_path)
    
    if not gpt_result or 'items' not in gpt_result:
        print("❌ GPT analysis failed")
        return {"items": [], "cached": False}
    
    print(f"✅ GPT detected {len(gpt_result['items'])} items")
    
    # Map items to categories
    category_keywords = {
        'tops': ['shirt', 'blouse', 'sweater', 'top', 'tee', 'hoodie', 'jacket', 'cardigan', 'vest', 'coat'],
        'bottoms': ['pants', 'jeans', 'skirt', 'shorts', 'trousers', 'leggings'],
        'dress': ['dress', 'gown'],
        'shoes': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer'],
        'bag': ['bag', 'purse', 'backpack', 'tote', 'clutch', 'handbag'],
        'accessory': ['necklace', 'bracelet', 'earring', 'watch', 'hat', 'scarf', 'belt', 'sunglasses', 'ring', 'jewelry']
    }
    
    # Build result with categories
    categorized_items = []
    for item in gpt_result['items']:
        prompt_lower = item['groundingdino_prompt'].lower()
        desc_lower = item.get('description', '').lower()
        
        # Find matching category
        matched_category = None
        for category, keywords in category_keywords.items():
            if any(keyword in prompt_lower or keyword in desc_lower for keyword in keywords):
                matched_category = category
                break
        
        if matched_category:
            categorized_items.append({
                "category": matched_category,
                "groundingdino_prompt": item['groundingdino_prompt'],
                "description": item.get('description', '')
            })
            print(f"   ✅ {matched_category}: {item['groundingdino_prompt']}")
    
    # Cache the result
    _gpt_cache[image_url] = {
        "result": gpt_result,
        "items": categorized_items,
        "timestamp": datetime.now()
    }
    print(f"💾 Cached GPT result for {image_url}")
    
    return {
        "items": categorized_items,
        "cached": False
    }

def crop_image_from_url(
    image_url: str = None,
    image_base64: str = None,
    categories: List[str] = None,
    count: int = 1
) -> dict:
    """
    GPU-accelerated crop using transformers GroundingDINO
    
    Args:
        image_url: Public URL of the image
        image_base64: Base64 encoded image (alternative to URL)
        categories: List of categories like ["tops", "bottoms", "shoes"]
        count: Number of instances to find
        
    Returns:
        Dict with croppedImageUrl or croppedImageUrls
    """
    start_time = time.time()
    
    # Validate input
    if not image_url and not image_base64:
        raise ValueError("Either image_url or image_base64 must be provided")
    
    print(f"📥 Processing image from {'URL' if image_url else 'base64'}")
    print(f"📋 Categories: {categories}")
    print(f"📊 Count: {count}")
    
    # Get cropper
    cropper = get_cropper()
    if cropper is None:
        print("⚠️ Cropper not available, returning original URL")
        return {"croppedImageUrl": image_url if image_url else None}
    
    # Convert categories to simple generic terms for GPT-4o
    category_map = {
        "tops": "top",
        "bottoms": "bottom",
        "bag": "bag",
        "bags": "bag",
        "shoes": "shoes",
        "accessory": "accessory",
        "accessories": "accessory",
        "dress": "dress"
    }
    
    # Generate item descriptions
    item_descriptions = []
    for cat in categories:
        base_term = category_map.get(cat, cat)
        item_descriptions.append(base_term)
    
    print(f"🔍 Requesting categories: {item_descriptions}")
    
    # Check cache for GPT result
    _clean_cache()
    cached_gpt_result = None
    if image_url and image_url in _gpt_cache:
        print("🚀 Found cached GPT result! Using it to skip GPT analysis...")
        cached_gpt_result = _gpt_cache[image_url]["result"]
    
    # Create output directory
    output_dir = tempfile.mkdtemp()
    
    try:
        # Crop items
        print(f"✂️  Starting crop operation...")
        t0 = time.time()
        
        result = cropper.crop_custom_items(
            image_url=image_url,
            custom_items=item_descriptions,
            output_dir=output_dir,
            cached_gpt_result=cached_gpt_result  # Pass cached result
        )
        
        print(f"⏱️  Crop completed in {time.time() - t0:.2f}s")
        print(f"📊 Result: {result}")
        
        # Get generated crops
        crops_dir = output_dir
        if os.path.exists(crops_dir):
            crops = sorted([
                f for f in os.listdir(crops_dir) 
                if f.endswith('_crop.jpg')
            ])
            
            print(f"📁 Found {len(crops)} crops: {crops}")
            
            if crops:
                # Upload all cropped images
                cropped_urls = []
                t0 = time.time()
                
                for crop_filename in crops:
                    cropped_path = os.path.join(crops_dir, crop_filename)
                    print(f"📤 Uploading: {crop_filename}")
                    
                    with open(cropped_path, 'rb') as f:
                        cropped_bytes = f.read()
                    
                    cropped_url = upload_image_to_supabase(cropped_bytes, original_filename=crop_filename)
                    cropped_urls.append(cropped_url)
                    print(f"✅ Uploaded: {cropped_url}")
                
                print(f"⏱️  Upload completed in {time.time() - t0:.2f}s")
                print(f"⏱️  TOTAL TIME: {time.time() - start_time:.2f}s")
                
                # Return results
                if len(cropped_urls) > 1:
                    return {"croppedImageUrls": cropped_urls}
                else:
                    return {"croppedImageUrl": cropped_urls[0]}
        
        print("⚠️ No crops found, returning original URL")
        return {"croppedImageUrl": image_url if image_url else None}
        
    except Exception as e:
        print(f"❌ Crop error: {e}")
        import traceback
        traceback.print_exc()
        return {"croppedImageUrl": image_url if image_url else None}
    
    finally:
        # Cleanup
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)

