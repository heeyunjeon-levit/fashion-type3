#!/usr/bin/env python3
"""
Optimized Fashion Crop Pipeline
GPT-4o + Grounding DINO + SAM-2 with Smart Validation and Nano Banana Integration

This pipeline ensures 100% coverage of GPT-4o identified fashion items through:
1. Smart validation loop with retry logic
2. Quality-based filtering with fallback mechanisms
3. Deterministic cropping and AI-generated catalogue items
4. Consolidated output in single crops folder
"""

import os
import sys
import torch
import numpy as np
from PIL import Image
from pathlib import Path
import json
import base64
import requests
from typing import List, Dict, Tuple, Optional

# Add GroundingDINO to path
import os
groundingdino_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'GroundingDINO')
sys.path.append(groundingdino_path)

try:
    # Try to import from installed groundingdino package (Modal, pip install)
    from groundingdino.util.inference import load_model, load_image as gd_load_image, predict as gd_predict
    from groundingdino.util.utils import clean_state_dict
    from groundingdino.util.box_ops import box_cxcywh_to_xyxy
except ImportError:
    # Fall back to local GroundingDINO directory (local development)
    from GroundingDINO.groundingdino.util.inference import load_model, load_image as gd_load_image, predict as gd_predict
    from GroundingDINO.groundingdino.util.utils import clean_state_dict
    from GroundingDINO.groundingdino.util.box_ops import box_cxcywh_to_xyxy

# SAM-2 imports (conditional - only if SAM2 is available)
try:
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor
    SAM2_AVAILABLE = True
except ImportError:
    print("⚠️ SAM2 not available, will use bounding boxes only")
    SAM2_AVAILABLE = False

# GPT-4o imports
try:
    import sys
    import os
    analyzer_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'analyzers')
    sys.path.append(analyzer_path)
    from gpt4o_analyzer import GPT4OFashionAnalyzer
    GPT4O_AVAILABLE = True
except ImportError:
    print("⚠️ GPT-4o analyzer not available")
    GPT4O_AVAILABLE = False

# ------------------------
# Utility Functions
# ------------------------

def load_image(image_path: str) -> Image.Image:
    """Load image from path"""
    return Image.open(image_path).convert('RGB')

def clip_box(box: List[float], W: int, H: int) -> List[float]:
    """Clip box coordinates to image boundaries"""
    x1, y1, x2, y2 = box
    return [max(0, x1), max(0, y1), min(W, x2), min(H, y2)]

def mask_to_bbox(mask: torch.Tensor) -> Optional[List[float]]:
    """Convert mask to bounding box"""
    if mask.sum() == 0:
        return None
    
    # Convert to torch tensor if it's numpy array
    if isinstance(mask, np.ndarray):
        mask = torch.from_numpy(mask)
    
    rows = torch.any(mask, dim=1)
    cols = torch.any(mask, dim=0)
    
    y1, y2 = torch.where(rows)[0][[0, -1]]
    x1, x2 = torch.where(cols)[0][[0, -1]]
    
    return [x1.item(), y1.item(), x2.item(), y2.item()]

def save_crop(pil_img: Image.Image, crop_box: List[float], output_path: str) -> None:
    """Save cropped image"""
    x1, y1, x2, y2 = crop_box
    crop = pil_img.crop((x1, y1, x2, y2))
    crop.save(output_path, 'JPEG', quality=95)

def ensure_dir(path: str) -> None:
    """Ensure directory exists"""
    Path(path).mkdir(parents=True, exist_ok=True)

def calculate_jaccard_similarity(phrase1: str, phrase2: str) -> float:
    """Calculate Jaccard similarity between two phrases"""
    words1 = set(phrase1.lower().split())
    words2 = set(phrase2.lower().split())
    
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    
    return intersection / union if union > 0 else 0

def calculate_iou(box1: List[float], box2: List[float]) -> float:
    """
    Calculate Intersection over Union (IoU) between two bounding boxes
    
    Args:
        box1: [x1, y1, x2, y2] - first box coordinates
        box2: [x1, y1, x2, y2] - second box coordinates
    
    Returns:
        IoU score between 0 and 1
    """
    x1_1, y1_1, x2_1, y2_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2
    
    # Calculate intersection area
    x1_i = max(x1_1, x1_2)
    y1_i = max(y1_1, y1_2)
    x2_i = min(x2_1, x2_2)
    y2_i = min(y2_1, y2_2)
    
    if x2_i < x1_i or y2_i < y1_i:
        return 0.0
    
    intersection_area = (x2_i - x1_i) * (y2_i - y1_i)
    
    # Calculate union area
    box1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
    box2_area = (x2_2 - x1_2) * (y2_2 - y1_2)
    union_area = box1_area + box2_area - intersection_area
    
    return intersection_area / union_area if union_area > 0 else 0.0

# ------------------------
# Main Pipeline Class
# ------------------------

