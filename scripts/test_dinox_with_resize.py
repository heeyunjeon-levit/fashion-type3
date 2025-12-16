#!/usr/bin/env python3
"""
Test DINO-X with downsized images for speed
"""

import sys
import time
from pathlib import Path
from PIL import Image
import io
import base64

sys.path.insert(0, str(Path(__file__).parent.parent / "python_backend"))

from src.analyzers.dinox_analyzer import DINOXAnalyzer

TEST_IMAGE = "/Users/levit/Desktop/brands/5d96eff1ccb9-IMG_1740 복사본.png"
MAX_WIDTH = 1200  # Resize to max 1200px width

def resize_image(image_path, max_width=1200):
    """Resize image to max width while maintaining aspect ratio"""
    print(f"📐 Resizing image to max {max_width}px width...")
    
    img = Image.open(image_path)
    original_size = img.size
    original_file_size = Path(image_path).stat().st_size / 1024 / 1024  # MB
    
    print(f"   Original: {original_size[0]}x{original_size[1]} ({original_file_size:.2f}MB)")
    
    # Calculate new dimensions
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        print(f"   Resized: {img.size[0]}x{img.size[1]}")
    else:
        print(f"   No resize needed (already smaller than {max_width}px)")
    
    # Convert to bytes
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    
    resized_size = len(buffer.getvalue()) / 1024 / 1024
    print(f"   Final size: {resized_size:.2f}MB ({original_file_size/resized_size:.1f}x smaller)")
    
    # Convert to base64 data URI
    base64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
    data_uri = f"data:image/jpeg;base64,{base64_data}"
    
    return data_uri

def main():
    print("\n" + "="*80)
    print("🧪 Testing DINO-X with Downsized Images")
    print("="*80)
    print(f"\nTest image: {TEST_IMAGE}")
    print(f"Max width: {MAX_WIDTH}px\n")
    
    # Resize image
    resized_image = resize_image(TEST_IMAGE, MAX_WIDTH)
    
    # Initialize analyzer
    print("\n🔧 Initializing DINO-X analyzer...")
    analyzer = DINOXAnalyzer()
    
    # Test with resized image
    print("\n🔍 Running DINO-X detection on resized image...")
    start = time.time()
    
    result = analyzer.analyze_fashion_items(resized_image)
    
    elapsed = time.time() - start
    
    items = result.get('items', [])
    meta = result.get('meta', {})
    
    print(f"\n✅ Complete in {elapsed:.2f}s")
    print(f"📦 Detected {len(items)} items")
    
    if items:
        print(f"\n📋 Detected Items:")
        for i, item in enumerate(items[:5], 1):
            print(f"\n{i}. {item.get('category', 'unknown').upper()}")
            print(f"   Prompt: {item.get('groundingdino_prompt', 'N/A')}")
            print(f"   Description: {item.get('description', 'N/A')[:80]}...")
            print(f"   Confidence: {item.get('confidence', 0):.2f}")
        
        if len(items) > 5:
            print(f"\n... and {len(items) - 5} more items")
        
        # Analysis
        print(f"\n{'='*80}")
        print("📊 ANALYSIS")
        print(f"{'='*80}")
        print(f"\n⏱️  Speed: {elapsed:.2f}s")
        print(f"   This is with downsized images!")
        print(f"   Compare to GPT-4o: ~6.8s")
        
        if elapsed < 7:
            speedup = 6.8 / elapsed
            print(f"   🏆 {speedup:.2f}x FASTER than GPT-4o!")
        else:
            print(f"   ⚠️  Still slower than GPT-4o")
        
        # Check description quality
        sample_desc = items[0].get('description', '')
        is_detailed = len(sample_desc) > 50 and not sample_desc.endswith('detected by DINO-X')
        
        print(f"\n🎨 Description Quality:")
        print(f"   Sample: '{sample_desc[:80]}...'")
        print(f"   Detailed: {'✅ Yes' if is_detailed else '❌ Generic'}")
        
        print(f"\n💰 Cost: $0.003 per image (10x cheaper than GPT-4o)")
        
        if elapsed < 7 and is_detailed:
            print(f"\n🎉 SUCCESS!")
            print(f"   ✅ Faster than GPT-4o")
            print(f"   ✅ Detailed descriptions")
            print(f"   ✅ 10x cheaper")
            print(f"\n   This is the solution we were looking for!")
        elif elapsed < 7:
            print(f"\n⚠️  PARTIAL SUCCESS")
            print(f"   ✅ Faster than GPT-4o")
            print(f"   ❌ Descriptions not detailed enough")
        else:
            print(f"\n❌ Still slower than GPT-4o with resizing")
    else:
        print("\n❌ No items detected")
        if 'error' in meta:
            print(f"   Error: {meta['error']}")

if __name__ == "__main__":
    main()







