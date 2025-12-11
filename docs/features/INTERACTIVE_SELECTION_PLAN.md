# Interactive Item Selection Feature

## Overview
Allow users to choose which detected items to search and draw custom boxes for missed items.

## User Flow

### Step 1: Upload Image
- User uploads image as normal
- Shows loading state

### Step 2: Interactive Selection Screen (NEW!)
```
┌─────────────────────────────────────────────┐
│ 📷 Image Preview with Bounding Boxes        │
│                                             │
│  [Image with colored boxes overlaid]        │
│  Each box shows:                            │
│  - Category label (jacket, bag, etc)        │
│  - Checkbox (selected by default)           │
│  - Confidence score                         │
│                                             │
│  Tools:                                     │
│  ✏️  [Draw Custom Box]                      │
│  🗑️  [Remove Box]                           │
│  ✓  [Select All]                            │
│  ✗  [Deselect All]                          │
│                                             │
│  Selected: 3 of 4 items                     │
│  [🔍 Search Selected Items]                 │
│  [⏭️  Skip (Search All)]                    │
└─────────────────────────────────────────────┘
```

### Step 3: Search & Results
- Only selected items are cropped and searched
- Show results as normal

## Technical Implementation

### 1. New React Component: `InteractiveItemSelector.tsx`

```typescript
interface DetectedBox {
  id: string
  category: string
  bbox: [number, number, number, number]  // [x1, y1, x2, y2]
  confidence: number
  selected: boolean
  isCustom: boolean  // User-drawn box
}

interface Props {
  imageUrl: string
  detectedBoxes: DetectedBox[]
  onSearchSelected: (selectedBoxes: DetectedBox[]) => void
  onSkip: () => void
}
```

**Features:**
- Canvas overlay for drawing boxes
- Click to toggle selection
- Draw mode for custom boxes
- Visual feedback (selected boxes highlighted)

### 2. Update Flow in `ImageUpload.tsx`

**Before:**
```typescript
Upload → Analyze → Search (automatic) → Results
```

**After:**
```typescript
Upload → Analyze → Interactive Selection → Search (selected) → Results
                              ↓
                         Optional step
                     (can skip to search all)
```

### 3. Backend Changes (Minimal!)

**No changes needed!** The crop/search API already supports:
- Selective item processing
- Custom bounding boxes
- Category override

Just pass selected boxes:
```typescript
const selectedItems = boxes.filter(b => b.selected)
await fetch('/api/search', {
  body: JSON.stringify({
    categories: selectedItems.map(b => b.category),
    croppedImages: {}, // Will be generated
    bboxes: selectedItems.map(b => b.bbox),  // Custom boxes
    originalImageUrl: imageUrl
  })
})
```

## UI Components Needed

### 1. BoundingBoxCanvas
- Canvas overlay on image
- Renders boxes with labels
- Handles click detection
- Drawing tool for custom boxes

### 2. BoxControlPanel
- Select/deselect all
- Box list with checkboxes
- Category labels
- Delete custom boxes

### 3. DrawingTools
- Rectangle drawing mode
- Category selector for custom box
- Undo last box
- Clear all custom boxes

## User Benefits

### For Users:
1. **Control**: Choose what to search (not everything)
2. **Speed**: Fewer items = faster results
3. **Accuracy**: Add missed items, remove false detections
4. **Cost**: Less API calls = lower cost for you

### For You:
1. **Better UX**: More engaging, interactive
2. **Fewer Complaints**: Users can fix detection errors
3. **Flexibility**: Works with GPT-4o OR DINO-X detection
4. **Lower Costs**: Search only what users want

## Implementation Phases

### Phase 1: Basic Selection (1-2 hours)
- Show detected boxes on image
- Click to toggle selection
- Search selected items button
- Skip button (search all)

### Phase 2: Custom Boxes (2-3 hours)
- Drawing tool
- Category selector
- Add custom box to detection list
- Delete custom boxes

### Phase 3: Polish (1 hour)
- Better visual design
- Animations
- Mobile optimization
- Touch gestures

## Integration with Current Pipeline

### Works with GPT-4o:
```
GPT-4o → Detected items with boxes → User selection → Crop & Search
```

### Works with DINO-X:
```
DINO-X → Detected items with boxes → User selection → Crop & Search
```

### Works with Fallback:
```
Zero items detected → User draws boxes → Crop & Search
```

**Perfect fit!** 🎯

## Example Code Structure

```
app/
  components/
    InteractiveItemSelector.tsx    # Main component
    BoundingBoxCanvas.tsx           # Canvas overlay
    BoxControlPanel.tsx             # Selection controls
    DrawingTools.tsx                # Custom box drawing
    
  hooks/
    useBoxSelection.ts              # Box state management
    useCanvasDrawing.ts             # Drawing logic
```

## Mobile Considerations

- Touch-friendly hit areas
- Pinch to zoom image
- Pan to see full image
- Responsive box sizing
- Modal on mobile (fullscreen selection)

## Success Metrics

- % of users who use selection feature
- Average items selected vs detected
- Custom boxes drawn per session
- User satisfaction (fewer complaints?)
- Time spent on selection screen

## Next Steps

1. Create InteractiveItemSelector component
2. Integrate into ImageUpload flow
3. Test with real images
4. Iterate based on feedback

---

**This feature makes your app 10x more user-friendly!** 🚀



