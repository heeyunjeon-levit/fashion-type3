"""
API wrapper for FastAPI server to crop images from URLs.
Supports both Roboflow Inference API (GPU) and local cropper (CPU/GPU)
"""

import os
import time
import requests
import tempfile
import base64
from typing import List
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize the cropper (will be lazy-loaded)
_cropper_instance = None
_use_roboflow = os.getenv("USE_ROBOFLOW", "false").lower() == "true"
CPU_FALLBACK_URL = os.getenv("CPU_FALLBACK_URL")

print(f"⚙️  Cropper mode: {'Roboflow API' if _use_roboflow else 'Local'}")

def upload_image_to_supabase(image_bytes: bytes) -> str:
    """Upload image to Supabase storage and return URL"""
    from supabase import create_client

    supabase_url = os.getenv("SUPABASE_URL")
    # Try both possible key names
    supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY (or SUPABASE_ANON_KEY) must be set")

    supabase = create_client(supabase_url, supabase_key)

    # Generate unique filename
    timestamp = int(time.time() * 1000)
    filename = f"crop_{timestamp}.jpg"

    # Upload to Supabase storage
    try:
        response = supabase.storage.from_("images").upload(
            filename,
            image_bytes,
            {"content-type": "image/jpeg", "upsert": "false"}
        )

        # The response is a dict with 'path' on success or 'error' on failure
        if isinstance(response, dict) and 'error' in response:
            raise Exception(f"Supabase upload failed: {response.get('error')}")

        # Get public URL
        public_url = supabase.storage.from_("images").get_public_url(filename)
        return public_url

    except Exception as e:
        raise Exception(f"Failed to upload image to Supabase: {str(e)}")

def upload_image_to_imgbb(image_bytes: bytes) -> str:
    """Upload image to ImgBB and return URL"""
    api_key = os.getenv("IMGBB_API_KEY")
    
    if not api_key:
        raise ValueError("IMGBB_API_KEY must be set")
    
    # Convert bytes to base64
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
    
    # Upload to ImgBB
    url = "https://api.imgbb.com/1/upload"
    payload = {
        "key": api_key,
        "image": image_base64
    }
    
    response = requests.post(url, data=payload)
    response.raise_for_status()
    
    data = response.json()
    if data.get("success"):
        return data["data"]["url"]
    else:
        raise Exception(f"ImgBB upload failed: {data}")


def _fallback_to_cpu(image_url: str, categories: List[str], count: int):
    """Invoke CPU cropper backend when Roboflow returns no detections"""
    if not CPU_FALLBACK_URL:
        print("⚠️ CPU fallback URL not configured; skipping fallback")
        return None

    try:
        fallback_endpoint = CPU_FALLBACK_URL.rstrip('/') + '/crop'
        payload = {
            "imageUrl": image_url,
            "categories": categories,
            "count": count
        }
        print(f"🔁 Invoking CPU fallback at {fallback_endpoint} ...")
        response = requests.post(fallback_endpoint, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        print(f"✅ CPU fallback succeeded: {data}")
        return data
    except Exception as e:
        print(f"⚠️ CPU fallback failed: {e}")
        return None

def get_cropper():
    """Get or create the cropper instance (lazy loading)"""
    global _cropper_instance
    if _cropper_instance is None:
        if _use_roboflow:
            print("🔧 Initializing RoboflowItemCropper...")
            try:
                from roboflow_cropper import RoboflowItemCropper
                api_key = os.getenv("ROBOFLOW_API_KEY")
                if not api_key:
                    print("❌ ROBOFLOW_API_KEY not set!")
                    return None
                _cropper_instance = RoboflowItemCropper(api_key=api_key)
                print("✅ Roboflow cropper ready")
                return _cropper_instance
            except Exception as e:
                print(f"❌ Failed to initialize Roboflow cropper: {e}")
                import traceback
                traceback.print_exc()
                return None
        
        print("🔧 Initializing CustomItemCropper (local)...")
        from custom_item_cropper import CustomItemCropper
        
        # Check if we're on Modal (GroundingDINO in /root) or local
        if os.path.exists("/root/GroundingDINO"):
            # Modal GPU deployment
            config_path = "/root/GroundingDINO/groundingdino/config/GroundingDINO_SwinT_OGC.py"
            weights_path = "/root/GroundingDINO/weights/groundingdino_swint_ogc.pth"
            sam2_config = "sam2_hiera_l.yaml"
            sam2_weights = "data/weights/sam2_hiera_large.pt"  # Not used in GPU
        else:
            # Local paths
            config_path = "configs/GroundingDINO_SwinT_OGC.py"
            weights_path = "data/weights/groundingdino_swint_ogc.pth"
            sam2_config = "sam2_hiera_l.yaml"
            sam2_weights = "data/weights/sam2_hiera_large.pt"
        
        # Check environment variable to enable/disable SAM-2
        use_sam2 = os.getenv("USE_SAM2", "false").lower() == "true"
        print(f"⚙️  USE_SAM2 = {use_sam2}")
        
        # Check if files exist, otherwise return None
        if not os.path.exists(config_path):
            print(f"⚠️ Config not found: {config_path}")
            return None
            
        try:
            # Check if GPU is available
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"⚙️  Using device: {device}")
            if device == "cuda":
                print(f"🎮 GPU: {torch.cuda.get_device_name(0)}")
                print(f"🎮 CUDA version: {torch.version.cuda}")
            else:
                print("⚠️  WARNING: GPU not available, using CPU")
            
            _cropper_instance = CustomItemCropper(
                gd_config=config_path,
                gd_weights=weights_path,
                sam2_config=sam2_config,
                sam2_checkpoint=sam2_weights,
                use_sam2=use_sam2,
                device=device
            )
            print("✅ CustomItemCropper initialized")
        except Exception as e:
            print(f"❌ Failed to initialize cropper: {e}")
            return None
    
    return _cropper_instance


