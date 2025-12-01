"""
DINO-X with Native Captioning
Use DINO-X's built-in caption feature for detailed descriptions
No GPT-4o-mini needed!
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
FASHION_PROMPT = "shirt. jacket. blouse. skirt. shorts. pants. shoes. bag. dress. coat. sweater. cardigan. hoodie. jeans. sneakers. boots. sandals. backpack. purse. handbag. hat. cap. scarf. belt. watch. sunglasses. jewelry. necklace. bracelet. earrings. ring"

# Category mapping
CATEGORY_MAPPING = {
    'shirt': 'top', 'blouse': 'top', 'jacket': 'outerwear', 'coat': 'outerwear',
    'sweater': 'top', 'cardigan': 'outerwear', 'hoodie': 'top', 'dress': 'dress',
    'skirt': 'bottom', 'shorts': 'bottom', 'pants': 'bottom', 'jeans': 'bottom',
    'shoes': 'shoes', 'sneakers': 'shoes', 'boots': 'shoes', 'sandals': 'shoes',
    'bag': 'bag', 'backpack': 'bag', 'purse': 'bag', 'handbag': 'bag',
    'hat': 'accessories', 'cap': 'accessories', 'scarf': 'accessories',
    'belt': 'accessories', 'watch': 'accessories', 'sunglasses': 'accessories',
    'jewelry': 'accessories', 'necklace': 'accessories', 'bracelet': 'accessories',
    'earrings': 'accessories', 'ring': 'accessories'
}

def image_url_to_base64(image_url: str) -> str:
    """Convert image URL to base64 data URI"""
    try:
        if image_url.startswith('data:image'):
            return image_url
        
        if image_url.startswith('http'):
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            image_data = response.content
            content_type = response.headers.get('content-type', 'image/jpeg')
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return f"data:{content_type};base64,{base64_data}"
        
        if os.path.exists(image_url):
            with open(image_url, 'rb') as f:
                image_data = f.read()
            ext = os.path.splitext(image_url)[1].lower()
            mime_type = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}.get(ext, 'image/jpeg')
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return f"data:{mime_type};base64,{base64_data}"
        
        raise ValueError(f"Invalid image URL or path: {image_url}")
    except Exception as e:
        logger.error(f"Failed to convert image to base64: {e}")
        raise

def create_caption_task(image_url: str, regions: List[List[float]]) -> Optional[str]:
    """
    Create DINO-X task to caption specific regions
    
    Args:
        image_url: Image URL or path
        regions: List of bboxes [[x1, y1, x2, y2], ...]
        
    Returns:
        task_uuid if successful
    """
    try:
        logger.info(f"Creating DINO-X caption task for {len(regions)} regions...")
        
        base64_image = image_url_to_base64(image_url)
        
        payload = {
            "model": "DINO-X-1.0",
            "image": base64_image,
            "regions": regions,
            "targets": ["caption"],  # Just captions for these regions
        }
        
        headers = {
            'Token': DINOX_API_TOKEN,
            'Content-Type': 'application/json'
        }
        
        url = f"{DINOX_API_BASE}{DINOX_CREATE_TASK}"
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        task_uuid = result.get('data', {}).get('task_uuid') or result.get('data', {}).get('uuid')
        
        if task_uuid:
            logger.info(f"✅ Caption task created: {task_uuid}")
            return task_uuid
        else:
            logger.error(f"No UUID in caption response: {result}")
            return None
            
    except Exception as e:
        logger.error(f"Failed to create caption task: {e}")
        return None

def query_task_result(task_uuid: str, max_wait: int = 60) -> Optional[Dict[str, Any]]:
    """Poll for DINO-X task results"""
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
                logger.info(f"✅ Task completed in {elapsed:.2f}s ({poll_count} polls)")
                return data.get('result', {})
            
            elif status in ['failed', 'error']:
                error_msg = data.get('error', 'Unknown error')
                logger.error(f"Task failed: {error_msg}")
                return None
            
            time.sleep(2)
        
        logger.warning(f"Task timeout after {max_wait}s")
        return None
        
    except Exception as e:
        logger.error(f"Failed to query task: {e}")
        return None

class DINOXCaptionAnalyzer:
    """DINO-X Analyzer with native captioning"""
    
    def __init__(self):
        logger.info("🚀 DINO-X Caption Analyzer initialized")
    
    def analyze_fashion_items(self, image_url: str) -> Dict[str, Any]:
        """
        Analyze fashion items using DINO-X detection + native captions
        
        Returns: Dict with detected items in standard format
        """
        start_time = time.time()
        
        try:
            logger.info(f"🤖 DINO-X Caption: Starting analysis...")
            
            # Step 1: Detection (get bboxes)
            logger.info("Step 1: Detecting items with DINO-X...")
            base64_image = image_url_to_base64(image_url)
            
            detect_payload = {
                "model": "DINO-X-1.0",
                "image": base64_image,
                "prompt": {"type": "text", "text": FASHION_PROMPT},
                "targets": ["bbox"],
                "bbox_threshold": 0.25,
                "iou_threshold": 0.8
            }
            
            headers = {'Token': DINOX_API_TOKEN, 'Content-Type': 'application/json'}
            url = f"{DINOX_API_BASE}{DINOX_CREATE_TASK}"
            
            response = requests.post(url, headers=headers, json=detect_payload, timeout=60)
            response.raise_for_status()
            
            task_uuid = response.json().get('data', {}).get('task_uuid')
            if not task_uuid:
                raise Exception("No task UUID from detection")
            
            detect_result = query_task_result(task_uuid)
            if not detect_result:
                raise Exception("Failed to get detection results")
            
            objects = detect_result.get('objects', [])
            logger.info(f"📦 Detected {len(objects)} objects")
            
            if len(objects) == 0:
                return {'items': [], 'meta': {'detector': 'dinox_caption', 'processing_time': time.time() - start_time}}
            
            # Step 2: Get captions for detected regions
            logger.info("Step 2: Generating captions with DINO-X...")
            regions = [obj.get('bbox', []) for obj in objects if obj.get('bbox')]
            
            caption_uuid = create_caption_task(image_url, regions)
            if not caption_uuid:
                # Fallback: use generic descriptions
                logger.warning("Caption task failed, using generic descriptions")
                captions = [None] * len(objects)
            else:
                caption_result = query_task_result(caption_uuid)
                if caption_result and 'captions' in caption_result:
                    captions = caption_result.get('captions', [])
                else:
                    captions = [None] * len(objects)
            
            # Step 3: Combine detection + captions
            items = []
            for i, obj in enumerate(objects):
                category = obj.get('category', 'unknown')
                bbox = obj.get('bbox', [])
                confidence = obj.get('score', 0.0)
                caption = captions[i] if i < len(captions) and captions[i] else f"{category}"
                
                mapped_category = CATEGORY_MAPPING.get(category.lower(), 'accessories')
                
                items.append({
                    'category': mapped_category,
                    'bbox': bbox,
                    'confidence': confidence,
                    'groundingdino_prompt': category,
                    'description': caption if caption else f"{category} fashion item"
                })
            
            elapsed = time.time() - start_time
            logger.info(f"✅ Complete in {elapsed:.2f}s with {len(items)} items")
            
            return {
                'items': items,
                'meta': {
                    'detector': 'dinox_caption',
                    'processing_time': round(elapsed, 2),
                    'num_detections': len(objects)
                }
            }
            
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"❌ Analysis failed after {elapsed:.2f}s: {e}")
            return {
                'items': [],
                'meta': {
                    'detector': 'dinox_caption',
                    'processing_time': round(elapsed, 2),
                    'error': str(e)
                }
            }





