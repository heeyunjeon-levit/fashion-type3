#!/usr/bin/env python3
"""
Custom Item Cropper - Allows specifying different items to crop for each screenshot
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Optional
import argparse

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from core.main_pipeline import OptimizedFashionCropPipeline
from analyzers.gpt4o_analyzer import GPT4OFashionAnalyzer

class CustomItemCropper:
    def __init__(self, 
                 gd_config: str = "configs/GroundingDINO_SwinT_OGC.py",
                 gd_weights: str = "data/weights/groundingdino_swint_ogc.pth",
                 device: str = "cpu"):
        
        self.pipeline = OptimizedFashionCropPipeline(
            gd_config=gd_config,
            gd_weights=gd_weights,
            device=device
        )
        
        self.gpt4o_analyzer = GPT4OFashionAnalyzer()
    
    def create_custom_analysis(self, image_path: str, custom_items: List[str]) -> dict:
        """Create a custom analysis result with specified items
        
        Args:
            image_path: Path to the image
            custom_items: List of item categories (e.g., ["상의", "하의"]) or specific descriptions
            
        Returns:
            Dictionary with items analyzed by GPT-4o for image-specific prompts
        """
        # Check if custom_items are simple generic categories
        # Only use GPT-4o for very generic terms like "top" or "bottom"
        generic_simple = {"top", "bottom", "shoes", "bag", "accessory", "dress", "상의", "하의", "신발", "가방", "악세사리", "드레스"}
        
        # Check base term (strip any _1, _2 suffixes for multi-instance detection)
        needs_gpt4o = any(item.strip().lower().split('_')[0] in generic_simple for item in custom_items)
        
        if needs_gpt4o:
            # Use GPT-4o to generate image-specific prompts
            return self._create_gpt4o_specific_analysis(image_path, custom_items)
        else:
            # Use items directly as prompts (skip GPT-4o for speed)
            print("⚡ Using direct prompts (skipping GPT-4o for speed)")
            return {
                "total_items": len(custom_items),
                "items": [
                    {
                        "groundingdino_prompt": item.strip(),
                        "description": f"Custom specified item: {item.strip()}"
                    }
                    for item in custom_items
                ]
            }
    
    def _create_gpt4o_specific_analysis(self, image_path: str, custom_items: List[str]) -> dict:
        """Use GPT-4o to generate image-specific prompts for generic categories"""
        # Encode image
        import base64
        with open(image_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Map categories to English
        korean_to_english = {
            "상의": "top", "하의": "pants/bottoms", "신발": "shoes", "가방": "bag",
            "clothing shirt blouse": "top", "clothing pants jeans": "pants/bottoms"
        }
        
        # Create focused prompt
        items_str = ", ".join([korean_to_english.get(item, item) for item in custom_items])
        
        prompt = f"""Look at this fashion image and identify these specific items: {items_str}

🎯 FOCUS RULE: Analyze ONLY the MAIN PERSON or MAIN ITEM in the image (the largest, clearest subject in the foreground).
   - FOCUS ON: The primary person/item in the image
   - IGNORE: Background people, mannequins, displays, posters, or items not the main subject
   - If the main subject doesn't have {items_str}, return an empty list for those items

⚠️ CRITICAL FOR ACCESSORIES (rings, necklaces, earrings, bracelets, watches, bags, etc.):
   - NEVER use generic terms like "accessory", "jewelry", "bag"
   - ALWAYS identify the SPECIFIC TYPE: "gold ring", "silver necklace", "leather backpack", etc.
   - Include material, color, and distinguishing features
   - Examples: "gold ring with diamonds", "silver chain necklace", "black leather backpack"

CRITICAL: Look at the ACTUAL ITEMS visible in the image. DO NOT imagine or infer items that aren't clearly visible.

