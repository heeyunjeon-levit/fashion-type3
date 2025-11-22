"""
GPU-accelerated Custom Item Cropper using HuggingFace Transformers GroundingDINO
Clean implementation without manual CUDA compilation
"""
import os
import sys
import torch
from PIL import Image
from typing import List, Dict
import tempfile
import time

# Add /root to path for imports
if "/root" not in sys.path:
    sys.path.append("/root")

from src.analyzers.gpt4o_analyzer import GPT4OFashionAnalyzer
from src.analyzers.fashion_analyzer import USE_DINOX
from src.analyzers.dinox_analyzer import analyze_image_with_dinox
import os

class CustomItemCropper:
    def __init__(self, device: str = "cuda"):
        """
        Initialize GPU-accelerated cropper with transformers GroundingDINO
        
        Args:
            device: "cuda" for GPU, "cpu" for CPU
        """
        print(f"🔧 Initializing CustomItemCropper (GPU mode)")
        
        self.device = device if torch.cuda.is_available() else "cpu"
        if self.device == "cpu":
            print("⚠️  WARNING: GPU not available, using CPU")
        else:
            print(f"✅ Using GPU: {torch.cuda.get_device_name(0)}")
        
        # Initialize transformers GroundingDINO
        from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
        
        model_id = "IDEA-Research/grounding-dino-tiny"
        cache_dir = os.environ.get("TRANSFORMERS_CACHE", "/cache/models")
        
        print(f"📦 Loading GroundingDINO from {model_id}")
        print(f"📂 Cache directory: {cache_dir}")
        
        self.processor = AutoProcessor.from_pretrained(model_id, cache_dir=cache_dir)
        self.model = AutoModelForZeroShotObjectDetection.from_pretrained(
            model_id,
            cache_dir=cache_dir
        ).to(self.device)
        
        print(f"✅ GroundingDINO loaded successfully on {self.device}")
        
        # Initialize GPT-4o analyzer
        self.gpt_analyzer = GPT4OFashionAnalyzer()
    
    def crop_custom_items(self, image_url: str, custom_items: List[str], output_dir: str, cached_gpt_result: Dict = None) -> Dict:
        """
        Crop custom items from image using GPU-accelerated GroundingDINO
        
        Args:
            image_url: URL to the image
            custom_items: List of items to detect (e.g., ['top', 'bottom'])
            output_dir: Directory to save crops
            cached_gpt_result: Optional pre-computed GPT analysis result (for performance)
            
        Returns:
            Dict with crop results
        """
        import requests
        from io import BytesIO
        
        print(f"🖼️  Processing image: {image_url}")
        print(f"🎯 Looking for: {custom_items}")
        
        # Download image with proper headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(image_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Check content type
        content_type = response.headers.get('content-type', '')
        print(f"📦 Downloaded {len(response.content)} bytes, content-type: {content_type}")
        
        if 'image' not in content_type.lower():
            print(f"⚠️  Warning: Content-Type is '{content_type}', not an image!")
        
        # Try to open image
        try:
            image = Image.open(BytesIO(response.content)).convert("RGB")
            image_width, image_height = image.size
            print(f"✅ Image loaded: {image_width}x{image_height}")
        except Exception as e:
            print(f"❌ Failed to load image: {e}")
            print(f"   Response content preview: {response.content[:200]}")
            raise
        
        # Step 1: Use GPT-4o to analyze (or use cached result)
        gpt4o_time = 0
        if cached_gpt_result:
            print("🚀 Using cached GPT result (pre-analyzed!)")
            gpt_result = cached_gpt_result
        else:
            # Save image temporarily for GPT-4o analyzer
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                image.save(tmp_file.name, 'JPEG')
                temp_image_path = tmp_file.name
            
            try:
                # Step 1: Use DINO-X or GPT-4o to analyze and generate prompts
                if USE_DINOX:
                    print("🤖 Step 1: DINO-X analysis (fast mode)...")
                    gpt4o_start = time.time()
                    gpt_result = analyze_image_with_dinox(image_url)
                    gpt4o_time = time.time() - gpt4o_start
                    print(f"⏱️  DINO-X analysis took: {gpt4o_time:.2f}s")
                else:
                    print("🤖 Step 1: GPT-4o analysis...")
                    gpt4o_start = time.time()
                    gpt_result = self.gpt_analyzer.analyze_fashion_items(temp_image_path)
                    gpt4o_time = time.time() - gpt4o_start
                    print(f"⏱️  GPT-4o analysis took: {gpt4o_time:.2f}s")
            finally:
                # Clean up temp file
                if os.path.exists(temp_image_path):
                    os.unlink(temp_image_path)
        
        if not gpt_result or 'items' not in gpt_result:
            print("❌ GPT-4o analysis failed")
            return {'real_crops': 0, 'expected_items': len(custom_items)}
        
        all_items = gpt_result['items']
        print(f"🔍 GPT-4o detected {len(all_items)} total items in image")
        
        # Filter items to match requested categories
        # Map common category terms
        category_keywords = {
            'top': ['shirt', 'blouse', 'sweater', 'top', 'tee', 'hoodie', 'jacket', 'cardigan', 'vest', 'coat'],
            'bottom': ['pants', 'jeans', 'skirt', 'shorts', 'trousers', 'leggings'],
            'dress': ['dress', 'gown'],
            'shoes': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer'],
            'bag': ['bag', 'purse', 'backpack', 'tote', 'clutch', 'handbag'],
            'accessory': ['necklace', 'bracelet', 'earring', 'watch', 'hat', 'cap', 'beanie', 'visor', 'headband', 'scarf', 'belt', 'sunglasses', 'ring', 'jewelry']
        }
        
        detected_items = []
        for requested_category in custom_items:
            # Get keywords for this category
            keywords = category_keywords.get(requested_category.lower(), [requested_category.lower()])
            
            # Find matching item from GPT results
            for item in all_items:
                prompt_lower = item['groundingdino_prompt'].lower()
                desc_lower = item.get('description', '').lower()
                
                # Check if any keyword matches
                if any(keyword in prompt_lower or keyword in desc_lower for keyword in keywords):
                    detected_items.append(item)
                    print(f"   ✅ Matched '{requested_category}' → '{item['groundingdino_prompt']}'")
                    break  # Only take first match per requested category
            else:
                print(f"   ⚠️  No match found for requested category: '{requested_category}'")
        
        if not detected_items:
            print(f"❌ No items matched requested categories: {custom_items}")
            return {'real_crops': 0, 'expected_items': len(custom_items)}
        
        print(f"✅ Filtered to {len(detected_items)} items matching requested categories")
        
        # Step 2: Detect with GroundingDINO
        print("🔍 Step 2: GroundingDINO detection...")
        
        crops_generated = 0
        total_dino_time = 0
        os.makedirs(output_dir, exist_ok=True)
        
        for idx, item in enumerate(detected_items):
            prompt = item['groundingdino_prompt']
            description = item['description']
            
            print(f"   [{idx+1}/{len(detected_items)}] Detecting: '{prompt}'")
            
            # Prepare inputs for GroundingDINO
            text_labels = [[prompt]]  # transformers expects nested list
            inputs = self.processor(
                images=image, 
                text=text_labels, 
                return_tensors="pt"
            ).to(self.device)
            
            # Run inference with timing
            dino_start = time.time()
            with torch.no_grad():
                outputs = self.model(**inputs)
            
            # Post-process results
            results = self.processor.post_process_grounded_object_detection(
                outputs,
                threshold=0.15,  # Lower threshold to catch more items
                text_threshold=0.15,
                target_sizes=[(image_height, image_width)]
            )
            dino_time = time.time() - dino_start
            total_dino_time += dino_time
            print(f"   ⏱️  GroundingDINO inference: {dino_time:.3f}s")
            
            if len(results) == 0 or len(results[0]["boxes"]) == 0:
                print(f"   ⚠️  No detections for '{prompt}'")
                continue
            
            # Use the highest confidence detection
            result = results[0]
            best_idx = result["scores"].argmax()
            box = result["boxes"][best_idx].tolist()
            score = result["scores"][best_idx].item()
            
            print(f"   ✅ Detected with confidence {score:.3f}")
            
            # Add margin to bbox
            x1, y1, x2, y2 = box
            margin_ratio = 0.05
            margin_x = (x2 - x1) * margin_ratio
            margin_y = (y2 - y1) * margin_ratio
            
            crop_box = [
                max(0, x1 - margin_x),
                max(0, y1 - margin_y),
                min(image_width, x2 + margin_x),
                min(image_height, y2 + margin_y)
            ]
            
            # Crop and save
            cropped = image.crop(crop_box)
            clean_prompt = prompt.replace(' ', '_').replace('-', '_')
            output_path = os.path.join(output_dir, f"item{idx+1}_{clean_prompt}_crop.jpg")
            cropped.save(output_path, 'JPEG', quality=95)
            
            crops_generated += 1
            print(f"   💾 Saved crop: {output_path}")
        
        print(f"🏆 Generated {crops_generated}/{len(custom_items)} crops")
        
        # Timing summary
        print(f"\n⏱️  TIMING SUMMARY:")
        print(f"   GPT-4o Vision API: {gpt4o_time:.2f}s")
        print(f"   GroundingDINO (total): {total_dino_time:.3f}s")
        if len(detected_items) > 0:
            print(f"   GroundingDINO (avg per item): {total_dino_time/len(detected_items):.3f}s")
        print(f"   Total processing: {gpt4o_time + total_dino_time:.2f}s\n")
        
        return {
            'real_crops': crops_generated,
            'expected_items': len(custom_items),
            'timing': {
                'gpt4o_seconds': round(gpt4o_time, 2),
                'groundingdino_seconds': round(total_dino_time, 3),
                'total_seconds': round(gpt4o_time + total_dino_time, 2)
            }
        }