def crop_image_from_url(image_url: str = None, image_base64: str = None, categories: List[str] = None, count: int = 1) -> str:
    """
    Crop image from URL or base64 based on categories.
    
    Args:
        image_url: Public URL of the image (optional if image_base64 provided)
        image_base64: Base64 encoded image (optional if image_url provided)
        categories: List of categories like ["tops", "bottoms", "shoes"]
        count: Number of instances to find for this category
        
    Returns:
        URL of the cropped image (uploaded to imgbb, or original if failed)
    """
    start_time = time.time()
    
    # Validate input
    if not image_url and not image_base64:
        raise ValueError("Either image_url or image_base64 must be provided")
    
    print(f"📥 Processing image from {'URL' if image_url else 'base64'}: {image_url if image_url else '[base64 data]'}")
    print(f"📋 Categories: {categories}")
    print(f"📊 Requested count: {count}")
    
    # Check if cropper is available
    t0 = time.time()
    cropper = get_cropper()
    if cropper is None:
        print("⚠️ Cropper not available, returning original URL or None")
        return image_url if image_url else None
    print(f"⏱️  Cropper init: {time.time() - t0:.2f}s")
    
    # Convert categories to simple generic terms for GPT-4o
    category_map = {
        "tops": "top",
        "bottoms": "bottom",
        "bag": "bag",
        "shoes": "shoes",
        "accessory": "accessory",
        "dress": "dress"
    }

    # Generate item descriptions - if count > 1, create multiple instances
    item_descriptions = []
    for cat in categories:
        base_term = category_map.get(cat, cat)
        if count > 1:
            # Create multiple instances of the same category
            for i in range(count):
                item_descriptions.append(f"{base_term}_{i+1}")
        else:
            item_descriptions.append(base_term)

    print(f"🔍 Requesting categories: {item_descriptions}")
    
    # Use the cropper to process the image
    import shutil
    output_dir = tempfile.mkdtemp()
    print(f"📁 Output directory: {output_dir}")
    
    # Process the image differently based on cropper type
    temp_path = None  # Initialize to avoid UnboundLocalError
    
    try:
        t0 = time.time()
        print(f"⏱️  Starting crop processing...")
        
        if _use_roboflow:
            # Roboflow mode: use URL directly
            if image_base64:
                raise ValueError("Roboflow mode only supports URLs, not base64")
            print("🌐 Using Roboflow API with URL")
            result = cropper.process_image_from_url(
                image_url=image_url,
                custom_items=item_descriptions,
                output_dir=output_dir
            )
        else:
            # Local mode: download or decode first
            t0_download = time.time()
            
            if image_base64:
                # Base64 mode - decode directly (bypasses DNS issues!)
                print("🔓 Decoding base64 image...")
                try:
                    # Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
                    if ',' in image_base64:
                        image_base64 = image_base64.split(',')[1]
                    image_content = base64.b64decode(image_base64)
                    print(f"✅ Decoded base64 ({len(image_content)} bytes)")
                except Exception as e:
                    raise ValueError(f"Failed to decode base64 image: {e}")
            else:
                # URL mode - download with DNS workaround
                print("⬇️ Downloading image from URL...")
                import httpx
                try:
                    # Try httpx first (has better DNS handling)
                    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                        response_httpx = client.get(image_url)
                        response_httpx.raise_for_status()
                        image_content = response_httpx.content
                    print(f"✅ Downloaded with httpx ({len(image_content)} bytes)")
                except Exception as e:
                    print(f"⚠️ httpx failed: {e}")
                    print("🔄 Falling back to requests...")
                    response = requests.get(image_url, timeout=60)
                    response.raise_for_status()
                    image_content = response.content
            
            # Save to temporary file  
            os.makedirs(tempfile.gettempdir() + '/fashion_crop', exist_ok=True)
            temp_path = os.path.join(tempfile.gettempdir(), 'fashion_crop', f'{hash(image_url if image_url else image_base64[:100])}.jpg')
            with open(temp_path, 'wb') as f:
                f.write(image_content)
            
            print(f"✅ Image saved to: {temp_path}")
            print(f"⏱️  Download: {time.time() - t0_download:.2f}s")
            
            # Process with local cropper
            custom_items_map = {os.path.basename(temp_path): item_descriptions}
            result = cropper.process_batch_with_custom_items(
                image_dir=os.path.dirname(temp_path),
                custom_items_map=custom_items_map,
                output_dir=output_dir
            )
        
        print(f"✅ Crop result: {result}")
        print(f"⏱️  Crop processing: {time.time() - t0:.2f}s")
        
        # Find all cropped images
        crops_dir = os.path.join(output_dir, "crops")
        print(f"🔍 Looking for crops in: {crops_dir}")
        print(f"📁 Directory exists: {os.path.exists(crops_dir)}")

        cropped_urls = []

        if os.path.exists(crops_dir):
            crops = sorted([f for f in os.listdir(crops_dir) if f.endswith(('.jpg', '.png'))])
            print(f"📸 Found {len(crops)} crops: {crops}")
            
            # Limit to requested count if necessary
            if len(crops) > count:
                print(f"⚠️  Found {len(crops)} crops but only {count} were requested.")
                print(f"   IoU filtering should have handled duplicates, but limiting to {count} as requested.")
                # The cropper generates crops in order: item1, item2, item3, etc.
                # After IoU filtering, these should be the best non-duplicate detections
                # Keep the first 'count' items
                crops = crops[:count]
                print(f"   Selected: {crops}")

            if crops:
                # Upload all cropped images (limited to count)
                t0 = time.time()
                for crop_filename in crops:
                    cropped_path = os.path.join(crops_dir, crop_filename)
                    print(f"📤 Uploading cropped image: {crop_filename}")

                    # Upload to Supabase
                    with open(cropped_path, 'rb') as f:
                        cropped_bytes = f.read()

                    cropped_url = upload_image_to_supabase(cropped_bytes)
                    cropped_urls.append(cropped_url)
                    print(f"✅ Uploaded to: {cropped_url}")
                
                print(f"⏱️  Upload crops: {time.time() - t0:.2f}s")

                # Cleanup
                if temp_path and os.path.exists(temp_path):
                    os.unlink(temp_path)
                if os.path.exists(output_dir):
                    shutil.rmtree(output_dir)

                print(f"⏱️  TOTAL CROP TIME: {time.time() - start_time:.2f}s")
                
                # Return array of URLs for multiple crops, or single URL for backward compatibility
                if len(cropped_urls) > 1:
                    return {"croppedImageUrls": cropped_urls}
                else:
                    return cropped_urls[0] if cropped_urls else image_url

        print("⚠️ No crops found")
        if _use_roboflow:
            fallback = _fallback_to_cpu(image_url, categories, count)
            if fallback is not None:
                if temp_path and os.path.exists(temp_path):
                    os.unlink(temp_path)
                if os.path.exists(output_dir):
                    shutil.rmtree(output_dir)
                return fallback
        print("⚠️ Returning original URL")
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)
        return image_url
        
    except Exception as e:
        print(f"❌ Error processing image: {e}")
        import traceback
        traceback.print_exc()
        if _use_roboflow:
            fallback = _fallback_to_cpu(image_url, categories, count)
            if fallback is not None:
                return fallback
        return image_url