IMPORTANT: Your description will be used to crop the item for detailed visual matching. The crop needs to capture ALL identifying details:
- Specific patterns, textures, and unique features
- All design elements (buttons, zippers, pockets, seams, stitching)
- Complete visible details that make this item searchable and matchable
Focus on details that will help reverse image search find exact or very similar items.

For "top":
STEP 1: Examine the UPPER BODY carefully and identify EVERY visible detail on the garment:
   - Fabric texture/pattern: ribbed, knit, plain, striped, checked, printed
   - Design elements: collar type, sleeve style, neckline, hem style
   - Functional details: buttons (number and style), zippers, pockets, seams
   - Color details: exact shade, color combinations, fading/washing effects
   - Fit/style: relaxed, fitted, oversized, cropped
STEP 2: Build a DETAILED description (4-8 words) that captures ALL visible identifying features:
   - "light gray ribbed long sleeve henley shirt with buttons and collar"
   - "blue striped button-down shirt with chest pocket and rolled sleeves"
   - "black denim jacket with metal buttons and patch pockets"
STEP 3: Include as many identifying details as possible to make the crop highly searchable

For "bottom":
STEP 1: Examine the LOWER BODY and identify EVERY visible detail:
   - Fabric: denim, cotton, polyester, leather
   - Pattern: plain, striped, embroidered, distressed
   - Fit: skinny, straight, wide-leg, baggy, tapered
   - Features: belt loops, pockets (back/front), zippers, buttons, cuffs, hem
   - Color: exact shade and any fading/washing patterns
STEP 2: Build a DETAILED description (4-8 words) with ALL identifying details:
   - "blue denim high waist straight leg jeans with pockets and belt loops"
   - "black midi pleated skirt with elastic waist and button detail"
STEP 3: Include ALL visible details to make it highly searchable.

For "shoes": Examine ALL visible details - material, color, style, laces, heel type, toe shape, brand markings, texture. Be very specific.

VERY IMPORTANT:
- DO NOT IMAGINE garment types that aren't in the image
- If you see a SHIRT → say "striped long sleeve shirt", NOT just "shirt" or "overalls"
- If you see a JACKET → say "blue denim jacket with buttons", NOT just "jacket" or "overalls"  
- If you see SEPARATE shirt + pants → they are SEPARATE garments, NOT overalls
- ONLY use "overalls" if you can clearly see a one-piece bib-style garment with straps/bib
- Be EXTREMELY SPECIFIC about details - include EVERY visible feature (buttons, pockets, seams, texture, pattern, color shades, fit)
- Maximum details = better reverse image search matching

CORRECT EXAMPLES (HIGHLY DETAILED FOR SEARCH):
✅ "light gray ribbed long sleeve henley shirt with buttons" → very detailed
✅ "blue striped button-down shirt with chest pocket and sleeves" → detailed
✅ "black denim jacket with metal buttons and patch pockets" → detailed  
✅ "dark blue high waist straight leg jeans with pockets" → detailed

INCORRECT (DO NOT USE):
❌ "denim overalls top" → when it's actually a shirt or jacket
❌ "overalls" → when wearing separate shirt and pants
❌ "shirt" or "jacket" → too generic, add details
❌ Imagining garment types based on context

🚨 CRITICAL REQUIREMENT: You MUST provide descriptions for ALL {len(custom_items)} requested items.
   - You were asked for: {items_str}
   - You MUST return EXACTLY {len(custom_items)} items in your response
   - Even if an item is small, subtle, or partially visible, you MUST include it
   - Look carefully at the ENTIRE image - check all areas, not just the most obvious item
   - Each description should be highly detailed (5-9 words) capturing EVERY visible identifying feature

SEARCH STRATEGY FOR EACH ITEM:
1. For "top/상의": Look at upper body - shirts, blouses, jackets, sweaters, dresses (upper part)
2. For "bottom/하의": Look at lower body - pants, skirts, shorts
3. For "shoes/신발": Look at feet - any visible footwear
4. For "bag/가방": Look everywhere - handbags, backpacks, purses (held, worn, or nearby)
5. For "accessories/악세사리": Look at neck, ears, wrists, head - jewelry, watches, sunglasses, hats
6. For "dress/드레스": Look at full body - one-piece garments

