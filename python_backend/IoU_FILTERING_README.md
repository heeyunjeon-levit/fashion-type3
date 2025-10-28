# IoU-Based Duplicate Filtering

## Overview
Implemented Intersection over Union (IoU) based Non-Maximum Suppression (NMS) to prevent detecting the same item multiple times during object detection.

## Problem
Previously, the cropper would sometimes detect the same garment multiple times, leading to duplicate crops. For example:
- Requesting 4 tops but getting 7 crops (some being duplicates or details like collars/sleeves)
- Detecting both "red sweatshirt" and "logo print" as separate items when they're parts of the same garment

## Solution
Added IoU-based filtering in the GroundingDINO detection pipeline:

### 1. IoU Calculation (`calculate_iou`)
```python
def calculate_iou(box1: List[float], box2: List[float]) -> float:
    """
    Calculate Intersection over Union (IoU) between two bounding boxes
    Returns: IoU score between 0 and 1
    """
```
- Calculates the overlap between two bounding boxes
- Returns 0.0 for no overlap, 1.0 for complete overlap

### 2. Duplicate Filtering (`_filter_duplicate_boxes`)
```python
def _filter_duplicate_boxes(self, boxes, logits, phrases, pil_img, iou_threshold=0.5)
```

**Priority-based NMS:**
1. **Garment phrases prioritized** over detail-only phrases (buttons, zippers, etc.)
2. **Higher confidence** (logit) preferred
3. **Larger boxes** preferred (full garments vs small details)

**Process:**
1. Convert boxes to xyxy format in image coordinates
2. Classify each detection as "garment" or "detail"
3. Sort by priority (garment > confidence > area)
4. Apply NMS:
   - Keep highest priority detection
   - Suppress all overlapping boxes (IoU > threshold)
   - Continue with next highest priority non-suppressed detection

### 3. Configuration
New parameter in `OptimizedFashionCropPipeline.__init__`:
```python
iou_threshold: float = 0.5  # IoU threshold for duplicate filtering
```

**Tuning guidelines:**
- `0.3-0.4`: More aggressive filtering (removes more overlaps)
- `0.5`: Default (good balance)
- `0.6-0.7`: Less aggressive (allows more overlap)

## Integration Points

### main_pipeline.py
1. Added `calculate_iou()` utility function
2. Added `_filter_duplicate_boxes()` method
3. Applied filtering in `_run_grounding_dino_with_validation()` after GroundingDINO detection

### crop_api.py
Updated count limiting logic to acknowledge IoU filtering:
```python
# IoU filtering should have handled duplicates, but limiting to {count} as requested
```

## Benefits
1. **Eliminates duplicates**: No more detecting the same garment multiple times
2. **Prioritizes full garments**: Prefers complete items over small details
3. **Confidence-based**: Keeps highest quality detections
4. **Configurable**: Tunable threshold for different use cases
5. **Efficient**: O(n²) complexity, runs in milliseconds

## Testing
To test with different IoU thresholds:

```python
pipeline = OptimizedFashionCropPipeline(
    # ... other params ...
    iou_threshold=0.4  # More aggressive filtering
)
```

## Expected Behavior
- **Before**: Requesting 4 tops → Getting 7 crops (including duplicates/details)
- **After**: Requesting 4 tops → Getting 4 unique, high-quality crops

## Debug Output
The filtering produces debug logs:
```
🔍 Detected phrases (before IoU filtering): ['red sweatshirt', 'logo print', 'red sweatshirt', ...]
🔍 After IoU filtering: 4 detections remain
   🗑️ Suppressed 'logo print' (IoU=0.68 with 'red sweatshirt')
```

## Edge Cases Handled
1. **No overlaps**: If IoU < threshold, both boxes kept
2. **Multiple overlaps**: Highest priority box kept, all overlapping boxes suppressed
3. **Single detection**: No filtering applied
4. **Garment vs detail**: Garment always preferred over overlapping detail

