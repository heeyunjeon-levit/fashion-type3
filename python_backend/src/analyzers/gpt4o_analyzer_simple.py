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
        
        # Simple, clean prompt - TRUE REVERT to out_improved_prompts_44
        count_prompt = """
        Look at this fashion image and identify all the fashion items visible in the image.

        Focus on items that are clearly visible and worn by the main person in the image.

        For each item you identify, provide:
        1. A simple, descriptive name (e.g., "black jacket", "white shirt", "blue jeans")
        2. A brief description of the item
        3. A clean prompt for object detection (just the item name, no location words)

        IMPORTANT RULES:
        - Only detect items that are clearly visible
        - Use simple, clean item names (2-3 words max)
        - Do NOT include location words like "worn", "on", "in", "with"
        - Do NOT include body parts like "hand", "leg", "torso"
        - Focus on the main fashion items that complete the outfit

        Respond with a JSON object containing:
        {
            "total_items": number,
            "items": [
                {
                    "groundingdino_prompt": "simple item name",
                    "description": "brief description"
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
        """Validate and clean groundingdino_prompt fields"""
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
            
            prompt = item['groundingdino_prompt'].strip().lower()
            
            # Basic cleaning
            prompt = prompt.replace('worn', '').replace('on', '').replace('in', '').replace('with', '')
            prompt = prompt.replace('the', '').replace('a', '').replace('an', '')
            prompt = ' '.join(prompt.split())  # Remove extra spaces
            
            # Limit to 3 words max
            words = prompt.split()
            if len(words) > 3:
                prompt = ' '.join(words[:3])
            
            # Skip if too short or empty
            if len(prompt) < 2:
                continue
            
            item['groundingdino_prompt'] = prompt
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