⚠️ DO NOT skip items just because they're less prominent than others!
⚠️ EVERY requested item must be included in your response!

Your description(s) should be SO DETAILED that it helps reverse image search find the best matches.

Examples of very detailed descriptions:
- "light gray ribbed long sleeve henley shirt with buttons and collar"
- "blue striped button-down shirt with chest pocket and rolled sleeves"  
- "gray knit pullover sweater with collar and ribbed cuffs"
- "black denim jacket with metal buttons and patch pockets"
- "dark blue high waist straight leg jeans with belt loops and pockets"
- "white pearl layered necklace with multiple strands"
- "brown leather shoulder bag with gold chain strap"

Respond with JSON containing EXACTLY {len(custom_items)} items:
{{
    "total_items": {len(custom_items)},
    "items": [
{f','.join([f'        {{"groundingdino_prompt": "detailed description of {korean_to_english.get(custom_items[i], custom_items[i])}", "description": "brief description of the {korean_to_english.get(custom_items[i], custom_items[i])}"}}' for i in range(len(custom_items))])}
    ]
}}
"""
        
        try:
            response = self.gpt4o_analyzer.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500,
                temperature=0.1
            )
            
            import json
            content = response.choices[0].message.content
            print(f"🤖 GPT-4o raw response: {content}")
            
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
            print(f"🔍 GPT-4o parsed result: {result}")
            return result
            
        except Exception as e:
            print(f"⚠️  GPT-4o analysis failed: {e}")
            # Fallback to generic prompts
            return {
                "total_items": len(custom_items),
                "items": [
                    {
                        "groundingdino_prompt": item.strip(),
                        "description": f"Custom specified item: {item.strip()}"
                    }
                    for item in custom_items
                ]
            }
    
    def crop_custom_items(self, image_path: str, custom_items: List[str], output_dir: str) -> dict:
        """Crop specific items from an image"""
        print(f"\n🎯 Processing: {Path(image_path).name}")
        print(f"📋 Custom items to crop: {custom_items}")
        
        # Create custom analysis
        analysis = self.create_custom_analysis(image_path, custom_items)
        
        # Run the pipeline with custom analysis
        result = self.pipeline.run(image_path, output_dir, custom_analysis=analysis)
        
        return result
    
    def process_batch_with_custom_items(self, 
                                      image_dir: str, 
                                      custom_items_map: Dict[str, List[str]], 
                                      output_dir: str) -> dict:
        """Process multiple images with custom items specified for each"""
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        crops_dir = os.path.join(output_dir, "crops")
        os.makedirs(crops_dir, exist_ok=True)
        
        results = {
            "total_images": 0,
            "successful_images": 0,
            "failed_images": 0,
            "total_crops": 0,
            "results": []
        }
        
        # Get all image files
        image_extensions = ['.jpg', '.jpeg', '.png']
        image_files = []
        
        for ext in image_extensions:
            image_files.extend(Path(image_dir).glob(f"*{ext}"))
            image_files.extend(Path(image_dir).glob(f"*{ext.upper()}"))
        
        results["total_images"] = len(image_files)
        
        for i, image_path in enumerate(image_files, 1):
            image_name = image_path.name
            
            # Check if custom items are specified for this image
            if image_name in custom_items_map:
                custom_items = custom_items_map[image_name]
                print(f"\n{'='*80}")
                print(f"Processing {i}/{len(image_files)}: {image_name}")
                print(f"{'='*80}")
                
                try:
                    result = self.crop_custom_items(str(image_path), custom_items, output_dir)
                    
                    if result and result.get('total_crops', 0) > 0:
                        results["successful_images"] += 1
                        results["total_crops"] += result.get('total_crops', 0)
                        print(f"✅ Successfully processed {image_name}")
                        print(f"📁 Generated {result.get('total_crops', 0)} crops")
                    else:
                        results["failed_images"] += 1
                        print(f"❌ Failed to process {image_name}")
                        if result:
                            print(f"   Reason: No crops generated (expected: {len(custom_items)}, got: {result.get('total_crops', 0)})")
                    
                    results["results"].append({
                        "image": image_name,
                        "custom_items": custom_items,
                        "success": result.get('total_crops', 0) > 0 if result else False,
                        "crops": result.get('total_crops', 0) if result else 0,
                        "error": result.get('error') if result else "No result returned"
                    })
                    
                except Exception as e:
                    results["failed_images"] += 1
                    print(f"❌ Error processing {image_name}: {e}")
                    results["results"].append({
                        "image": image_name,
                        "custom_items": custom_items,
                        "success": False,
                        "crops": 0,
                        "error": str(e)
                    })
            else:
                print(f"⚠️  No custom items specified for {image_name} - skipping")
                results["results"].append({
                    "image": image_name,
                    "custom_items": [],
                    "success": False,
                    "crops": 0,
                    "error": "No custom items specified"
                })
        
        # Save results
        results_file = os.path.join(output_dir, "custom_crop_results.json")
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n🎉 Custom cropping complete!")
        print(f"📊 Results saved to: {results_file}")
        print(f"📈 Summary: {results['successful_images']}/{results['total_images']} images processed successfully")
        print(f"📁 Total crops generated: {results['total_crops']}")
        
        return results

def create_example_custom_items_map():
    """Create an example custom items mapping"""
    return {
        # Example: specify different items for different images
        "example1.jpg": ["red dress", "black heels", "gold necklace"],
        "example2.jpg": ["blue jeans", "white shirt", "brown bag"],
        "example3.jpg": ["black jacket", "striped shirt", "white sneakers"],
        # Add more mappings as needed
    }

def main():
    parser = argparse.ArgumentParser(description="Custom Item Cropper - Specify items to crop for each image")
    parser.add_argument("--images", required=True, help="Path to directory containing images")
    parser.add_argument("--output", required=True, help="Output directory for results")
    parser.add_argument("--custom-items", help="JSON file with custom items mapping (optional)")
    parser.add_argument("--gd-config", default="configs/GroundingDINO_SwinT_OGC.py")
    parser.add_argument("--gd-weights", default="data/weights/groundingdino_swint_ogc.pth")
    parser.add_argument("--sam2-config", default="sam2_hiera_l.yaml")
    parser.add_argument("--sam2-checkpoint", default="data/weights/sam2_hiera_large.pt")
    
    args = parser.parse_args()
    
    # Load custom items mapping
    if args.custom_items and os.path.exists(args.custom_items):
        with open(args.custom_items, 'r') as f:
            custom_items_map = json.load(f)
    else:
        print("⚠️  No custom items file provided. Creating example mapping...")
        custom_items_map = create_example_custom_items_map()
        
        # Save example mapping
        example_file = os.path.join(args.output, "example_custom_items.json")
        os.makedirs(args.output, exist_ok=True)
        with open(example_file, 'w') as f:
            json.dump(custom_items_map, f, indent=2)
        print(f"📝 Example custom items mapping saved to: {example_file}")
        print("📝 Edit this file to specify custom items for each image, then run again with --custom-items")
        return
    
    # Initialize cropper
    cropper = CustomItemCropper(
        gd_config=args.gd_config,
        gd_weights=args.gd_weights,
        sam2_config=args.sam2_config,
        sam2_checkpoint=args.sam2_checkpoint
    )
    
    # Process images
    results = cropper.process_batch_with_custom_items(
        args.images, 
        custom_items_map, 
        args.output
    )

if __name__ == "__main__":
    main()
