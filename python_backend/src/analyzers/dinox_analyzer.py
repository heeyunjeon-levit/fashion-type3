"""
DINO-X Analyzer - Fast object detection using DINO-X API
Alternative to GPT-4o for item detection

Speed: ~5s per image (vs GPT-4o's ~15s)
API Docs: https://cloud.deepdataspace.com/en/docs#/model/dinox
"""

import os
import time
import base64
import logging
import requests
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# DINO-X API Configuration
DINOX_API_BASE = 'https://api.deepdataspace.com'
DINOX_CREATE_TASK = '/v2/task/dinox/detection'
DINOX_QUERY_STATUS = '/v2/task_status'
DINOX_API_TOKEN = os.environ.get('DINOX_API_TOKEN', 'bdf2ed490ebe69a28be81ea9d9b0b0e3')

# Fashion categories for detection
FASHION_CATEGORIES = [
    "shirt", "jacket", "blouse", "button up shirt", "vest", "skirt", 
    "shorts", "pants", "shoes", "bag", "dress", "coat", "sweater", 
    "cardigan", "hoodie", "jeans", "leggings", "sneakers", "boots", 
    "sandals", "backpack", "purse", "handbag", "hat", "cap", "scarf", 
    "belt", "watch", "sunglasses", "jewelry", "necklace", "bracelet", 
    "earrings", "ring"
]

FASHION_PROMPT = ". ".join(FASHION_CATEGORIES)

# Category mapping (DINO-X category -> our standard categories)
CATEGORY_MAPPING = {
    'shirt': 'top',
    'blouse': 'top',
    'jacket': 'outerwear',
    'coat': 'outerwear',
    'sweater': 'top',
    'cardigan': 'outerwear',
    'hoodie': 'top',
    'dress': 'dress',
    'skirt': 'bottom',
    'shorts': 'bottom',
    'pants': 'bottom',
    'jeans': 'bottom',
    'leggings': 'bottom',
    'shoes': 'shoes',
    'sneakers': 'shoes',
    'boots': 'shoes',
    'sandals': 'shoes',
    'bag': 'bag',
    'backpack': 'bag',
    'purse': 'bag',
    'handbag': 'bag',
    'hat': 'accessories',
    'cap': 'accessories',
    'scarf': 'accessories',
    'belt': 'accessories',
    'watch': 'accessories',
    'sunglasses': 'accessories',
    'jewelry': 'accessories',
    'necklace': 'accessories',
    'bracelet': 'accessories',
    'earrings': 'accessories',
    'ring': 'accessories'
}


def image_url_to_base64(image_url: str) -> str:
    """Convert image URL to base64 data URI"""
    try:
        # If already base64, return as is
        if image_url.startswith('data:image'):
            return image_url
        
        # If HTTP URL, download and convert
        if image_url.startswith('http'):
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            image_data = response.content
            
            # Determine mime type from URL or content type
            content_type = response.headers.get('content-type', 'image/jpeg')
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return f"data:{content_type};base64,{base64_data}"
        
        # Local file path
        if os.path.exists(image_url):
            with open(image_url, 'rb') as f:
                image_data = f.read()
            
            ext = os.path.splitext(image_url)[1].lower()
            mime_type = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp'
            }.get(ext, 'image/jpeg')
            
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return f"data:{mime_type};base64,{base64_data}"
        
        raise ValueError(f"Invalid image URL or path: {image_url}")
        
    except Exception as e:
        logger.error(f"Failed to convert image to base64: {e}")
        raise


def create_detection_task(image_url: str) -> Optional[str]:
    """
    Create DINO-X detection task
    
    Returns:
        task_uuid if successful, None otherwise
    """
    try:
        logger.info(f"Creating DINO-X detection task for image: {image_url[:50]}...")
        
        # Convert image to base64
        base64_image = image_url_to_base64(image_url)
        
        # Prepare request
        payload = {
            "model": "DINO-X-1.0",
            "image": base64_image,
            "prompt": {
                "type": "text",
                "text": FASHION_PROMPT
            },
            "targets": ["bbox"],
            "bbox_threshold": 0.25,
            "iou_threshold": 0.8
        }
        
        headers = {
            'Token': DINOX_API_TOKEN,
            'Content-Type': 'application/json'
        }
        
        url = f"{DINOX_API_BASE}{DINOX_CREATE_TASK}"
        
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        task_uuid = result.get('data', {}).get('uuid')
        
        if task_uuid:
            logger.info(f"✅ DINO-X task created: {task_uuid}")
            return task_uuid
        else:
            logger.error(f"No UUID in response: {result}")
            return None
            
    except Exception as e:
        logger.error(f"Failed to create DINO-X task: {e}")
        return None


