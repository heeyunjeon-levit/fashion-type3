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
from PIL import Image
from io import BytesIO

logger = logging.getLogger(__name__)

# Try to import OpenAI for detailed descriptions (optional)
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
    openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
except ImportError:
    OPENAI_AVAILABLE = False
    openai_client = None

# DINO-X API Configuration
DINOX_API_BASE = 'https://api.deepdataspace.com'
DINOX_CREATE_TASK = '/v2/task/dinox/detection'
DINOX_QUERY_STATUS = '/v2/task_status'
DINOX_API_TOKEN = os.environ.get('DINOX_API_TOKEN', 'bdf2ed490ebe69a28be81ea9d9b0b0e3')

# Fashion categories for detection (ordered by priority for better detection)
# Note: Excluded "leggings" as it's often confused with socks and causes false positives
FASHION_CATEGORIES = [
    "fur coat", "fur jacket", "leather jacket", "coat", "jacket",
    "dress", "blouse", "shirt", "button up shirt", "sweater", "cardigan", "hoodie", "vest",
    "pants", "jeans", "shorts", "skirt",
    "shoes", "sneakers", "boots", "sandals",
    "bag", "backpack", "purse", "handbag",
    "sunglasses", "hat", "cap", "scarf", "belt", "watch",
    "jewelry", "necklace", "bracelet", "earrings", "ring"
]

FASHION_PROMPT = ". ".join(FASHION_CATEGORIES)

