#!/usr/bin/env python3

import base64
import json
import os
from openai import OpenAI
from PIL import Image
import io
from dotenv import load_dotenv

# Load environment variables from .env file (override existing)
load_dotenv(override=True)

class GPT4OFashionAnalyzer:
    def __init__(self, api_key=None):
        """Initialize GPT-4o analyzer for fashion item detection"""
        if api_key:
            self.api_key = api_key
        else:
            # Try to get from environment
            self.api_key = os.getenv('OPENAI_API_KEY')
        
        if not self.api_key:
            raise ValueError("OpenAI API key required. Set OPENAI_API_KEY environment variable or pass api_key parameter")
        
        self.client = OpenAI(api_key=self.api_key)
    
    def encode_image(self, image_path):
        """Encode image to base64 for GPT-4o vision"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def analyze_fashion_items(self, image_path):
        """Analyze image and get fashion item descriptions"""
        
        # Encode image
        base64_image = self.encode_image(image_path)
        
        # First prompt: Count and identify fashion items
        count_prompt = """
        Look at this fashion image and identify all the fashion items visible in the image.

        CRITICAL VISIBILITY RULE: Only detect items that you can actually SEE in the image. Do NOT assume or guess that items exist. If the image is cut off at the knees, do NOT detect any footwear (shoes, boots, sandals). If the image is cut off at the waist, do NOT detect any bottom clothing items.

        CRITICAL EMBELLISHMENT RULE: Do NOT detect dress embellishments, decorative details, or patterns as separate accessories. If a dress has sparkling details around the neckline, waistline, or anywhere else, these are PART OF THE DRESS, not separate necklaces, belts, or accessories. Only detect standalone accessories that are physically separate from clothing items.

        MULTI-PERSPECTIVE DETECTION: If the image shows multiple perspectives or views of the same person/outfit, detect items from ALL perspectives. Look carefully for accessories that may be visible in different angles or views. Scan each perspective separately for rings, bracelets, earrings, and other accessories.

        ACCESSORY SCANNING: Carefully examine wrists for bracelets, fingers for rings, ears for earrings, neck for necklaces. Look at different angles and perspectives in the image. Pay special attention to hands and fingers - rings can be very small but are important accessories. CRITICAL: Always check the ear area for earrings - even small studs or hoops are important fashion accessories.

        ANALYSIS APPROACH:
        - If there's a PERSON in the image: Focus on items worn by the person (outfit analysis)
        - If there's NO PERSON: Focus on fashion items visible in the scene (display, hanging, etc.)
        - Always identify fashion items regardless of whether a person is present

        SYSTEMATIC DETECTION METHODOLOGY:
        1. ESSENTIAL ITEMS (if full person visible):
           - DRESS: If wearing a dress, detect as "dress" item (base layer)
           - OUTER LAYER: If jacket/cardigan worn over dress, detect as separate "jacket" item
           - TOP: ALL visible layers (shirt, blouse, sweater, jacket, etc.) - ONLY if NOT wearing a dress
           - BOTTOM: pants, skirt, shorts, jeans, etc. - ONLY if NOT wearing a dress
           - SHOES: sneakers, boots, sandals, heels, flats, etc.
           - IMPORTANT: Only detect footwear if you can actually SEE the shoes/boots in the image
           - Do NOT detect shoes/boots if the image is cut off at the knees or ankles
           - Do NOT assume footwear is there - only detect what you can actually see
           
           CRITICAL: Check if person is wearing a DRESS first!
           - If DRESS + JACKET: Detect "dress" + "jacket" as separate items
           - If DRESS ONLY: Detect as single "dress" item
           - If SEPARATE TOP/BOTTOM: Detect top and bottom as separate items
           
           DRESS RECOGNITION: A dress is a single garment that covers both upper and lower body.
           If you see a single garment covering torso and legs, it's a DRESS.
           
           LAYERED DRESS: If jacket/cardigan is worn over a dress, detect both:
           - The dress (base layer)
           - The jacket/cardigan (outer layer)
           
           IMPORTANT: Detect ALL visible top layers separately (e.g., shirt + jacket, 
           sweater + blazer, tank top + cardigan, etc.) - BUT ONLY if not wearing a dress
           
           LAYER DETECTION: Even if only parts of inner layers are visible (like shirt 
           collars, cuffs, or hems), detect them as separate items! - BUT ONLY if not wearing a dress
        
        2. STATUS SYMBOLS:
           - BAG: handbag, tote, clutch, backpack, etc. (very noticeable)
        
        3. ACCESSORIES (head to toe scan):
           - HEAD: glasses, sunglasses, hat, cap, headband
           - NECK: necklace, choker, scarf
           - EARS: earrings, ear cuffs
           - WRISTS/HANDS: watch, bracelet, rings
           - WAIST: belt, waist bag
           - HANDS: phone case, phone accessories, items held in hands
           - FEET: socks, stockings (detect separately from shoes)
           
           IMPORTANT: For HANDS category:
           - Phone cases: ONLY detect if the person is actively holding the phone
           - Items held: ONLY detect if clearly visible being held by the person
           - Do NOT detect phones/phones cases that are just visible in the scene
           - Do NOT detect items that are not physically connected to the person's hands
           - Be VERY conservative with phone detection - only detect if absolutely certain
           - Do NOT detect phones held by stands, tripods, or other supports
           - Do NOT detect phones that are visible but not in the person's hands
           - CRITICAL: If both hands are visible and empty, do NOT detect any phones
        
        IF NO PERSON IS VISIBLE:
        Focus on fashion items visible in the scene:
        - Clothing items on display, hanging, or laid out
        - Bags, backpacks, purses, handbags visible in the scene
        - Shoes, boots, sandals visible in the scene
        - Accessories visible in the scene (jewelry, watches, etc.)
        - Water bottles, drink containers if they're fashion accessories
        - Fashion items that are the main focus of the image
        - Items that would be part of a fashion outfit
        - Do NOT detect items worn by people holding/displaying items
        - Do NOT detect accessories on hands holding hangers, mannequins, etc.
        - Focus ONLY on the main fashion items being showcased
        - IMPORTANT: Detect ALL visible bags/backpacks separately (don't group them)
        - IMPORTANT: Include water bottles if they're fashion accessories
        
        PRIORITIZE BOLD & EYE-CATCHING ITEMS:
        - Choose the MOST PROMINENT item from each category
        - Prioritize BOLD, EYE-CATCHING accessories over subtle ones
        - ALWAYS include glasses/sunglasses if visible (they are very eye-catching)
        - ALWAYS include earrings if visible (they are very eye-catching)
        - ALWAYS include rings if visible (they are very eye-catching)
        - ALWAYS include bracelets if visible (they are very eye-catching)
        - ALWAYS include socks if visible (they complete the outfit)
        - IMPORTANT: In multi-perspective images, check ALL views for accessories
        - CRITICAL: Be thorough in scanning for rings, bracelets, earrings, necklaces
        - Look carefully at hands, wrists, fingers, ears, neck in ALL perspectives
        - CRITICAL: Always examine the ear area carefully for earrings - they can be small but important
        - IMPORTANT: Rings can be small - examine fingers carefully in all views
        - For rings: Even if small, detect them if you can see them (they're important accessories)
        - For earrings: Even if small or subtle, detect them if you can see them (they're important accessories)
        - EXCLUDE barely visible items that are not noticeable to human eye
        - Only detect accessories that are CLEARLY VISIBLE and make a visual impact
        - Only detect accessories that are OBVIOUSLY VISIBLE to a casual observer
        - EXCLUDE subtle accessories that require careful examination to notice
        - Avoid multiple items of the same type (e.g., if multiple rings, choose the most statement piece)
        - Focus on items that clearly complete and define the outfit
        
        You should not identify the following items:
        - Background elements
        - Fashion items of other people who are not the main subject
        - Parts of the clothing items that may look like a standalone accessory (e.g. embellishments that may look like a separate necklace)
        - Separate product photos or catalogue items (focus only on worn items)
        - Items that are NOT clearly visible or are barely noticeable
        - Items that you assume might be there but cannot clearly see
        - Items that are cut off or not visible in the image
        - Items that are outside the visible frame of the image
        - Items that you cannot actually see (only assume are there)
        - Footwear (shoes, boots, sandals) if the image is cut off at the knees or ankles
        - Items that are below the visible frame (like shoes when image cuts at knees)
        - Parts of items already detected (e.g., bag straps, shirt collars, shoe laces)
        - Sub-components of main items (detect the whole item, not its parts)
        - Dress embellishments, decorative details, or patterns that are part of the dress itself
        - Necklace-like embellishments that are actually part of a dress (not separate accessories)
        - Decorative elements that are integrated into clothing items (not standalone accessories)
        - Non-fashion items (plants, furniture, objects, environmental items)
        - Items not worn or carried by the person (background objects)
        - Items that are not actually held by the person (phones not in hand, etc.)
        - Items that are just present in the scene but not part of the outfit
        - Phones or phone cases that are visible but not being held by the person
        - Items that are in the background or environment but not worn
        - Phones held by stands, tripods, or other supports (not by the person)
        - Items worn by people holding/displaying fashion items (not part of main outfit)
        - Accessories on hands holding hangers, mannequins, or display items
        - Hair, hairstyles, or hair color (not fashion accessories)
        - Body parts or natural features (hair, skin, etc.)

        
        Please respond with a JSON object in this exact format:
        {
            "total_items": <number>,
            "items": [
                {
                    "item_type": "<type of clothing/accessory>",
                    "description": "<detailed visual description describing the fabric, color, and any other relevant details>",
                    "groundingdino_prompt": "<use detectable noun only - no location words>"
                }
            ]
        }
        
        Follow this SYSTEMATIC DETECTION ORDER:
        
        1. ESSENTIALS (if full person visible):
           ✅ DRESS: If wearing a dress, detect as "dress" (base layer)
           ✅ OUTER LAYER: If jacket/cardigan over dress, detect as separate "jacket"
           ✅ TOP: ALL visible layers (shirt + jacket, sweater + blazer, etc.) - ONLY if NOT wearing a dress
           ✅ BOTTOM: pants, skirt, shorts, jeans - ONLY if NOT wearing a dress
           ✅ SHOES: sneakers, boots, sandals, heels, flats
        
        2. STATUS SYMBOLS:
           ✅ BAG: handbag, tote, clutch, backpack (very noticeable)
        
        3. ACCESSORIES (head to toe - choose MOST EYE-CATCHING):
           ✅ HEAD: glasses, sunglasses, hat, cap, headband
           ✅ NECK: necklace, choker, scarf
           ✅ EARS: earrings, ear cuffs  
           ✅ WRISTS/HANDS: watch, bracelet, rings
           ✅ FEET: socks, stockings (detect separately from shoes)
        
        FOCUS ON FASHION ITEMS IN THE IMAGE:
        - If person is visible: Items worn by the main person in the image
        - If no person: Fashion items visible in the scene (display, hanging, etc.)
        - Complete outfit from head to toe (if person visible)
        - Bold, eye-catching accessories
        -         CRITICAL: Only detect items that are CLEARLY VISIBLE in the image
        - Do NOT assume items are there - only detect what you can actually see
        - Do NOT detect items that are barely visible or that you're guessing might be there
        - EARRING DETECTION: Be EXTREMELY conservative - only detect earrings if they are large, bold, and unmistakably visible (skip small studs, subtle earrings, or anything you're unsure about)
        - Do NOT detect footwear if the image is cut off at the knees/ankles
        - Only detect shoes/boots if you can actually SEE them in the image
        - Do NOT detect phones/phone cases unless the person is actively holding them
        - Focus on items that are physically attached to or held by the person
        - Be EXTREMELY conservative with phone detection - only if 100% certain
        - Do NOT detect phones held by stands, tripods, or other equipment
        - CRITICAL: If both hands are visible and empty, do NOT detect any phones
        
        IMPORTANT: Detect socks as a separate item from shoes, even if they're visible together.
        
        CRITICAL ACCESSORY DETECTION:
        - ALWAYS detect glasses/sunglasses if OBVIOUSLY visible (scan the face area carefully)
        - CONSERVATIVE earring detection: Only detect earrings if they are LARGE, BOLD, and CLEARLY VISIBLE (small studs or subtle earrings should be SKIPPED)
        - ALWAYS detect rings if OBVIOUSLY visible (scan the hands/fingers carefully)
        - ALWAYS detect belts if OBVIOUSLY visible (scan the waist area carefully)
        - ALWAYS detect phone cases if OBVIOUSLY visible (scan the hands/phone area carefully)
        - ALWAYS detect items held in hands (phones, phone cases, small accessories)
        - ALWAYS detect socks if OBVIOUSLY visible (scan the feet/ankle area carefully)
        
        SELECTION RULES:
        - Scan systematically from head to toe
        - Choose MOST EYE-CATCHING item from each category
        - Prioritize BOLD, VISIBLE accessories over subtle ones
        - For tops: Detect ALL visible layers (don't skip inner layers)
        - EXCLUDE barely visible items (only detect clearly noticeable accessories)
        - Avoid duplicates (e.g., multiple rings → choose statement piece)
        - Do NOT detect parts of items already detected (bag straps, collars, laces, etc.)
        - Do NOT detect dress embellishments as separate accessories (necklace-like details are part of dress)
        - Do NOT detect decorative elements that are integrated into clothing items
        - Do NOT detect non-fashion items (plants, furniture, background objects)
        - Do NOT detect items that are not actually worn or held by the person
        - Focus on items that make a visual impact
        
         CRITICAL RULES FOR GROUNDINGDINO_PROMPT:
         - Use lowercase, singular nouns only; limit to at most 3 words
         - Use ONLY detectable noun phrases with color/material descriptors
         - NEVER include location words: "on", "in", "over", "under", "with", "held", "visible", "worn", "hanging", "near", "behind", "underneath", "inside", "outside"
         - NEVER include body parts: "wrist", "hand", "legs", "torso", "waist", "arm", "neck", "shoulder"
         - NEVER include action phrases: "worn", "held", "visible", "hanging", "carrying"
         - Move any attributes after "with ..." into description; do NOT include them in groundingdino_prompt
         - No punctuation, conjunctions, or prepositions
         - Each prompt should be a simple, clean item description only
         
         GOOD EXAMPLES OF GROUNDINGDINO_PROMPT (USE THESE):
         - "black jacket"
         - "white shirt"
         - "black bag"
         - "silver watch"
         - "blue dress"
         - "brown shoes"

        """
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": count_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=2000
            )
            
            # Parse JSON response
            content = response.choices[0].message.content
            
            # Handle markdown code blocks (```json ... ```)
            if content.strip().startswith('```json'):
                # Extract JSON from markdown code block
                lines = content.strip().split('\n')
                json_lines = []
                in_json = False
                for line in lines:
                    if line.strip() == '```json':
                        in_json = True
                        continue
                    elif line.strip() == '```':
                        in_json = False
                        break
                    elif in_json:
                        json_lines.append(line)
                json_str = '\n'.join(json_lines)
            else:
            # Extract JSON from response (in case there's extra text)
            start_idx = content.find('{')
            end_idx = content.rfind('}') + 1
            json_str = content[start_idx:end_idx]
            
            result = json.loads(json_str)
            
            # Validate and clean groundingdino_prompt fields
            result = self._validate_and_clean_prompts(result)
            
            # Additional validation: Check for false detections using image analysis
            # Temporarily disabled due to GPT-4o vision limitations with accessories
            print(f"⚠️  Detection validation disabled - keeping all {len(result['items'])} detected items")
            
            return result
            
        except Exception as e:
            print(f"Error analyzing image with GPT-4o: {e}")
            print(f"Raw response content: {repr(response.choices[0].message.content) if 'response' in locals() else 'No response'}")
            return None
    
    def _validate_and_clean_prompts(self, result):
        """Validate and clean groundingdino_prompt fields"""
        if not result or 'items' not in result:
            return result
        
        # Cap maximum items to prevent over-detection
        max_items = 12
        if len(result['items']) > max_items:
            result['items'] = result['items'][:max_items]
            result['total_items'] = len(result['items'])
        
        # Clean each groundingdino_prompt
        banned_words = {
            'location': ['on', 'in', 'over', 'under', 'with', 'held', 'visible', 'worn', 'hanging', 'near', 'behind', 'underneath', 'inside', 'outside'],
            'body_parts': ['wrist', 'legs', 'torso', 'waist', 'arm', 'neck', 'shoulder'],
            'actions': ['worn', 'held', 'visible', 'hanging', 'carrying']
        }
        
        # Whitelist legitimate fashion items that contain banned words
        fashion_item_whitelist = [
            'handbag', 'handbags', 'necklace', 'necklaces', 'wristwatch', 'wristwatches',
            'shoulder bag', 'shoulder bags', 'waist bag', 'waist bags',
            'ring', 'rings', 'gold ring', 'silver ring', 'rose gold ring',
            'bracelet', 'bracelets', 'thin bracelet', 'thick bracelet', 'gold bracelet', 'silver bracelet',
            'pigeon bag', 'bag', 'bags', 'backpack', 'backpacks', 'tote bag', 'crossbody bag', 'clutch', 'clutches',
            'glasses', 'sunglasses', 'tinted glasses', 'tinted sunglasses', 'clear glasses',
            'earrings', 'earring', 'gold earrings', 'silver earrings', 'hoop earrings', 'stud earrings',
            'socks', 'stockings', 'ankle socks', 'white socks', 'black socks',
            'turtleneck', 'turtlenecks', 'striped turtleneck', 'striped shirt',
            'pink shirt', 'blue shirt', 'white shirt', 'black shirt', 'red shirt', 'green shirt',
            'phone case', 'phone cases', 'phone', 'phones',
            'dress', 'dresses', 'maxi dress', 'mini dress', 'midi dress', 'sweater dress',
            'water bottle', 'water bottles', 'bottle', 'bottles'
        ]
        
        # Blacklist for non-fashion items that should never be detected
        non_fashion_blacklist = [
            'hair', 'red hair', 'blonde hair', 'brown hair', 'black hair', 'hairstyle', 'hairstyles',
            'skin', 'face', 'eyes', 'nose', 'mouth', 'teeth', 'facial features', 'body parts'
        ]
        
        cleaned_items = []
        for item in result['items']:
            if 'groundingdino_prompt' not in item or not item['groundingdino_prompt']:
                continue
            
            prompt = item['groundingdino_prompt'].lower().strip()
            
            # Check for banned words (with whitelist exceptions)
            has_banned_word = False
            prompt_lower = prompt.lower()
            
            # Check if it's in the non-fashion blacklist
            if any(blacklisted in prompt_lower for blacklisted in non_fashion_blacklist):
                print(f"⚠️ Removed non-fashion item '{prompt}': contains blacklisted term")
                continue
            
            # Check if it's a whitelisted fashion item
            is_whitelisted = any(whitelist_item in prompt_lower for whitelist_item in fashion_item_whitelist)
            
            if not is_whitelisted:
                for category, words in banned_words.items():
                    for word in words:
                        if word in prompt_lower:
                            print(f"⚠️ Removed item with banned {category} word '{word}': {item['groundingdino_prompt']}")
                            has_banned_word = True
                            break
                    if has_banned_word:
                        break
            
            if not has_banned_word:
                # Clean the prompt: lowercase, singular, max 3 words
                words = prompt.split()[:3]  # Limit to 3 words
                cleaned_prompt = ' '.join(words)
                item['groundingdino_prompt'] = cleaned_prompt
                cleaned_items.append(item)
        
        result['items'] = cleaned_items
        result['total_items'] = len(cleaned_items)
        
        return result

    def _validate_detections_with_image(self, image_path, analysis_result):
        """Validate detected items against the actual image to catch false detections."""
        try:
            from openai import OpenAI
            import base64
            
            client = OpenAI()
            
            # Load and encode the image
            with open(image_path, 'rb') as f:
                image_data = f.read()
            image_b64 = base64.b64encode(image_data).decode('utf-8')
            
            # Create validation prompt
            items_list = [item['groundingdino_prompt'] for item in analysis_result['items']]
            prompt = f"""Look at this image and verify if these fashion items are actually present:

Detected items: {items_list}

For each item, determine if it's actually present in the image. Be EXTREMELY lenient - assume items are present unless you are absolutely certain they are not there. Include small accessories, jewelry, sunglasses, phones, watches, etc.

Respond with ONLY a JSON object in this exact format:
{{
    "valid_items": ["list of items that are actually present"],
    "false_detections": ["list of items that are NOT present"],
    "reason": "brief explanation of any false detections"
}}

Default to including items as valid unless you are 100% certain they are absent."""

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_b64}",
                                    "detail": "low"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=300,
                temperature=0.1
            )
            
            # Parse response
            content = response.choices[0].message.content.strip()
            
            # Handle markdown code blocks
            if content.startswith('```json'):
                content = content[7:]
            if content.endswith('```'):
                content = content[:-3]
            content = content.strip()
            
            import json
            validation_result = json.loads(content)
            
            # Filter out false detections
            valid_items = validation_result.get('valid_items', [])
            false_detections = validation_result.get('false_detections', [])
            
            if false_detections:
                print(f"⚠️  False detections caught: {false_detections}")
                print(f"   Reason: {validation_result.get('reason', 'No reason provided')}")
                
                # Remove false detections from analysis result
                analysis_result['items'] = [
                    item for item in analysis_result['items'] 
                    if item['groundingdino_prompt'] in valid_items
                ]
                analysis_result['total_items'] = len(analysis_result['items'])
                
                print(f"✅ Filtered out {len(false_detections)} false detections")
            
            return analysis_result
            
        except Exception as e:
            print(f"⚠️  Detection validation failed: {e}")
            # If validation fails, return original result
            return analysis_result
    
    def generate_detection_prompts(self, analysis_result):
        """Generate Grounding DINO prompt"""
        
        if not analysis_result or 'items' not in analysis_result:
            return ""
        
        # Grounding DINO prompt (dot-separated)
        groundingdino_prompt = " . ".join([item['groundingdino_prompt'] for item in analysis_result['items']])
        
        return groundingdino_prompt
    
    def optimize_bounding_box(self, image_path, groundingdino_prompt, detected_item, bounding_box, confidence):
        """
        Use GPT-4o to analyze if a Grounding DINO bounding box should be expanded, narrowed, or kept as-is
        for optimal item visibility.
        
        Args:
            image_path: Path to the full image
            groundingdino_prompt: The prompt used for Grounding DINO detection
            detected_item: The detected item phrase from Grounding DINO
            bounding_box: [x1, y1, x2, y2] coordinates
            confidence: Detection confidence score
            
        Returns:
            dict: {
                'action': 'expand'|'narrow'|'keep',
                'reason': 'explanation',
                'adjustment_factor': float (e.g., 1.2 for 20% expansion)
            }
        """
        
        # Convert bounding box to percentage coordinates for GPT-4o
        pil_img = Image.open(image_path)
        W, H = pil_img.size
        
        x1, y1, x2, y2 = bounding_box
        box_percent = {
            'x1': x1 / W,
            'y1': y1 / H, 
            'x2': x2 / W,
            'y2': y2 / H,
            'width': (x2 - x1) / W,
            'height': (y2 - y1) / H
        }
        
        system_message = """You are an expert at analyzing bounding boxes for object detection. Your job is to determine if a detected bounding box should be expanded, narrowed, or kept as-is to show the detected item most clearly.

Given:
1. The original detection prompt
2. The detected item
3. The bounding box coordinates (as percentages of image)
4. The detection confidence

Analyze the bounding box quality and decide:
- EXPAND: If the box is too tight and cuts off important parts of the item
- NARROW: If the box includes too much background/other objects
- KEEP: If the box is well-fitted to the item

Consider:
- Is the entire item visible within the box?
- Does the box include unnecessary background?
- For fashion items, is the complete item captured?
- Are important details (like shoe laces, shirt sleeves) included?

SPECIAL RULES FOR SHOES:
- Shoes need MUCH more context than other items
- Include socks, laces, soles, and surrounding area
- Use larger expansion factors (1.5-2.0) for shoes
- Ensure both shoes are visible when possible

Respond with a JSON object:
{
    "action": "expand|narrow|keep",
    "reason": "Brief explanation of your decision",
    "adjustment_factor": 1.0-2.5 (1.0=no change, 1.5=50% expansion, 2.0=100% expansion, 0.8=20% narrowing)
}"""

        user_message = f"""Analyze this bounding box for optimal item visibility:

**Detection Prompt**: {groundingdino_prompt}
**Detected Item**: {detected_item}
**Confidence**: {confidence:.3f}
**Bounding Box**: 
  - Top-left: ({box_percent['x1']:.3f}, {box_percent['y1']:.3f})
  - Bottom-right: ({box_percent['x2']:.3f}, {box_percent['y2']:.3f})
  - Size: {box_percent['width']:.3f} x {box_percent['height']:.3f} (width x height)

**Image**: [Image will be provided]

Should this bounding box be expanded, narrowed, or kept as-is for optimal item visibility?"""

        try:
            # Convert image to base64 for GPT-4o
            import base64
            
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": [
                        {"type": "text", "text": user_message},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]}
                ],
                max_tokens=300,
                temperature=0.1
            )
            
            # Parse JSON response
            response_text = response.choices[0].message.content.strip()
            
            # Extract JSON from response (handle cases where GPT-4o adds extra text)
            import json
            import re
            
            # Find JSON object in response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                result = json.loads(json_str)
                
                # Validate response
                if result.get('action') in ['expand', 'narrow', 'keep'] and 'reason' in result and 'adjustment_factor' in result:
                    return result
                else:
                    print(f"⚠️ Invalid GPT-4o response format: {result}")
                    return {'action': 'keep', 'reason': 'Invalid response', 'adjustment_factor': 1.0}
            else:
                print(f"⚠️ No JSON found in GPT-4o response: {response_text}")
                return {'action': 'keep', 'reason': 'No JSON found', 'adjustment_factor': 1.0}
                
        except Exception as e:
            print(f"❌ Error calling GPT-4o for box optimization: {e}")
            return {'action': 'keep', 'reason': f'Error: {e}', 'adjustment_factor': 1.0}

def test_gpt4o_analyzer():
    """Test the GPT-4o analyzer with a sample image"""
    
    # Check if API key is available
    if not os.getenv('OPENAI_API_KEY'):
        print("⚠️  OPENAI_API_KEY environment variable not set")
        print("To use GPT-4o analysis, set your OpenAI API key:")
        print("export OPENAI_API_KEY='your-api-key-here'")
        return None
    
    analyzer = GPT4OFashionAnalyzer()
    
    # Test with first available image
    test_image_path = "/Users/levit/Desktop/photos"
    image_files = [f for f in os.listdir(test_image_path) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    if not image_files:
        print("No test images found")
        return None
    
    test_image = os.path.join(test_image_path, image_files[0])
    print(f"Testing GPT-4o analysis on: {test_image}")
    
    # Analyze image
    result = analyzer.analyze_fashion_items(test_image)
    
    if result:
        print(f"\n📊 GPT-4o Analysis Results:")
        print(f"Total fashion items detected: {result['total_items']}")
        
        for i, item in enumerate(result['items'], 1):
            print(f"\n{i}. {item['item_type']}")
            print(f"   Description: {item['description']}")
            print(f"   Location: {item['location']}")
            print(f"   Detection prompt: {item['prompt']}")
        
        # Generate prompts
        owlvit_prompts, gd_prompt = analyzer.generate_detection_prompts(result)
        
        print(f"\n🎯 Generated Prompts:")
        print(f"OWL-ViT prompts: {owlvit_prompts}")
        print(f"Grounding DINO prompt: {gd_prompt}")
        
        return result
    else:
        print("❌ Failed to analyze image")
        return None

if __name__ == "__main__":
    test_gpt4o_analyzer()
