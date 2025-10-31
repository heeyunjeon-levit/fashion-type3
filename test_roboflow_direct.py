#!/usr/bin/env python3
"""
Direct test of Roboflow Inference library to diagnose detection issues
"""

import os
import sys
import requests
import numpy as np
from PIL import Image
from io import BytesIO

# Test with the inference library
from inference.models.grounding_dino import GroundingDINO

def test_roboflow_detection():
    """Test Roboflow GroundingDINO with a real image"""
    
    # Get API key
    api_key = os.environ.get('ROBOFLOW_PRIVATE_KEY')
    if not api_key:
        print("❌ ROBOFLOW_PRIVATE_KEY not set")
        sys.exit(1)
    
    # Test image URL (the one that's failing)
    image_url = "https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1761899841206_0f86de4b5394-Screenshot_20250922_191711_Instagram.jpg"
    
    print("="*80)
    print("🧪 Testing Roboflow GroundingDINO Detection")
    print("="*80)
    print(f"📷 Image: {image_url}")
    print()
    
    # Initialize model
    print("🔧 Initializing GroundingDINO model...")
    model = GroundingDINO(api_key=api_key)
    print("✅ Model initialized")
    print()
    
    # Download image
    print("⬇️  Downloading image...")
    response = requests.get(image_url)
    response.raise_for_status()
    image_bytes = response.content
    print(f"✅ Downloaded {len(image_bytes)} bytes")
    
    # Convert to PIL
    pil_image = Image.open(BytesIO(image_bytes))
    if pil_image.mode != 'RGB':
        pil_image = pil_image.convert('RGB')
    print(f"✅ PIL Image: size={pil_image.size}, mode={pil_image.mode}")
    
    # Convert to NumPy
    numpy_image = np.array(pil_image)
    print(f"✅ NumPy array: shape={numpy_image.shape}, dtype={numpy_image.dtype}")
    print()
    
    # Test different prompts
    test_prompts = [
        "tops",
        "shirt",
        "clothing",
        "top",
        "t-shirt",
        "sweater",
        "garment",
        "person wearing shirt",
        "white shirt",
    ]
    
    print("="*80)
    print("🔍 Testing different prompts...")
    print("="*80)
    
    for prompt in test_prompts:
        print(f"\n📝 Prompt: '{prompt}'")
        print("-" * 60)
        
        try:
            # Try inference with NumPy array
            results = model.infer(
                numpy_image,
                text=[prompt]
            )
            
            # Parse results
            result_dict = results.dict() if hasattr(results, 'dict') else results.json() if hasattr(results, 'json') else results
            predictions = result_dict.get('predictions', [])
            
            print(f"✅ Detections: {len(predictions)}")
            
            if predictions:
                # Sort by confidence
                predictions.sort(key=lambda p: p['confidence'], reverse=True)
                
                # Show top 3
                for i, pred in enumerate(predictions[:3]):
                    conf = pred.get('confidence', 0)
                    x = pred.get('x', 0)
                    y = pred.get('y', 0)
                    w = pred.get('width', 0)
                    h = pred.get('height', 0)
                    print(f"   #{i+1}: confidence={conf:.3f}, bbox=(x={x:.0f}, y={y:.0f}, w={w:.0f}, h={h:.0f})")
            else:
                print("   ⚠️  No detections")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
            import traceback
            traceback.print_exc()
    
    print()
    print("="*80)
    print("🏁 Test completed")
    print("="*80)

if __name__ == "__main__":
    test_roboflow_detection()