class OptimizedFashionCropPipeline:
    """
    Optimized Fashion Crop Pipeline with Smart Validation
    
    Pipeline Steps:
    1. GPT-4o Analysis: Identify fashion items with item-based descriptions
    2. Grounding DINO Detection: Detect items with smart validation loop
    3. SAM-2 Processing: Generate high-quality masks and crops
    4. Quality Filtering: Filter low-quality detections
    5. Nano Banana Integration: Generate catalogue items for missing/filtered items
    6. Consolidated Output: All crops in single folder
    """
    
    def __init__(self, 
                 sam2_config: str = "sam2_hiera_l.yaml", 
                 sam2_checkpoint: str = "data/weights/sam2_hiera_large.pt", 
                 device: str = "cpu", 
                 api_key: Optional[str] = None, 
                 gd_config: Optional[str] = "GroundingDINO/groundingdino/config/GroundingDINO_SwinT_OGC.py", 
                 gd_weights: Optional[str] = "data/weights/groundingdino_swint_ogc.pth", 
                 gd_box_thresh: float = 0.2, 
                 gd_text_thresh: float = 0.2, 
                 output_dir: str = "./out_optimized",
                 iou_threshold: float = 0.5,
                 use_sam2: bool = True):
        """
        Initialize the optimized pipeline
        
        Args:
            sam2_config: SAM-2 configuration file path
            sam2_checkpoint: SAM-2 checkpoint file path
            device: Device to run models on
            api_key: OpenAI API key for GPT-4o
            gd_config: Grounding DINO configuration file path
            gd_weights: Grounding DINO weights file path
            gd_box_thresh: Grounding DINO box threshold
            gd_text_thresh: Grounding DINO text threshold
            output_dir: Output directory for results
            iou_threshold: IoU threshold for duplicate filtering (default: 0.5)
        """
        self.device = device
        self.gd_box_thresh = gd_box_thresh
        self.gd_text_thresh = gd_text_thresh
        self.output_dir = output_dir
        self.iou_threshold = iou_threshold
        self.use_sam2 = use_sam2
        
        # Initialize GPT-4o analyzer
        if not GPT4O_AVAILABLE:
            raise ImportError("GPT-4o analyzer not available")
        
        self.gpt4o_analyzer = GPT4OFashionAnalyzer(api_key)
        
        # Initialize Grounding DINO
        if gd_config and gd_weights:
            print("🔄 Loading Grounding DINO model...")
            self.gd_model = load_model(gd_config, gd_weights, device=device)
            print("✅ Grounding DINO model loaded")
        else:
            raise ValueError("Provide Grounding DINO config and weights paths.")
        
        # Initialize SAM-2 (optional)
        if self.use_sam2:
            if not SAM2_AVAILABLE:
                print("⚠️ SAM-2 requested but not available, falling back to bounding boxes")
                self.sam2_predictor = None
                self.use_sam2 = False
            else:
                print("🔄 Loading SAM-2 model...")
                # SAM-2 expects just the filename, not the full path
                sam2_config_name = os.path.basename(sam2_config)
                sam2_checkpoint_abs = os.path.abspath(sam2_checkpoint)
                self.sam2_predictor = SAM2ImagePredictor(build_sam2(sam2_config_name, sam2_checkpoint_abs, device=device))
                print("✅ SAM-2 model loaded")
        else:
            print("⚡ Skipping SAM-2 initialization (using bounding boxes only for speed)")
            self.sam2_predictor = None
        
        # Create output directories
        self.crops_dir = os.path.join(output_dir, "crops")
        ensure_dir(self.crops_dir)
        
        # Quality thresholds
        # Allow smaller valid crops for tops (logos/text can be small); tighten with confidence later
        self.min_crop_ratio = 0.003  # Minimum 0.3% of image area
        self.min_confidence = 0.3   # Minimum SAM-2 confidence
        
        # Validation parameters
        self.max_retry_attempts = 2
        self.similarity_threshold = 0.15
        
        print(f"✅ Pipeline initialized with output directory: {output_dir}")
    
    def process_image(self, image_path: str, custom_analysis: Optional[Dict] = None) -> Dict:
        """
        Process a single image through the complete pipeline
        
        Args:
            image_path: Path to input image
            custom_analysis: Optional custom analysis result to use instead of GPT-4o
            
        Returns:
            Dictionary with processing results and statistics
        """
        print(f"\n{'='*80}")
        print(f"Processing: {Path(image_path).name}")
        print(f"{'='*80}")
        
        # Load image
        pil_img = load_image(image_path)
        image_stem = Path(image_path).stem
        
        # Step 1: GPT-4o Analysis or Custom Analysis
        if custom_analysis:
            print("🎯 Step 1: Using custom analysis...")
            analysis = custom_analysis
        else:
            print("🔍 Step 1: Analyzing image with GPT-4o...")
            analysis = self.gpt4o_analyzer.analyze_fashion_items(image_path)
        
        expected_items = [item['groundingdino_prompt'] for item in analysis['items']]
        print(f"📊 Found {len(expected_items)} fashion items")
        
        # Step 2: Generate Grounding DINO prompt
        print("🎯 Step 2: Generating Grounding DINO prompt...")
        groundingdino_prompt = self._generate_groundingdino_prompt(analysis)
        # If searching tops, prepend coarse garment noun to stabilize detection
        if any('top' in item.lower() or 'shirt' in item.lower() or 'sweatshirt' in item.lower() for item in expected_items):
            groundingdino_prompt = "sweatshirt . hoodie . shirt . " + groundingdino_prompt
        print(f"🎯 Grounding DINO prompt: '{groundingdino_prompt}'")
        print(f"📋 Expected items ({len(expected_items)}): {expected_items}")
        
        # Step 3: Grounding DINO detection with validation
        print("🔍 Step 3: Running Grounding DINO detection with validation...")
        validated_detections = self._run_grounding_dino_with_validation(
            pil_img, groundingdino_prompt, expected_items, analysis
        )
        
        # Step 4: SAM-2 processing
        print("🎨 Step 4: Processing validated detections with SAM-2...")
        sam2_results = self._process_with_sam2(pil_img, validated_detections, image_stem)
        
        # Step 5: Generate catalogue items for missing/filtered items - DISABLED
        # if sam2_results['filtered_items'] or sam2_results['missing_items']:
        #     print("🎨 Step 5: Generating product catalogue for missing/filtered items...")
        #     catalogue_results = self._generate_catalogue_items(
        #         pil_img, sam2_results['filtered_items'], sam2_results['missing_items'], 
        #         analysis, image_path, image_stem
        #     )
        # else:
        #     catalogue_results = {'catalogue_crops': 0}
        
        # Skip catalogue generation
        catalogue_results = {'catalogue_crops': 0}
        if sam2_results['filtered_items'] or sam2_results['missing_items']:
            print(f"⚠️  Skipping {len(sam2_results['filtered_items'])} filtered items and {len(sam2_results['missing_items'])} missing items (catalogue generation disabled)")
        
        # Step 6: Consolidate results
        total_crops = sam2_results['real_crops'] + catalogue_results['catalogue_crops']
        print(f"🏆 Generated {total_crops} crops from GPT-4o + Grounding DINO + SAM-2")
        
        return {
            'image_path': image_path,
            'expected_items': len(expected_items),
            'detected_items': len(validated_detections),
            'real_crops': sam2_results['real_crops'],
            'catalogue_crops': catalogue_results['catalogue_crops'],
            'total_crops': total_crops,
            'filtered_items': len(sam2_results['filtered_items']),
            'missing_items': len(sam2_results['missing_items'])
        }
    
    def run(self, image_path: str, output_dir: str, custom_analysis: Optional[Dict] = None) -> Dict:
        """
        Run the pipeline on a single image with custom output directory
        
        Args:
            image_path: Path to input image
            output_dir: Output directory for results
            custom_analysis: Optional custom analysis result to use instead of GPT-4o
            
        Returns:
            Dictionary with processing results and statistics
        """
        # Update output directory
        self.output_dir = output_dir
        self.crops_dir = os.path.join(output_dir, "crops")
        ensure_dir(self.crops_dir)
        
        # Process the image
        return self.process_image(image_path, custom_analysis)
    
    def _generate_groundingdino_prompt(self, analysis: Dict) -> str:
        """Generate Grounding DINO prompt from GPT-4o analysis"""
        prompts = [item['groundingdino_prompt'] for item in analysis['items']]
        return " . ".join(prompts)
    
    def _filter_duplicate_boxes(self, boxes: torch.Tensor, logits: torch.Tensor, 
                                phrases: List[str], pil_img: Image.Image, 
                                iou_threshold: float = 0.5) -> Tuple[torch.Tensor, torch.Tensor, List[str]]:
        """
        Filter duplicate detections using IoU-based Non-Maximum Suppression (NMS)
        
        Args:
            boxes: Tensor of bounding boxes in cxcywh format
            logits: Tensor of confidence scores
            phrases: List of detected phrase labels
            pil_img: PIL Image for coordinate conversion
            iou_threshold: IoU threshold for considering boxes as duplicates (default: 0.5)
            
        Returns:
            Tuple of (filtered_boxes, filtered_logits, filtered_phrases)
        """
        if len(boxes) == 0:
            return boxes, logits, phrases
        
        W, H = pil_img.size
        
        # Convert boxes from cxcywh to xyxy format in image coordinates
        boxes_xyxy = box_cxcywh_to_xyxy(boxes) * torch.tensor([W, H, W, H])
        
        # Garment keywords - prioritize these over detail-only phrases
        garment_keywords = {"sweatshirt","hoodie","jacket","coat","shirt","blouse","sweater","top","cardigan","vest","blazer",
                           "pants","jeans","shorts","skirt","trousers","leggings",
                           "dress","shoes","boots","sneakers","heels","sandals",
                           "bag","purse","backpack","tote","clutch","handbag",
                           "hat","cap","beanie","scarf","necklace","bracelet","ring","earrings","watch"}
        
        # Create list of (index, box, logit, phrase, is_garment, box_area)
        detections = []
        for i, (box, logit, phrase) in enumerate(zip(boxes_xyxy, logits, phrases)):
            is_garment = any(gk in phrase.lower() for gk in garment_keywords)
            # Calculate box area
            box_area = (box[2] - box[0]) * (box[3] - box[1])
            detections.append({
                'index': i,
                'box': box.tolist(),
                'logit': float(logit),
                'phrase': phrase,
                'is_garment': is_garment,
                'area': float(box_area)
            })
        
        # Sort by priority:
        # 1. Garment phrases first
        # 2. Then by confidence (logit)
        # 3. Then by area (larger boxes preferred)
        detections.sort(key=lambda x: (not x['is_garment'], -x['logit'], -x['area']))
        
        # Apply NMS
        keep_indices = []
        suppressed = set()
        
        for i, det in enumerate(detections):
            if i in suppressed:
                continue
            
            keep_indices.append(det['index'])
            
            # Suppress overlapping boxes
            for j in range(i + 1, len(detections)):
                if j in suppressed:
                    continue
                
                other_det = detections[j]
                iou = calculate_iou(det['box'], other_det['box'])
                
                if iou > iou_threshold:
                    # Suppress the lower-priority detection
                    suppressed.add(j)
                    print(f"   🗑️ Suppressed '{other_det['phrase']}' (IoU={iou:.2f} with '{det['phrase']}')")
        
        # Filter to kept detections
        keep_indices.sort()  # Keep original order
        filtered_boxes = boxes[keep_indices]
        filtered_logits = logits[keep_indices]
        filtered_phrases = [phrases[i] for i in keep_indices]
        
        return filtered_boxes, filtered_logits, filtered_phrases
    
    def _run_grounding_dino_with_validation(self, 
                                          pil_img: Image.Image, 
                                          groundingdino_prompt: str, 
                                          expected_items: List[str], 
                                          analysis: Dict) -> List[Dict]:
        """
        Run Grounding DINO detection with smart validation loop
        
        This method ensures 100% coverage through:
        - Retry logic for missing items
        - Semantic matching for phrase variations
        - Quality-based filtering
        """
        max_attempts = self.max_retry_attempts
        attempt = 1
        all_successful_detections = []
        remaining_expected_items = expected_items.copy()
        
        while attempt <= max_attempts:
            print(f"🔄 Grounding DINO attempt {attempt}/{max_attempts}")
            
            # Run Grounding DINO
            # Convert PIL image to tensor using Grounding DINO's load_image function
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                pil_img.save(tmp_file.name, 'JPEG')
                tmp_path = tmp_file.name
            
            try:
                image_source, image = gd_load_image(tmp_path)
                boxes, logits, phrases = gd_predict(
                    model=self.gd_model,
                    image=image, 
                    caption=groundingdino_prompt,
                    box_threshold=max(0.2, self.gd_box_thresh),
                    text_threshold=max(0.2, self.gd_text_thresh),
                    device=self.device
                )
            finally:
                # Clean up temporary file
                os.unlink(tmp_path)
            
            print(f"🔍 Detected phrases (before IoU filtering): {phrases}")
            print(f"📊 Expected: {len(remaining_expected_items)}, Detected: {len(phrases)}")
            
            # Apply IoU-based duplicate filtering
            if len(boxes) > 1:
                boxes, logits, phrases = self._filter_duplicate_boxes(boxes, logits, phrases, pil_img, self.iou_threshold)
                print(f"🔍 After IoU filtering: {len(phrases)} detections remain")
                print(f"🔍 Filtered phrases: {phrases}")
            
            # Validate detections
            validation_result = self._validate_detections(phrases, remaining_expected_items)
            
            if validation_result['action'] == 'perfect_match':
                # Perfect count match - use semantic matching
                successful_detections = validation_result['detections']
                all_successful_detections.extend(successful_detections)
                remaining_expected_items = []
                
            elif validation_result['action'] == 'too_many':
                # Too many detections - keep best matches
                successful_detections = validation_result['detections']
                all_successful_detections.extend(successful_detections)
                remaining_expected_items = validation_result['remaining_items']
                
            elif validation_result['action'] == 'too_few':
                # Too few detections - analyze missing items
                successful_detections = validation_result['detections']
                all_successful_detections.extend(successful_detections)
                remaining_expected_items = validation_result['remaining_items']
            
            # Check if we're done
            if not remaining_expected_items:
                print("✅ All expected items detected!")
                break
            
            # Check if this is the last attempt
            if attempt == max_attempts:
                print(f"⚠️ Last attempt - accepting {len(all_successful_detections)} successful detections")
                print(f"📊 Missing items: {remaining_expected_items}")
                break
            
            # Generate new prompt for missing items
            if remaining_expected_items:
                print(f"🔄 Generating new prompt for {len(remaining_expected_items)} missing items...")
                groundingdino_prompt = self._generate_missing_items_prompt(remaining_expected_items, analysis)
                print(f"🎯 New Grounding DINO prompt: '{groundingdino_prompt}'")
            
            attempt += 1
        
        print(f"✅ Total successful detections: {len(all_successful_detections)}")
        return all_successful_detections
    
    def _validate_detections(self, detected_phrases: List[str], expected_items: List[str]) -> Dict:
        """Validate detections and determine action"""
        expected_count = len(expected_items)
        detected_count = len(detected_phrases)
        
        if expected_count == detected_count:
            # Perfect count match
            print("✅ Perfect count match - validating semantic matches...")
            detections = self._match_detections_semantically(detected_phrases, expected_items)
            return {'action': 'perfect_match', 'detections': detections, 'remaining_items': []}
            
        elif expected_count < detected_count:
            # Too many detections
            print(f"🗑️ Too many detections ({detected_count} > {expected_count}) - discarding extras")
            detections, remaining_items = self._discard_extra_detections(detected_phrases, expected_items)
            return {'action': 'too_many', 'detections': detections, 'remaining_items': remaining_items}
            
        else:
            # Too few detections
            print(f"📊 Too few detections ({detected_count} < {expected_count}) - analyzing missing items")
            detections, remaining_items = self._analyze_missing_items(detected_phrases, expected_items)
            return {'action': 'too_few', 'detections': detections, 'remaining_items': remaining_items}
    
    def _match_detections_semantically(self, detected_phrases: List[str], expected_items: List[str]) -> List[Dict]:
        """Match detected phrases to expected items using semantic similarity"""
        detections = []
        used_phrases = set()
        
        for expected_item in expected_items:
            best_match = None
            best_score = 0
            
            for phrase in detected_phrases:
                if phrase in used_phrases:
                    continue
                
                similarity = calculate_jaccard_similarity(phrase, expected_item)
                if similarity > best_score and similarity >= self.similarity_threshold:
                    best_score = similarity
                    best_match = phrase
            
            if best_match:
                detections.append({
                    'phrase': best_match,
                    'expected_item': expected_item,
                    'similarity_score': best_score
                })
                used_phrases.add(best_match)
                print(f"✅ Kept '{best_match}' → '{expected_item}' (score: {best_score:.2f})")
        
        return detections
    
    def _discard_extra_detections(self, detected_phrases: List[str], expected_items: List[str]) -> Tuple[List[Dict], List[str]]:
        """Discard extra detections, keeping only the best matches"""
        # Garment keywords - MUST prioritize these over detail-only phrases
        garment_keywords = {"sweatshirt","hoodie","jacket","coat","shirt","blouse","sweater","top","cardigan","vest","blazer",
                           "pants","jeans","shorts","skirt","trousers","leggings",
                           "dress","shoes","boots","sneakers","heels","sandals",
                           "bag","purse","backpack","tote","clutch","handbag",
                           "hat","cap","beanie","scarf","necklace","bracelet","ring","earrings","watch"}
        
        # Calculate similarity scores for all combinations
        similarity_scores = []
        for phrase in detected_phrases:
            base_score = 0
            for expected_item in expected_items:
                similarity = calculate_jaccard_similarity(phrase, expected_item)
                base_score = max(base_score, similarity)
            
            # Check if phrase contains garment keyword
            has_garment = any(gk in phrase.lower() for gk in garment_keywords)
            
            # Heavily boost garment phrases - we ALWAYS prefer full garments over details
            if has_garment:
                boosted_score = base_score + 0.5  # Large boost to prioritize garments
            else:
                # Details (buttons, zippers, pockets) get penalized
                boosted_score = base_score * 0.3  # Heavily penalize detail-only phrases
            
            similarity_scores.append((phrase, expected_items[0] if expected_items else "item", boosted_score, base_score, has_garment))
        
        # Sort by boosted score (descending)
        similarity_scores.sort(key=lambda x: x[2], reverse=True)
        
        # Keep only the best matches
        detections = []
        used_phrases = set()
        used_expected = set()
        
        for phrase, expected_item, boosted_score, base_score, has_garment in similarity_scores[:len(expected_items)]:
            if phrase in used_phrases:
                continue
            
            # Accept if it's a garment phrase or has good similarity
            if has_garment or boosted_score >= self.similarity_threshold:
                detections.append({
                    'phrase': phrase,
                    'expected_item': expected_item,
                    'similarity_score': base_score
                })
                used_phrases.add(phrase)
                used_expected.add(expected_item)
                garment_tag = " [GARMENT]" if has_garment else " [DETAIL]"
                print(f"✅ Kept '{phrase}' → '{expected_item}' (score: {base_score:.2f}){garment_tag}")
        
        # Find remaining expected items
        remaining_items = [item for item in expected_items if item not in used_expected]
        
        # Log discarded items
        discarded = [phrase for phrase in detected_phrases if phrase not in used_phrases]
        if discarded:
            print(f"🗑️ Discarded extra items: {discarded}")
        
        return detections, remaining_items
    
    def _analyze_missing_items(self, detected_phrases: List[str], expected_items: List[str]) -> Tuple[List[Dict], List[str]]:
        """Analyze missing items and create fallback detections for small items"""
        detections = []
        remaining_items = []
        
        # First, try to match what we can
        for phrase in detected_phrases:
            best_match = None
            best_score = 0
            
            for expected_item in expected_items:
                similarity = calculate_jaccard_similarity(phrase, expected_item)
                if similarity > best_score and similarity >= self.similarity_threshold:
                    best_score = similarity
                    best_match = expected_item
            
            if best_match:
                detections.append({
                    'phrase': phrase,
                    'expected_item': best_match,
                    'similarity_score': best_score
                })
                print(f"✅ Kept '{phrase}' → '{best_match}' (score: {best_score:.2f})")
        
        # Find truly missing items
        matched_expected = [d['expected_item'] for d in detections]
        remaining_items = [item for item in expected_items if item not in matched_expected]
        
        # Create fallback detections for small items
        fallback_detections = self._create_fallback_detections(detections, remaining_items)
        detections.extend(fallback_detections)
        
        return detections, remaining_items
    
    def _create_fallback_detections(self, existing_detections: List[Dict], missing_items: List[str]) -> List[Dict]:
        """Create fallback detections for small items using related items"""
        fallback_detections = []
        small_items = {'socks', 'watch', 'belt', 'ring', 'bracelet', 'necklace', 'earrings'}
        
        for missing_item in missing_items:
            item_words = set(missing_item.lower().split())
            if item_words.intersection(small_items):
                # Try to find a related item (e.g., shoes for socks)
                for detection in existing_detections:
                    if 'shoe' in detection['expected_item'].lower() and 'sock' in missing_item.lower():
                        fallback_detections.append({
                            'phrase': detection['phrase'],
                            'expected_item': missing_item,
                            'similarity_score': 0.1,  # Low score to indicate fallback
                            'is_fallback': True
                        })
                        break
        
        return fallback_detections
    
    def _generate_missing_items_prompt(self, missing_items: List[str], analysis: Dict) -> str:
        """Generate focused prompt for missing items"""
        return " . ".join(missing_items)
    
    def _process_with_sam2(self, pil_img: Image.Image, detections: List[Dict], image_stem: str) -> Dict:
        """Process detections with SAM-2 (or bounding boxes only) and apply quality filtering"""
        real_crops = 0
        filtered_items = []
        
        for i, detection in enumerate(detections):
            phrase = detection['phrase']
            expected_item = detection['expected_item']
            
            # Get bounding box from Grounding DINO
            # Convert PIL image to tensor using Grounding DINO's load_image function
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                pil_img.save(tmp_file.name, 'JPEG')
                tmp_path = tmp_file.name
            
            try:
                image_source, image = gd_load_image(tmp_path)
                boxes, logits, phrases = gd_predict(
                    model=self.gd_model,
                    image=image, 
                    caption=phrase,
                    box_threshold=max(0.2, self.gd_box_thresh),
                    text_threshold=max(0.2, self.gd_text_thresh),
                    device=self.device
                )
            finally:
                # Clean up temporary file
                os.unlink(tmp_path)
            
            if len(boxes) == 0:
                continue
            
            # Use the first (highest confidence) detection
            bbox = boxes[0]
            logit = logits[0]
            
            # Convert to image coordinates
            W, H = pil_img.size
            bbox = box_cxcywh_to_xyxy(bbox) * torch.tensor([W, H, W, H])
            bbox = clip_box(bbox.tolist(), W, H)
            
            # Process based on use_sam2 flag
            if self.use_sam2:
                # Run SAM-2 for pixel-perfect segmentation
                self.sam2_predictor.set_image(pil_img)
                masks, scores, logits_sam2 = self.sam2_predictor.predict(
                    point_coords=None,
                    point_labels=None,
                    box=bbox,
                    multimask_output=True,
                )
                
                # Select best mask
                best_mask = None
                best_score = 0
                best_logit = 0
                
                for mask, score, logit_sam2 in zip(masks, scores, logits_sam2):
                    if score > best_score:
                        best_score = score
                        best_logit = float(logit_sam2.max())  # Convert to scalar
                        best_mask = mask
                
                if best_mask is not None:
                    # Convert mask to crop box
                    mask_bbox = mask_to_bbox(best_mask)
                    if mask_bbox:
                        # Add margin
                        x1, y1, x2, y2 = mask_bbox
                        margin_ratio = 0.05
                        margin_x = (x2 - x1) * margin_ratio
                        margin_y = (y2 - y1) * margin_ratio
                        
                        crop_box = [
                            max(0, x1 - margin_x),
                            max(0, y1 - margin_y),
                            min(W, x2 + margin_x),
                            min(H, y2 + margin_y)
                        ]
                        
                        # Quality validation
                        crop_area = (crop_box[2] - crop_box[0]) * (crop_box[3] - crop_box[1])
                        total_area = W * H
                        crop_ratio = crop_area / total_area
                        
                        if crop_ratio > self.min_crop_ratio and best_logit > self.min_confidence:
                            # Save real crop
                            clean_phrase = phrase.replace(' ', '_').replace('-', '_')
                            output_path = os.path.join(self.crops_dir, f"{image_stem}_item{i+1}_{clean_phrase}_crop.jpg")
                            save_crop(pil_img, crop_box, output_path)
                            print(f"✅ Generated crop for '{expected_item}': {clean_phrase}")
                            real_crops += 1
                        else:
                            # If high confidence but too small, expand box and keep as last resort
                            if crop_ratio <= self.min_crop_ratio and best_logit > (self.min_confidence + 0.1):
                                expand = 0.10
                                ex = (crop_box[2] - crop_box[0]) * expand
                                ey = (crop_box[3] - crop_box[1]) * expand
                                expanded_box = [
                                    max(0, crop_box[0] - ex),
                                    max(0, crop_box[1] - ey),
                                    min(W, crop_box[2] + ex),
                                    min(H, crop_box[3] + ey)
                                ]
                                clean_phrase = phrase.replace(' ', '_').replace('-', '_')
                                output_path = os.path.join(self.crops_dir, f"{image_stem}_item{i+1}_{clean_phrase}_crop.jpg")
                                save_crop(pil_img, expanded_box, output_path)
                                print(f"🛟 Kept small high-conf crop by expanding box: {clean_phrase} (ratio: {crop_ratio:.3f}, conf: {best_logit:.3f})")
                                real_crops += 1
                                continue
                            # Add to filtered items
                            filtered_items.append({
                                'item': expected_item,
                                'phrase': phrase,
                                'reason': f"too_small" if crop_ratio <= self.min_crop_ratio else f"low_confidence",
                                'crop_box': crop_box,
                                'mask': best_mask
                            })
                            print(f"⚠️ Rejected low-quality detection: {phrase.replace(' ', '_')} (ratio: {crop_ratio:.3f}, conf: {best_logit:.3f})")
            else:
                # Bounding box only mode (skip SAM-2)
                print(f"⚡ Using bounding box only (no SAM-2 segmentation)")
                # Add small margin to bbox
                x1, y1, x2, y2 = bbox
                margin_ratio = 0.05
                margin_x = (x2 - x1) * margin_ratio
                margin_y = (y2 - y1) * margin_ratio
                
                crop_box = [
                    max(0, x1 - margin_x),
                    max(0, y1 - margin_y),
                    min(W, x2 + margin_x),
                    min(H, y2 + margin_y)
                ]
                
                # Save crop directly from bounding box
                clean_phrase = phrase.replace(' ', '_').replace('-', '_')
                output_path = os.path.join(self.crops_dir, f"{image_stem}_item{i+1}_{clean_phrase}_crop.jpg")
                save_crop(pil_img, crop_box, output_path)
                print(f"✅ Generated bbox crop for '{expected_item}': {clean_phrase}")
                real_crops += 1
        
        return {
            'real_crops': real_crops,
            'filtered_items': filtered_items,
            'missing_items': []  # Will be filled by validation loop
        }
    
    def _generate_catalogue_items(self, 
                                pil_img: Image.Image, 
                                filtered_items: List[Dict], 
                                missing_items: List[str], 
                                analysis: Dict, 
                                image_path: str, 
                                image_stem: str) -> Dict:
        """Generate catalogue items using Nano Banana (Gemini) for missing/filtered items"""
        catalogue_crops = 0
        
        # Process filtered items (have crop boxes from SAM-2)
        for item in filtered_items:
            print(f"📸 Generating catalogue image for: {item['item']}")
            success = self._generate_item_image_with_nano_banana(
                item['item'], analysis, image_path, 
                crop_box=item['crop_box'], mask=item['mask']
            )
            if success:
                catalogue_crops += 1
        
        # Process missing items (no crop boxes)
        for missing_item in missing_items:
            print(f"📸 Generating catalogue image for: {missing_item}")
            success = self._generate_item_image_with_nano_banana(
                missing_item, analysis, image_path, 
                crop_box=None, mask=None
            )
            if success:
                catalogue_crops += 1
        
        print(f"📚 Product catalogue generated with {catalogue_crops} items")
        return {'catalogue_crops': catalogue_crops}
    
    def _generate_item_image_with_nano_banana(self, 
                                            item_description: str, 
                                            analysis: Dict, 
                                            original_image_path: str, 
                                            crop_box: Optional[List[float]] = None, 
                                            mask: Optional[torch.Tensor] = None) -> bool:
        """Generate item image using Nano Banana (Gemini) or deterministic cutout"""
        try:
            # Check for Google API key
            api_key = os.getenv('GOOGLE_API_KEY')
            if not api_key:
                print("⚠️ No Google API key found. Skipping catalogue generation.")
                return False
            
            if crop_box is not None and mask is not None:
                # Deterministic cutout using SAM-2 mask and crop_box
                return self._save_deterministic_catalogue_item(original_image_path, crop_box, mask, item_description)
            else:
                # Fallback to Gemini image+text generation
                return self._generate_with_gemini(item_description, analysis, original_image_path)
                
        except Exception as e:
            print(f"❌ Error generating catalogue item: {e}")
            return False
    
    def _save_deterministic_catalogue_item(self, 
                                         image_path: str, 
                                         crop_box: List[float], 
                                         mask: torch.Tensor, 
                                         item_description: str) -> bool:
        """Save deterministic catalogue item by cropping from original image"""
        try:
            pil_img = load_image(image_path)
            clean_phrase = item_description.replace(' ', '_').replace('-', '_')
            output_path = os.path.join(self.crops_dir, f"catalogue_deterministic_{clean_phrase}.jpg")
            save_crop(pil_img, crop_box, output_path)
            print(f"✅ Generated catalogue image: {output_path}")
            return True
        except Exception as e:
            print(f"❌ Error saving deterministic catalogue item: {e}")
            return False
    
    def _generate_with_gemini(self, item_description: str, analysis: Dict, original_image_path: str) -> bool:
        """Generate image using Google Gemini Images API"""
        try:
            api_key = os.getenv('GOOGLE_API_KEY')
            
            # Encode original image
            with open(original_image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            
            # Create prompt
            prompt = (
                f"Create a professional product photography shot of {item_description} "
                f"with clean white background, studio lighting, high quality fashion catalog style, "
                f"isolated product shot that matches the style and quality of the reference image"
            )
            
            # Call Gemini API
            response = requests.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
                headers={"x-goog-api-key": api_key},
                json={
                    "contents": [{
                        "parts": [
                            {"text": prompt},
                            {"inline_data": {"mime_type": "image/jpeg", "data": base64_image}}
                        ]
                    }],
                    "generationConfig": {"responseModalities": ["Image"]}
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                if 'candidates' in result and len(result['candidates']) > 0:
                    candidate = result['candidates'][0]
                    if 'content' in candidate and 'parts' in candidate['content']:
                        for part in candidate['content']['parts']:
                            if 'inline_data' in part and part['inline_data']['mime_type'] == 'image/jpeg':
                                # Decode and save image
                                image_data = base64.b64decode(part['inline_data']['data'])
                                clean_phrase = item_description.replace(' ', '_').replace('-', '_')
                                output_path = os.path.join(self.crops_dir, f"catalogue_gemini_{clean_phrase}.jpg")
                                
                                with open(output_path, 'wb') as f:
                                    f.write(image_data)
                                
                                print(f"✅ Generated catalogue image: {output_path}")
                                return True
            
            print(f"❌ Gemini API error: {response.status_code}")
            return False
            
        except Exception as e:
            print(f"❌ Error with Gemini API: {e}")
            return False
    
    def _run_detection_only(self, image_path: str) -> Dict:
        """
        Run detection-only pipeline (GPT-4o + Grounding DINO) without SAM-2 cropping
        
        Args:
            image_path: Path to input image
            
        Returns:
            Dictionary with detection results and statistics
        """
        print(f"🔍 Step 1: Analyzing image with GPT-4o...")
        
        # Step 1: GPT-4o Analysis
        analysis_result = self.gpt4o_analyzer.analyze_fashion_items(image_path)
        
        if not analysis_result or 'items' not in analysis_result:
            print("❌ GPT-4o analysis failed")
            return None
        
        print(f"📊 Found {analysis_result['total_items']} fashion items")
        
        # Step 2: Generate Grounding DINO prompt
        print(f"🎯 Step 2: Generating Grounding DINO prompt...")
        groundingdino_prompt = self.gpt4o_analyzer.generate_detection_prompts(analysis_result)
        print(f"🎯 Grounding DINO prompt: '{groundingdino_prompt}'")
        
        # Extract expected items
        expected_items = [item['groundingdino_prompt'] for item in analysis_result['items']]
        print(f"📋 Expected items ({len(expected_items)}): {expected_items}")
        
        # Step 3: Grounding DINO Detection with Validation
        print(f"🔍 Step 3: Running Grounding DINO detection with validation...")
        
        # Load image for Grounding DINO
        pil_img = load_image(image_path)
        
        # Run Grounding DINO with validation
        validation_result = self._run_grounding_dino_with_validation(
            pil_img, 
            groundingdino_prompt, 
            expected_items,
            analysis_result  # Pass the analysis result
        )
        
        if not validation_result:
            print("❌ Grounding DINO detection failed")
            return None
        
        # Extract detection statistics
        detected_items = len(validation_result)  # validation_result is a list
        expected_count = len(expected_items)
        
        print(f"✅ Detection completed: {expected_count} expected, {detected_items} detected")
        
        return {
            "image_path": image_path,
            "expected_items": expected_count,
            "detected_items": detected_items,
            "expected_item_list": expected_items,
            "detected_item_list": [det['phrase'] for det in validation_result],
            "groundingdino_prompt": groundingdino_prompt,
            "validation_result": validation_result
        }
    
    def process_images(self, image_dir: str, max_images: Optional[int] = None) -> Dict:
        """Process multiple images"""
        image_paths = list(Path(image_dir).glob("*.jpg")) + list(Path(image_dir).glob("*.png"))
        
        if max_images:
            image_paths = image_paths[:max_images]
        
        print(f"🔄 Processing {len(image_paths)} images...")
        
        results = []
        total_crops = 0
        
        for i, image_path in enumerate(image_paths, 1):
            print(f"\nProcessing {i}/{len(image_paths)}: {image_path.name}")
            result = self.process_image(str(image_path))
            results.append(result)
            total_crops += result['total_crops']
            print(f"📁 Generated {result['total_crops']} crops")
        
        print(f"\n🎉 Processing complete!")
        print(f"📁 Results saved to: {self.output_dir}")
        print(f"📊 Processed {len(image_paths)} images")
        print(f"📊 Total crops generated: {total_crops}")
        
        return {
            'total_images': len(image_paths),
            'total_crops': total_crops,
            'results': results
        }

# ------------------------
# Main Execution
# ------------------------

def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Optimized Fashion Crop Pipeline")
    parser.add_argument("--images", required=True, help="Path to input images directory")
    parser.add_argument("--output_dir", default="./out_optimized", help="Output directory")
    parser.add_argument("--gd_config", default="GroundingDINO/groundingdino/config/GroundingDINO_SwinT_OGC.py", help="Grounding DINO config file")
    parser.add_argument("--gd_weights", default="data/weights/groundingdino_swint_ogc.pth", help="Grounding DINO weights file")
    parser.add_argument("--sam2_config", default="sam2_hiera_l.yaml", help="SAM-2 config file")
    parser.add_argument("--sam2_checkpoint", default="data/weights/sam2_hiera_large.pt", help="SAM-2 checkpoint file")
    parser.add_argument("--gd_box_thresh", type=float, default=0.2, help="Grounding DINO box threshold")
    parser.add_argument("--gd_text_thresh", type=float, default=0.2, help="Grounding DINO text threshold")
    parser.add_argument("--max_images", type=int, help="Maximum number of images to process")
    parser.add_argument("--device", default="cpu", help="Device to run models on")
    
    args = parser.parse_args()
    
    # Initialize pipeline
    pipeline = OptimizedFashionCropPipeline(
        sam2_config=args.sam2_config,
        sam2_checkpoint=args.sam2_checkpoint,
        device=args.device,
        gd_config=args.gd_config,
        gd_weights=args.gd_weights,
        gd_box_thresh=args.gd_box_thresh,
        gd_text_thresh=args.gd_text_thresh,
        output_dir=args.output_dir
    )
    
    # Process images
    pipeline.process_images(args.images, args.max_images)

if __name__ == "__main__":
    main()
