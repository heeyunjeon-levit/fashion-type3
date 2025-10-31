#!/usr/bin/env python3
"""
Roboflow-based Item Cropper - Uses Roboflow Inference API for GPU-accelerated GroundingDINO
No SAM-2 needed - uses bounding boxes directly (already validated as accurate)
"""

import os
import sys
import json
import requests
from pathlib import Path
from typing import Dict, List, Optional, Union
from PIL import Image
import base64
import io
from io import BytesIO
import numpy as np

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

# Try both import paths for compatibility
try:
    from analyzers.gpt4o_analyzer import GPT4OFashionAnalyzer
except ImportError:
    from src.analyzers.gpt4o_analyzer import GPT4OFashionAnalyzer

from inference.models.grounding_dino import GroundingDINO


def to_pil_rgb(img: Union[np.ndarray, Image.Image, bytes, bytearray, str]) -> Image.Image:
    """
    Accepts: NumPy array, PIL.Image, raw bytes, file path.
    Returns: PIL.Image in RGB, uint8, 3 channels.
    """
    # 1) Load → PIL
    if isinstance(img, Image.Image):
        pil = img
    elif isinstance(img, (bytes, bytearray)):
        pil = Image.open(BytesIO(img))
    elif isinstance(img, str):
        pil = Image.open(img)  # file path
    elif isinstance(img, np.ndarray):
        arr = img
        # Handle float arrays (0..1 → 0..255)
        if arr.dtype in (np.float32, np.float64):
            arr = np.clip(arr, 0, 1) * 255.0
            arr = arr.astype(np.uint8)
        elif arr.dtype != np.uint8:
            arr = arr.astype(np.uint8)

        # Shape handling
        if arr.ndim == 2:  # (H, W) grayscale
            pil = Image.fromarray(arr, mode="L").convert("RGB")
        elif arr.ndim == 3:
            h, w, c = arr.shape
            if c == 1:
                pil = Image.fromarray(arr.squeeze(-1), mode="L").convert("RGB")
            elif c == 3:
                # If this came from OpenCV, it's likely BGR → convert to RGB
                arr = arr[..., ::-1]  # BGR→RGB
                pil = Image.fromarray(arr, mode="RGB")
            elif c == 4:
                pil = Image.fromarray(arr, mode="RGBA").convert("RGB")
            else:
                raise ValueError(f"Unsupported channel count: {c}")
        else:
            raise ValueError(f"Unsupported array shape: {arr.shape}")
    else:
        raise TypeError(f"Unsupported input type: {type(img)}")

    # 2) Ensure RGB, uint8
    if pil.mode != "RGB":
        pil = pil.convert("RGB")
    return pil


