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
from typing import Dict, List, Optional
from PIL import Image
import base64
import io

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from analyzers.gpt4o_analyzer import GPT4OFashionAnalyzer


class RoboflowItemCropper:
    """Cropper using Roboflow Inference API for GroundingDINO"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.gpt4o_analyzer = GPT4OFashionAnalyzer()
        self.roboflow_url = "https://detect.roboflow.com/grounding-dino"
    
    def _encode_image_to_base64(self, image_path: str) -> str:
        """Encode image to base64 for Roboflow API"""
        with open(image_path, 'rb') as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def _call_roboflow_api(self, image_path: str, text_prompt: str) -> dict:
        """Call Roboflow Inference API for GroundingDINO detection"""
        print(f"📡 Calling Roboflow API with prompt: '{text_prompt}'")
        
        # Encode image
        image_base64 = self._encode_image_to_base64(image_path)
        
        # Prepare request
        payload = {
            "api_key": self.api_key,
            "image": {
                "type": "base64",
                "value": image_base64
            },
            "text": [text_prompt]
        }
        
        # Make API call
        response = requests.post(self.roboflow_url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        print(f"✅ Roboflow API responded with {len(result.get('predictions', []))} detections")
        
        return result
    
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
        
        # Always use GPT-4o for detailed fashion analysis
        print(f"🤖 Analyzing image with GPT-4o for {len(custom_items)} items...")
        analysis = self.gpt4o_analyzer.analyze_for_detection(image_path, custom_items)
        
        return analysis
    
    def process_image(self, 
                     image_path: str, 
                     custom_items: List[str],
                     output_dir: str = "/tmp/crops") -> Dict[str, List[str]]:
        """
        Process an image and crop specified items using Roboflow API
        
        Args:
            image_path: Path to input image
            custom_items: List of items to detect (e.g., ["top_1", "top_2", "bottom"])
            output_dir: Directory to save crops
            
        Returns:
            Dictionary mapping item names to list of crop paths
        """
        print(f"\n{'='*60}")
        print(f"🎯 Processing: {Path(image_path).name}")
        print(f"📋 Items to detect: {custom_items}")
        print(f"{'='*60}\n")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Get GPT-4o analysis for detailed prompts
        analysis = self.create_custom_analysis(image_path, custom_items)
        
        # Load image to get dimensions
        image = Image.open(image_path)
        img_width, img_height = image.size
        print(f"📐 Image size: {img_width}x{img_height}")
        
        results = {}
        
        # Process each item
        for item in custom_items:
            print(f"\n🔍 Processing: {item}")
            
            # Get GroundingDINO prompt from GPT-4o analysis
            item_key = item.split('_')[0]  # Remove numeric suffix
            gd_prompt = analysis.get('items', {}).get(item_key, {}).get('groundingdino_prompt', item_key)
            
            print(f"💭 GroundingDINO prompt: '{gd_prompt}'")
            
            # Call Roboflow API
            try:
                roboflow_result = self._call_roboflow_api(image_path, gd_prompt)
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
                    
                    # Crop and save
                    crop_filename = f"{Path(image_path).stem}_{item}_crop{i}.jpg"
                    crop_path = os.path.join(output_dir, crop_filename)
                    self._crop_and_save(image_path, bbox, crop_path)
                    
                    crops.append(crop_path)
                
                results[item] = crops
                
            except Exception as e:
                print(f"❌ Error processing {item}: {e}")
                continue
        
        return results


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

