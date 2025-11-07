#!/usr/bin/env python3
"""
GPT-4o Fashion Analyzer - TRUE REVERT to out_improved_prompts_44 state
Simple, clean prompt that produced the preferred results
"""

import os
import json
import base64
from openai import OpenAI
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
        
        # Focused prompt - prioritize most noticeable fashion items
        count_prompt = """
        Look at this fashion image and identify the most noticeable fashion items worn by the main person.

        PRIORITIZE THESE MAIN ITEMS:
        1. CLOTHING: shirts, tops, dresses, pants, skirts, jackets, sweaters
        2. FOOTWEAR: shoes, boots, sandals (only if clearly visible)
        3. BAGS: handbags, backpacks, purses (only if prominent/eye-catching)
        4. OBVIOUS ACCESSORIES: large sunglasses, statement jewelry, watches (only if very noticeable)

        CONSERVATIVE APPROACH:
        - Focus on items that immediately catch your eye
        - Skip small, subtle accessories (rings, earrings, bracelets unless very bold)
        - Skip items that require careful examination to notice
        - Only detect accessories that are clearly visible and make a visual impact
        - Prioritize the main outfit pieces over small details

        For each item you identify, provide:
        1. A "groundingdino_prompt" - ULTRA-SIMPLE detection keyword (2-3 words max, just color + item type)
        2. A "description" - Detailed description with style, fit, material, etc.

        CRITICAL: groundingdino_prompt vs description
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        groundingdino_prompt: "gray shirt"        ← SIMPLE! Just color + type
        description: "light gray long sleeve henley shirt with buttons and loose fit"  ← DETAILED!

        groundingdino_prompt: "black skirt"       ← SIMPLE! Just color + type  
        description: "black high waist midi skirt with pleats"  ← DETAILED!

        groundingdino_prompt: "white shoes"       ← SIMPLE! Just color + type
        description: "white mesh slip-on shoes with red striped socks"  ← DETAILED!

        RULES FOR groundingdino_prompt (MUST FOLLOW):
        - MAXIMUM 2-3 words: [color] + [basic item type]
        - NO style details (no "loose", "fitted", "pleated", "buttons")
        - NO materials (no "mesh", "cotton", "leather")
        - NO fit/length (no "midi", "high-waist", "long sleeve")
        - Just: "gray shirt", "black pants", "white shoes", "blue jacket"

        IMPORTANT:
        - Only detect items that are clearly visible and noticeable
        - Do NOT include location words like "worn", "on", "in", "with"
        - Do NOT include body parts like "hand", "leg", "torso"
        - Be conservative - better to miss small items than detect questionable ones

        Respond with a JSON object:
        {
            "total_items": number,
            "items": [
                {
                    "groundingdino_prompt": "color item",  // 2-3 words only!
                    "description": "detailed style description"
                }
            ]
        }
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
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                    "detail": "low"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000,
                temperature=0.1
            )
            
            # Parse response
            content = response.choices[0].message.content
            
            # Handle markdown code blocks
            if "```json" in content:
                start_idx = content.find("```json") + 7
                end_idx = content.find("```", start_idx)
                json_str = content[start_idx:end_idx]
            elif "```" in content:
                start_idx = content.find("```") + 3
                end_idx = content.find("```", start_idx)
                json_str = content[start_idx:end_idx]
            else:
                json_str = content
            
            result = json.loads(json_str)
            
            # Validate and clean groundingdino_prompt fields
            result = self._validate_and_clean_prompts(result)
            
            # Additional validation: Check for false detections using image analysis
            result = self._validate_detections_with_image(image_path, result)
            
            return result
            
        except Exception as e:
            print(f"Error analyzing image with GPT-4o: {e}")
            print(f"Raw response content: {repr(response.choices[0].message.content) if 'response' in locals() else 'No response'}")
            return None
    
    def _validate_and_clean_prompts(self, result):
        """Validate and clean groundingdino_prompt fields - FORCE simplification"""
        if not result or 'items' not in result:
            return result
        
        # Cap maximum items to prevent over-detection
        max_items = 12
        if len(result['items']) > max_items:
            result['items'] = result['items'][:max_items]
            result['total_items'] = len(result['items'])
        
        # Clean each groundingdino_prompt
        cleaned_items = []
        
        for item in result['items']:
            if 'groundingdino_prompt' not in item:
                continue
            
            # FORCE SIMPLIFY: Extract only first 2-3 words (color + item type)
            # GPT-4o often ignores instructions, so we enforce it here
            original = item['groundingdino_prompt']
            
            # Hard stop words - ALWAYS break when we hit these
            hard_stop_words = ['with', 'and', 'featuring', 'in', 'on']
            
            # Detail descriptor words - stop if we already have 2+ words
            detail_words = [
                'style', 'design', 'fit',
                'loose', 'tight', 'fitted', 'oversized', 'slim',
                'button', 'buttons', 'buttoned', 'zipper', 'zip',
                'cuffs', 'hem', 'pocket', 'pockets',
                'strap', 'straps', 'laces', 'toe', 'heel'
            ]
            
            # Split into words and keep only first 2-3 words before any detail words
            words = original.lower().split()
            simple_words = []
            
            # Strategy: Keep [color] [material] [item_type] (max 3 words)
            # Stop at "with", "and", or detail descriptors
            for i, word in enumerate(words[:6]):  # Check max first 6 words
                # Hard stop words (always break immediately)
                if word in hard_stop_words:
                    print(f"   🛑 Hard stop at '{word}'")
                    break
                # Detail descriptors (break only if we already have 2+ words)
                if word in detail_words and len(simple_words) >= 2:
                    print(f"   🛑 Detail stop at '{word}' (have {len(simple_words)} words)")
                    break
                simple_words.append(word)
                if len(simple_words) >= 3:  # Max 3 words
                    break
            
            # Fallback: if we got nothing or just 1 word, take first 2 words
            if len(simple_words) < 2 and len(words) >= 2:
                simple_words = words[:2]
            elif len(simple_words) == 0:
                simple_words = [words[0]] if words else [original]
            
            simplified = ' '.join(simple_words)
            
            # If we simplified it, update and log
            if simplified.lower() != original.lower():
                print(f"🔧 Simplified prompt: '{original}' → '{simplified}'")
            else:
                print(f"✓ Prompt already simple: '{original}'")
            
            # Final cleanup: remove extra spaces and normalize case
            simplified = simplified.strip().lower()
            simplified = ' '.join(simplified.split())  # Remove extra spaces
            
            # Skip if too short or empty
            if len(simplified) < 2:
                print(f"⚠️ Skipping item with too-short prompt: '{simplified}'")
                continue
            
            # Save the final simplified prompt
            item['groundingdino_prompt'] = simplified
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
            
            content = response.choices[0].message.content
            
            # Handle markdown code blocks
            if "```json" in content:
                start_idx = content.find("```json") + 7
                end_idx = content.find("```", start_idx)
                json_str = content[start_idx:end_idx]
            elif "```" in content:
                start_idx = content.find("```") + 3
                end_idx = content.find("```", start_idx)
                json_str = content[start_idx:end_idx]
            else:
                json_str = content
            
            validation_result = json.loads(json_str)
            
            # Filter out false detections
            valid_items = validation_result.get('valid_items', [])
            false_detections = validation_result.get('false_detections', [])
            
            if false_detections:
                print(f"⚠️  False detections caught: {false_detections}")
                print(f"   Reason: {validation_result.get('reason', 'No reason provided')}")
                
                # Remove false detections
                filtered_items = []
                for item in analysis_result['items']:
                    if item['groundingdino_prompt'] not in false_detections:
                        filtered_items.append(item)
                
                analysis_result['items'] = filtered_items
                analysis_result['total_items'] = len(filtered_items)
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