# Category mapping (DINO-X category -> our standard categories)
CATEGORY_MAPPING = {
    'fur coat': 'outerwear',
    'fur jacket': 'outerwear',
    'leather jacket': 'outerwear',
    'jacket': 'outerwear',
    'coat': 'outerwear',
    'shirt': 'top',
    'button up shirt': 'top',
    'button_up_shirt': 'top',
    'blouse': 'top',
    'sweater': 'top',
    'cardigan': 'outerwear',
    'hoodie': 'top',
    'dress': 'dress',
    'skirt': 'bottom',
    'shorts': 'bottom',
    'pants': 'bottom',
    'jeans': 'bottom',
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
        
        # Prepare request - DINO-X doesn't support bbox+caption together
        # We'll use bbox for detection, then enhance descriptions with GPT-4o mini (fast & cheap)
        payload = {
            "model": "DINO-X-1.0",
            "image": base64_image,
            "prompt": {
                "type": "text",
                "text": FASHION_PROMPT
            },
            "targets": ["bbox"],  # Just bbox for now
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
        task_uuid = result.get('data', {}).get('task_uuid') or result.get('data', {}).get('uuid')
        
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


def enhance_with_gpt4o_mini(image_url: str, objects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Enhance DINO-X detections with detailed GPT-4o-mini descriptions
    
    Fast & cheap: GPT-4o-mini costs 1/60th of GPT-4o and is much faster
    
    Args:
        image_url: URL or path to the image
        objects: List of DINO-X detected objects with bboxes
        
    Returns:
        Enhanced objects with detailed descriptions
    """
    if not OPENAI_AVAILABLE or not openai_client:
        logger.warning("OpenAI not available, skipping detailed descriptions")
        return objects
    
    if len(objects) == 0:
        return objects
    
    try:
        logger.info(f"✨ Enhancing {len(objects)} detections with GPT-4o-mini descriptions...")
        
        # Load image
        if image_url.startswith('http'):
            response = requests.get(image_url, timeout=30)
            image = Image.open(BytesIO(response.content))
        elif image_url.startswith('data:image'):
            # Parse base64
            base64_str = image_url.split(',')[1]
            image_data = base64.b64decode(base64_str)
            image = Image.open(BytesIO(image_data))
        else:
            # Local file
            image = Image.open(image_url)
        
        # Convert to base64 for GPT-4o-mini
        buffered = BytesIO()
        image.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Create a prompt listing all detected items
        items_list = []
        for i, obj in enumerate(objects, 1):
            category = obj.get('category', 'unknown')
            bbox = obj.get('bbox', [])
            items_list.append(f"{i}. {category} at position {bbox}")
        
        prompt = f"""You are a fashion expert. I've detected {len(objects)} fashion items in this image:

{chr(10).join(items_list)}

For each item, provide a detailed fashion description including:
- Color and tone
- Material/fabric (if visible)
- Style details
- Fit/silhouette

Format your response as a JSON array with this structure:
[
  {{"item": 1, "description": "detailed fashion description"}},
  {{"item": 2, "description": "detailed fashion description"}},
  ...
]

Be specific and detailed like a fashion catalog would describe these items."""
        
        # Call GPT-4o-mini (fast & cheap!)
        start_time = time.time()
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img_base64}"
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        elapsed = time.time() - start_time
        logger.info(f"✅ GPT-4o-mini descriptions in {elapsed:.2f}s")
        
        # Parse response
        content = response.choices[0].message.content
        
        # Try to extract JSON
        import json
        import re
        
        # Find JSON array in response
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            descriptions = json.loads(json_match.group())
            
            # Map descriptions back to objects
            for desc_obj in descriptions:
                item_num = desc_obj.get('item', 0)
                description = desc_obj.get('description', '')
                
                if 1 <= item_num <= len(objects):
                    objects[item_num - 1]['detailed_description'] = description
                    logger.info(f"   Item {item_num}: {description[:60]}...")
        
        return objects
        
    except Exception as e:
        logger.error(f"Failed to enhance with GPT-4o-mini: {e}")
        return objects  # Return original objects without enhancement


class DINOXAnalyzer:
    """
    DINO-X Analyzer class - compatible interface with GPT4OFashionAnalyzer
    """
    
    def __init__(self):
        """Initialize DINO-X analyzer"""
        logger.info("🚀 DINO-X Analyzer initialized")
    
    def analyze_fashion_items(self, image_path: str) -> Dict[str, Any]:
        """
        Analyze fashion items in image (compatible with GPT4OFashionAnalyzer interface)
        
        Args:
            image_path: Path to image file or URL
            
        Returns:
            Dict with detected items in standard format
        """
        return analyze_image_with_dinox(image_path)


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
        
        # Step 4: Enhance with GPT-4o-mini detailed descriptions (fast & cheap!)
        enhanced_objects = enhance_with_gpt4o_mini(image_url, objects)
        
        items = []
        for obj in enhanced_objects:
            category = obj.get('category', 'unknown')
            bbox = obj.get('bbox', [])
            confidence = obj.get('score', 0.0)
            
            # Map to our standard categories
            mapped_category = map_dinox_category(category)
            
            # Use GPT-4o-mini detailed description if available, otherwise use simple category
            detailed_description = obj.get('detailed_description', category)
            
            # Create item dict (compatible with GPT-4o format)
            item = {
                'category': mapped_category,
                'bbox': bbox,
                'confidence': confidence,
                'groundingdino_prompt': category,  # Keep simple category for GroundingDINO
                'description': detailed_description  # Use detailed GPT-4o-mini description
            }
            
            items.append(item)
            logger.info(f"   - {mapped_category} ({category}, conf: {confidence:.2f})")
            if 'detailed_description' in obj:
                logger.info(f"     Description: {obj['detailed_description'][:80]}...")
        
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


def detect_bboxes_only(image_url: str, confidence_threshold: float = 0.35) -> Dict[str, Any]:
    """
    Fast detection that returns only bounding boxes without descriptions.
    Perfect for interactive UX where user selects items first.
    
    Args:
        image_url: URL to the image
        confidence_threshold: Minimum confidence score (0-1) to include detection.
                            Default 0.35 filters out low-confidence/spurious detections.
    
    Returns:
        {
            'bboxes': [
                {
                    'id': str,
                    'bbox': [x1, y1, x2, y2],
                    'category': str,
                    'confidence': float
                }
            ],
            'image_size': [width, height],
            'meta': {
                'processing_time': float,
                'total_detections': int,
                'filtered_detections': int,
                'confidence_threshold': float
            }
        }
    """
    start_time = time.time()
    
    try:
        logger.info(f"⚡ Fast DINO-X detection (threshold: {confidence_threshold})")
        
        # Step 1: Create task
        task_uuid = create_detection_task(image_url)
        if not task_uuid:
            raise Exception("Failed to create DINO-X task")
        
        # Step 2: Poll for results
        result = query_task_result(task_uuid)
        if not result:
            raise Exception("Failed to get DINO-X results")
        
        # Step 3: Parse detections and filter by confidence
        objects = result.get('objects', [])
        total_detections = len(objects)
        logger.info(f"📦 DINO-X detected {total_detections} objects")
        
        # Get image size from result
        image_info = result.get('image', {})
        image_width = image_info.get('width', 0)
        image_height = image_info.get('height', 0)
        
        bboxes = []
        for idx, obj in enumerate(objects):
            confidence = obj.get('score', 0.0)
            
            # FILTER: Only include high-confidence detections
            if confidence < confidence_threshold:
                logger.info(f"   ⏭️  Skipping low-confidence: {obj.get('category', 'unknown')} ({confidence:.2f} < {confidence_threshold})")
                continue
            
            category = obj.get('category', 'unknown')
            bbox = obj.get('bbox', [])
            
            # Map to our standard categories
            mapped_category = map_dinox_category(category)
            
            # Create unique ID
            bbox_id = f"{mapped_category}_{idx}"
            
            bbox_item = {
                'id': bbox_id,
                'bbox': bbox,  # [x1, y1, x2, y2]
                'category': mapped_category,
                'confidence': round(confidence, 3)
            }
            
            bboxes.append(bbox_item)
            logger.info(f"   ✅ {mapped_category} ({category}, conf: {confidence:.2f})")
        
        filtered_detections = len(bboxes)
        elapsed = time.time() - start_time
        
        logger.info(f"✅ Fast detection complete: {filtered_detections}/{total_detections} passed threshold")
        
        return {
            'bboxes': bboxes,
            'image_size': [image_width, image_height],
            'meta': {
                'processing_time': round(elapsed, 2),
                'total_detections': total_detections,
                'filtered_detections': filtered_detections,
                'confidence_threshold': confidence_threshold
            }
        }
        
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"❌ Fast detection failed after {elapsed:.2f}s: {e}")
        
        # Return empty result instead of raising (graceful degradation)
        return {
            'bboxes': [],
            'image_size': [0, 0],
            'meta': {
                'processing_time': round(elapsed, 2),
                'total_detections': 0,
                'filtered_detections': 0,
                'confidence_threshold': confidence_threshold,
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