class RoboflowItemCropper:
    """Cropper using Roboflow Inference library for GroundingDINO"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.gpt4o_analyzer = GPT4OFashionAnalyzer()
        # Initialize Roboflow GroundingDINO model
        print("🔧 Initializing Roboflow GroundingDINO model...")
        
        # Check GPU availability
        try:
            import torch
            if torch.cuda.is_available():
                print(f"🎮 GPU Available: {torch.cuda.get_device_name(0)}")
            else:
                print("⚠️  WARNING: No GPU detected, inference will be slow!")
        except:
            print("⚠️  WARNING: Could not check GPU status")
        
        self.model = GroundingDINO(api_key=api_key)
        print("✅ Roboflow model ready")
    
    def _call_roboflow_inference(self, image_url: str, text_prompt: str) -> dict:
        """Call Roboflow Inference library for GroundingDINO detection"""
        print(f"\n{'='*60}")
        print(f"📡 Running Roboflow inference")
        print(f"   Prompt: '{text_prompt}'")
        print(f"   Image URL: {image_url}")
        print(f"{'='*60}\n")
        
        try:
            # Download image and convert to PIL RGB (fixes NumPy compatibility issues)
            print(f"⬇️  Downloading image from URL...")
            response = requests.get(image_url)
            response.raise_for_status()
            image_bytes = response.content
            print(f"✅ Downloaded {len(image_bytes)} bytes")
            
            # Convert to PIL RGB using the helper function
            print(f"🔄 Converting to PIL RGB format...")
            pil_image = to_pil_rgb(image_bytes)
            print(f"✅ Converted to PIL RGB: size={pil_image.size}, mode={pil_image.mode}")
            
            # Convert PIL to NumPy array for Roboflow
            numpy_image = np.array(pil_image)
            print(f"✅ Converted to NumPy: shape={numpy_image.shape}, dtype={numpy_image.dtype}")
            
            # Use the inference library with NumPy array
            print(f"🔍 Calling GroundingDINO model.infer()...")
            results = self.model.infer(
                numpy_image,  # Pass NumPy RGB uint8 array
                text=[text_prompt]  # Text as keyword argument
            )
            
            # Parse results
            print(f"✅ Received response from Roboflow")
            result_dict = results.dict() if hasattr(results, 'dict') else results.json() if hasattr(results, 'json') else results
            predictions = result_dict.get('predictions', [])
            print(f"✅ Roboflow inference completed with {len(predictions)} detections")
            
            if predictions:
                for i, pred in enumerate(predictions[:3]):  # Show top 3
                    print(f"   Detection {i+1}: confidence={pred.get('confidence', 0):.3f}")
            
            return result_dict
            
        except Exception as e:
            print(f"❌ Error in Roboflow inference: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def _roboflow_to_bbox(self, prediction: dict, img_width: int, img_height: int) -> tuple:
        """Convert Roboflow prediction to (x1, y1, x2, y2) bbox format"""
        # Roboflow returns: {x, y, width, height} in absolute coordinates
        x = prediction['x']
        y = prediction['y']
        w = prediction['width']
        h = prediction['height']
        
        # Convert center-based to corner-based
        x1 = max(0, x - w/2)
        y1 = max(0, y - h/2)
        x2 = min(img_width, x + w/2)
        y2 = min(img_height, y + h/2)
        
        return (int(x1), int(y1), int(x2), int(y2))
    
    def _crop_and_save(self, image_path: str, bbox: tuple, output_path: str) -> str:
        """Crop image using bounding box and save"""
        image = Image.open(image_path)
        cropped = image.crop(bbox)
        cropped.save(output_path)
        print(f"✂️  Saved crop to: {output_path}")
        return output_path
    
    def create_custom_analysis(self, image_path: str, custom_items: List[str]) -> dict:
        """Create a custom analysis result with specified items
        
        Args:
            image_path: Path to the image
            custom_items: List of item categories (e.g., ["top", "bottom"])
            
        Returns:
            Dictionary with items analyzed by GPT-4o for image-specific prompts
        """
        # Map common terms to better prompts
        term_mapping = {
            'top': 'tops',
            'tops': 'tops', 
            'shirt': 'tops',
            'bottom': 'bottoms',
            'bottoms': 'bottoms',
            'pants': 'bottoms',
            'dress': 'dress',
            'shoes': 'shoes',
            'bag': 'bag',
            'accessory': 'accessory',
        }
        
        # Use GPT-4o for fashion analysis
        print(f"🤖 Analyzing image with GPT-4o...")
        analysis = self.gpt4o_analyzer.analyze_fashion_items(image_path)
        
        # Map the analysis to match expected format for custom_items
        # Convert GPT analysis to our expected format
        formatted_analysis = {"items": {}}
        
        for item in analysis.get("items", []):
            # Try to match GPT's detected items to our requested custom_items
            prompt = item.get("groundingdino_prompt", "")
            desc = item.get("description", "")
            
            # Map to requested categories
            for custom_item in custom_items:
                base_item = custom_item.split('_')[0]  # Remove numeric suffix
                mapped_term = term_mapping.get(base_item, base_item)
                
                # Check if this GPT item matches our requested category
                if mapped_term.lower() in prompt.lower() or mapped_term.lower() in desc.lower():
                    formatted_analysis["items"][base_item] = {
                        "groundingdino_prompt": prompt,
                        "description": desc
                    }
                    break
        
        # If no matches, create generic prompts for requested items
        for custom_item in custom_items:
            base_item = custom_item.split('_')[0]
            if base_item not in formatted_analysis["items"]:
                mapped_term = term_mapping.get(base_item, base_item)
                formatted_analysis["items"][base_item] = {
                    "groundingdino_prompt": mapped_term,
                    "description": f"{mapped_term} in the image"
                }
        
        return formatted_analysis
    
    def process_batch_with_custom_items(self,
                                        image_dir: str,
                                        custom_items_map: Dict[str, List[str]],
                                        output_dir: str = "/tmp/crops") -> dict:
        """
        Process a batch of images with custom items (compatible with crop_api.py)
        
        Args:
            image_dir: Directory containing images
            custom_items_map: Dict mapping image filenames to list of items
            output_dir: Directory to save crops
            
        Returns:
            Dictionary with processing results
        """
        print(f"\n{'='*60}")
        print(f"🎯 Roboflow Batch Processing")
        print(f"📂 Image dir: {image_dir}")
        print(f"📋 Items map: {custom_items_map}")
        print(f"{'='*60}\n")
        
        # Create output directory structure
        crops_dir = os.path.join(output_dir, "crops")
        os.makedirs(crops_dir, exist_ok=True)
        
        results = {
            "total_images": len(custom_items_map),
            "successful_images": 0,
            "failed_images": 0,
            "total_crops": 0,
            "results": []
        }
        
        # Process each image
        for image_filename, custom_items in custom_items_map.items():
            image_path = os.path.join(image_dir, image_filename)
            
            if not os.path.exists(image_path):
                print(f"❌ Image not found: {image_path}")
                results["failed_images"] += 1
                continue
            
            try:
                crop_results = self.process_image(image_path, custom_items, crops_dir)
                
                num_crops = sum(len(urls) for urls in crop_results.values())
                results["total_crops"] += num_crops
                results["successful_images"] += 1
                
                results["results"].append({
                    "image": image_filename,
                    "custom_items": custom_items,
                    "success": True,
                    "crops": num_crops
                })
                
            except Exception as e:
                print(f"❌ Error processing {image_filename}: {e}")
                import traceback
                traceback.print_exc()
                results["failed_images"] += 1
                results["results"].append({
                    "image": image_filename,
                    "custom_items": custom_items,
                    "success": False,
                    "error": str(e)
                })
        
        return results
    
    def process_image_from_url(self,
                              image_url: str,
                              custom_items: List[str],
                              output_dir: str = "/tmp/crops") -> Dict[str, List[str]]:
        """
        Process an image from URL and crop specified items using Roboflow API
        
        Args:
            image_url: Public URL to the image (e.g., Supabase URL)
            custom_items: List of items to detect (e.g., ["top_1", "top_2", "bottom"])
            output_dir: Directory to save crops
            
        Returns:
            Dictionary mapping item names to list of crop paths
        """
        print(f"\n{'='*60}")
        print(f"🎯 Processing image from URL")
        print(f"📋 Items to detect: {custom_items}")
        print(f"{'='*60}\n")
        
        # Create output directory structure (mimic local cropper's structure)
        crops_dir = os.path.join(output_dir, "crops")
        os.makedirs(crops_dir, exist_ok=True)
        
        # Download image temporarily for GPT-4o analysis AND cropping
        temp_path = os.path.join(output_dir, "temp_image.jpg")
        print(f"⬇️  Downloading image for analysis and cropping...")
        response = requests.get(image_url)
        response.raise_for_status()
        with open(temp_path, 'wb') as f:
            f.write(response.content)
        
        # Get GPT-4o analysis for detailed prompts
        analysis = self.create_custom_analysis(temp_path, custom_items)
        
        # Load image to get dimensions
        image = Image.open(temp_path)
        img_width, img_height = image.size
        print(f"📐 Image size: {img_width}x{img_height}")
        
        all_crops = []  # Track all crops for counting
        
        # Process each item
        for item in custom_items:
            print(f"\n🔍 Processing: {item}")
            
            # Get GroundingDINO prompt from GPT-4o analysis
            item_key = item.split('_')[0]  # Remove numeric suffix
            gd_prompt = analysis.get('items', {}).get(item_key, {}).get('groundingdino_prompt', item_key)
            
            print(f"💭 GroundingDINO prompt: '{gd_prompt}'")
            
            # Call Roboflow Inference with the public image URL
            try:
                roboflow_result = self._call_roboflow_inference(image_url, gd_prompt)
                predictions = roboflow_result.get('predictions', [])
                
                if not predictions:
                    print(f"⚠️  No detections for {item}")
                    continue
                
                # Sort by confidence
                predictions.sort(key=lambda p: p['confidence'], reverse=True)
                
                # Take best detection (or multiple if needed)
                num_needed = 1
                if '_' in item:
                    # If item has suffix like "top_2", we already got multiple in one call
                    # Just take the first one
                    num_needed = 1
                
                crops = []
                for i, pred in enumerate(predictions[:num_needed]):
                    confidence = pred['confidence']
                    bbox = self._roboflow_to_bbox(pred, img_width, img_height)
                    
                    print(f"✅ Detection {i+1}: confidence={confidence:.3f}, bbox={bbox}")
                    
                    # Crop and save to crops directory
                    crop_filename = f"{item}_crop{i}.jpg"
                    crop_path = os.path.join(crops_dir, crop_filename)
                    self._crop_and_save(temp_path, bbox, crop_path)
                    
                    all_crops.append(crop_path)
                
            except Exception as e:
                print(f"❌ Error processing {item}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Return result in the same format as CustomItemCropper
        # (crop_api.py expects the crops to be in output_dir/crops/)
        print(f"\n✅ Total crops saved: {len(all_crops)}")
        return {"total_crops": len(all_crops), "crops_dir": crops_dir}


if __name__ == "__main__":
    # Test the Roboflow cropper
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Roboflow Item Cropper')
    parser.add_argument('--image', required=True, help='Path to test image')
    parser.add_argument('--items', nargs='+', default=['tops', 'bottoms'], help='Items to detect')
    parser.add_argument('--api-key', help='Roboflow API key (or set ROBOFLOW_API_KEY env var)')
    
    args = parser.parse_args()
    
    api_key = args.api_key or os.environ.get('ROBOFLOW_API_KEY')
    if not api_key:
        print("❌ Error: Roboflow API key required. Use --api-key or set ROBOFLOW_API_KEY env var")
        sys.exit(1)
    
    cropper = RoboflowItemCropper(api_key=api_key)
    results = cropper.process_image(args.image, args.items)
    
    print("\n" + "="*60)
    print("📊 Results:")
    print("="*60)
    for item, crops in results.items():
        print(f"{item}: {len(crops)} crops")
        for crop in crops:
            print(f"  - {crop}")

