"""
API wrapper for FastAPI server to crop images from URLs.
"""

import os
import time
import requests
import tempfile
import base64
from typing import List
from pathlib import Path
from custom_item_cropper import CustomItemCropper
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize the cropper (will be lazy-loaded)
_cropper_instance = None

def upload_image_to_supabase(image_bytes: bytes) -> str:
    """Upload image to Supabase storage and return URL"""
    from supabase import create_client

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

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

# Backward compatibility
def upload_image_to_imgbb(image_bytes: bytes) -> str:
    """Deprecated: Use upload_image_to_supabase instead"""
    return upload_image_to_supabase(image_bytes)

def get_cropper():
    """Get or create the cropper instance (lazy loading)"""
    global _cropper_instance
    if _cropper_instance is None:
        print("🔧 Initializing CustomItemCropper...")
        # Use default paths (adjust these based on your setup)
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
            _cropper_instance = CustomItemCropper(
                gd_config=config_path,
                gd_weights=weights_path,
                sam2_config=sam2_config,
                sam2_checkpoint=sam2_weights,
                use_sam2=use_sam2
            )
            print("✅ CustomItemCropper initialized")
        except Exception as e:
            print(f"❌ Failed to initialize cropper: {e}")
            return None
    
    return _cropper_instance


def crop_image_from_url(image_url: str, categories: List[str], count: int = 1) -> str:
    """
    Crop image from URL based on categories.
    
    Args:
        image_url: Public URL of the image
        categories: List of categories like ["tops", "bottoms", "shoes"]
        count: Number of instances to find for this category
        
    Returns:
        URL of the cropped image (uploaded to imgbb, or original if failed)
    """
    start_time = time.time()
    print(f"📥 Processing image from URL: {image_url}")
    print(f"📋 Categories: {categories}")
    print(f"📊 Requested count: {count}")
    
    # Check if cropper is available
    t0 = time.time()
    cropper = get_cropper()
    if cropper is None:
        print("⚠️ Cropper not available, returning original URL")
        return image_url
    print(f"⏱️  Cropper init: {time.time() - t0:.2f}s")
    
    # Download image to temporary file
    try:
        t0 = time.time()
        print("⬇️ Downloading image...")
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        
        # Save to temporary file  
        os.makedirs(tempfile.gettempdir() + '/fashion_crop', exist_ok=True)
        temp_path = os.path.join(tempfile.gettempdir(), 'fashion_crop', f'{hash(image_url)}.jpg')
        with open(temp_path, 'wb') as f:
            f.write(response.content)
        
        print(f"✅ Image saved to: {temp_path}")
        print(f"⏱️  Download: {time.time() - t0:.2f}s")
        
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
        
        # Process the image with the custom items
        t0 = time.time()
        custom_items_map = {os.path.basename(temp_path): item_descriptions}
        print(f"⏱️  Starting crop processing...")
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

                    # Upload to Supabase/imgbb
                    with open(cropped_path, 'rb') as f:
                        cropped_bytes = f.read()

                    cropped_url = upload_image_to_imgbb(cropped_bytes)
                    cropped_urls.append(cropped_url)
                    print(f"✅ Uploaded to: {cropped_url}")
                
                print(f"⏱️  Upload crops: {time.time() - t0:.2f}s")

                # Cleanup
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                if os.path.exists(output_dir):
                    shutil.rmtree(output_dir)

                print(f"⏱️  TOTAL CROP TIME: {time.time() - start_time:.2f}s")
                
                # Return array of URLs for multiple crops, or single URL for backward compatibility
                if len(cropped_urls) > 1:
                    return {"croppedImageUrls": cropped_urls}
                else:
                    return cropped_urls[0] if cropped_urls else image_url

        print("⚠️ No crops found, returning original URL")
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)
        return image_url
        
    except Exception as e:
        print(f"❌ Error processing image: {e}")
        import traceback
        traceback.print_exc()
        return image_url

