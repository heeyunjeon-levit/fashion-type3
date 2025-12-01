#!/usr/bin/env python3
"""Test detect_bboxes_only locally to see if there's an error"""

import sys
sys.path.insert(0, '/Users/levit/Desktop/mvp/python_backend')

# Set up environment
import os
os.environ['DINOX_API_TOKEN'] = 'bdf2ed490ebe69a28be81ea9d9b0b0e3'

try:
    from src.analyzers.dinox_analyzer import detect_bboxes_only
    print("✅ Import successful")
    
    # Test with a simple image
    test_image = "https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/test.jpg"
    
    print(f"\n🧪 Testing detection with: {test_image}")
    result = detect_bboxes_only(test_image)
    
    print(f"\n✅ Detection successful!")
    print(f"   Total detections: {result['meta']['total_detections']}")
    print(f"   Filtered detections: {result['meta']['filtered_detections']}")
    print(f"   Threshold: {result['meta']['confidence_threshold']}")
    print(f"   Processing time: {result['meta']['processing_time']}s")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

