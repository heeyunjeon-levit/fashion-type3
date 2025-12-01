#!/usr/bin/env python3
"""
Test DINO-X's native captioning feature
"""

import sys
import time
from pathlib import Path

# Add python_backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "python_backend"))

from src.analyzers.dinox_caption_analyzer import DINOXCaptionAnalyzer

TEST_IMAGE = "/Users/levit/Desktop/brands/5d96eff1ccb9-IMG_1740 복사본.png"

def main():
    print("\n" + "="*80)
    print("🧪 Testing DINO-X Native Captioning")
    print("="*80)
    print(f"\nTest image: {TEST_IMAGE}\n")
    
    # Initialize analyzer
    analyzer = DINOXCaptionAnalyzer()
    
    # Test
    print("🔍 Running DINO-X with native captioning...")
    start = time.time()
    
    result = analyzer.analyze_fashion_items(TEST_IMAGE)
    
    elapsed = time.time() - start
    
    items = result.get('items', [])
    meta = result.get('meta', {})
    
    print(f"\n✅ Complete in {elapsed:.2f}s")
    print(f"📦 Detected {len(items)} items")
    print(f"⏱️  Backend time: {meta.get('processing_time', 0)}s")
    
    if items:
        print(f"\n📋 Detected Items:")
        for i, item in enumerate(items, 1):
            print(f"\n{i}. {item.get('category', 'unknown').upper()}")
            print(f"   Prompt: {item.get('groundingdino_prompt', 'N/A')}")
            print(f"   Description: {item.get('description', 'N/A')}")
            print(f"   Confidence: {item.get('confidence', 0):.2f}")
        
        # Check description quality
        desc = items[0].get('description', '')
        is_detailed = len(desc) > 50 and ' ' in desc
        
        print(f"\n🎨 Description Quality:")
        print(f"   Length: {len(desc)} characters")
        print(f"   Detailed: {'✅ Yes' if is_detailed else '❌ No (generic)'}")
        
        if is_detailed:
            print(f"\n🎉 DINO-X native captions are working!")
            print(f"   This means we can skip GPT-4o-mini entirely!")
        else:
            print(f"\n⚠️  Captions are generic, may need GPT-4o-mini after all")
    else:
        print("\n❌ No items detected")

if __name__ == "__main__":
    main()