def query_task_result(task_uuid: str, max_wait: int = 60) -> Optional[Dict[str, Any]]:
    """
    Poll for DINO-X task results
    
    Returns:
        Detection result dict if successful, None otherwise
    """
    try:
        logger.info(f"Polling DINO-X task: {task_uuid}")
        
        headers = {
            'Token': DINOX_API_TOKEN,
            'Content-Type': 'application/json'
        }
        
        url = f"{DINOX_API_BASE}{DINOX_QUERY_STATUS}/{task_uuid}"
        
        start_time = time.time()
        poll_count = 0
        
        while time.time() - start_time < max_wait:
            poll_count += 1
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            data = result.get('data', {})
            status = data.get('status')
            
            if status == 'success':
                elapsed = time.time() - start_time
                logger.info(f"✅ DINO-X task completed in {elapsed:.2f}s ({poll_count} polls)")
                return data.get('result', {})
            
            elif status in ['failed', 'error']:
                error_msg = data.get('error', 'Unknown error')
                logger.error(f"DINO-X task failed: {error_msg}")
                return None
            
            # Still processing
            time.sleep(2)
        
        logger.warning(f"DINO-X task timeout after {max_wait}s")
        return None
        
    except Exception as e:
        logger.error(f"Failed to query DINO-X task: {e}")
        return None


def map_dinox_category(dinox_category: str) -> str:
    """Map DINO-X category to our standard category"""
    return CATEGORY_MAPPING.get(dinox_category.lower(), 'accessories')


def analyze_image_with_dinox(image_url: str) -> Dict[str, Any]:
    """
    Analyze image using DINO-X API
    
    Returns dict with same structure as GPT-4o analyzer for compatibility:
    {
        'items': [
            {
                'category': str,
                'bbox': [x1, y1, x2, y2],
                'confidence': float,
                'groundingdino_prompt': str,
                'description': str
            }
        ],
        'meta': {
            'detector': 'dinox',
            'processing_time': float,
            'num_detections': int
        }
    }
    """
    start_time = time.time()
    
    try:
        logger.info(f"🤖 DINO-X: Starting analysis for {image_url[:50]}...")
        
        # Step 1: Create task
        task_uuid = create_detection_task(image_url)
        if not task_uuid:
            raise Exception("Failed to create DINO-X task")
        
        # Step 2: Poll for results
        result = query_task_result(task_uuid)
        if not result:
            raise Exception("Failed to get DINO-X results")
        
        # Step 3: Parse detections
        objects = result.get('objects', [])
        logger.info(f"📦 DINO-X detected {len(objects)} objects")
        
        items = []
        for obj in objects:
            category = obj.get('category', 'unknown')
            bbox = obj.get('bbox', [])
            confidence = obj.get('score', 0.0)
            
            # Map to our standard categories
            mapped_category = map_dinox_category(category)
            
            # Create item dict (compatible with GPT-4o format)
            item = {
                'category': mapped_category,
                'bbox': bbox,
                'confidence': confidence,
                'groundingdino_prompt': category,  # Use DINO-X category as prompt
                'description': f"{category} detected by DINO-X"  # Simple description
            }
            
            items.append(item)
            logger.info(f"   - {mapped_category} ({category}, conf: {confidence:.2f})")
        
        elapsed = time.time() - start_time
        
        return {
            'items': items,
            'meta': {
                'detector': 'dinox',
                'processing_time': round(elapsed, 2),
                'num_detections': len(objects),
                'task_uuid': task_uuid
            }
        }
        
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"❌ DINO-X analysis failed after {elapsed:.2f}s: {e}")
        
        # Return empty result instead of raising
        return {
            'items': [],
            'meta': {
                'detector': 'dinox',
                'processing_time': round(elapsed, 2),
                'num_detections': 0,
                'error': str(e)
            }
        }


if __name__ == "__main__":
    # Test with a sample image
    logging.basicConfig(level=logging.INFO)
    
    test_image = "https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1763748884783_0214d4bd3a05-IMG_6128_.jpg"
    
    print("Testing DINO-X analyzer...")
    result = analyze_image_with_dinox(test_image)
    
    print(f"\n✅ Analysis complete!")
    print(f"Detector: {result['meta']['detector']}")
    print(f"Time: {result['meta']['processing_time']}s")
    print(f"Detections: {result['meta']['num_detections']}")
    print(f"\nItems:")
    for item in result['items']:
        print(f"  - {item['category']}: {item['description']}")

