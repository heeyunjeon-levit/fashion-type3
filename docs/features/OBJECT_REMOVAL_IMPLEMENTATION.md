# Object Removal Implementation Guide

## Architecture Overview

```
User uploads image with coat + bag
         ↓
1. GroundingDINO detects "coat" → bbox1
2. GroundingDINO detects "bag" → bbox2
         ↓
3. If bag overlaps with coat:
   → Create mask covering bag region
   → Send to Replicate Inpainting API
   → Get cleaned image back
         ↓
4. Crop 7 variations from CLEANED image
         ↓
5. Search with clean crops (no bag contamination!)
```

## Implementation Steps

### 1. Sign up for Replicate

1. Go to https://replicate.com/
2. Sign up / Log in
3. Get API token: https://replicate.com/account/api-tokens
4. Add to `.env.local`:
   ```
   REPLICATE_API_TOKEN=r8_...
   ```

### 2. Install Package

```bash
npm install replicate
```

### 3. Create API Route

**File: `/app/api/remove-object/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
})

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, maskDataUrl } = await request.json()
    
    console.log('🧹 Removing object from image...')
    console.log(`   Image: ${imageUrl.substring(0, 60)}...`)
    
    const startTime = Date.now()
    
    // Use LaMa inpainting model (fast and high quality)
    const output = await replicate.run(
      "fofr/lama-inpainting:2a8eedc18d4e9a1c6c4f69e62c0e2e8b1f0d0e5d",
      {
        input: {
          image: imageUrl,
          mask: maskDataUrl,
        }
      }
    ) as string
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ Object removed in ${elapsed}s`)
    console.log(`   Result: ${output.substring(0, 60)}...`)
    
    return NextResponse.json({ 
      success: true,
      cleanedImageUrl: output,
      elapsed: parseFloat(elapsed)
    })
    
  } catch (error) {
    console.error('❌ Object removal failed:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
```

### 4. Create Mask Generation Utility

**File: `/lib/maskGenerator.ts`**

```typescript
/**
 * Generate a binary mask from bounding boxes
 * White pixels = remove these areas
 * Black pixels = keep these areas
 */
export function generateMaskFromBboxes(
  imageWidth: number,
  imageHeight: number,
  bboxesToRemove: Array<[number, number, number, number]>, // normalized [x1, y1, x2, y2]
  featherRadius: number = 10 // pixels to soften edges
): string {
  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = imageWidth
  canvas.height = imageHeight
  const ctx = canvas.getContext('2d')!
  
  // Fill with black (keep everything)
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, imageWidth, imageHeight)
  
  // Draw white rectangles for regions to remove
  ctx.fillStyle = 'white'
  
  for (const bbox of bboxesToRemove) {
    const [x1, y1, x2, y2] = bbox
    
    // Convert normalized coords to pixels
    const pixelX = Math.floor(x1 * imageWidth)
    const pixelY = Math.floor(y1 * imageHeight)
    const pixelW = Math.floor((x2 - x1) * imageWidth)
    const pixelH = Math.floor((y2 - y1) * imageHeight)
    
    // Draw rectangle (white = remove)
    ctx.fillRect(pixelX, pixelY, pixelW, pixelH)
  }
  
  // Optional: Blur edges for smoother inpainting
  if (featherRadius > 0) {
    ctx.filter = `blur(${featherRadius}px)`
    ctx.drawImage(canvas, 0, 0)
  }
  
  // Return as data URL
  return canvas.toDataURL('image/png')
}

/**
 * Check if two bboxes overlap (indicates object contamination)
 */
export function bboxesOverlap(
  bbox1: [number, number, number, number],
  bbox2: [number, number, number, number],
  threshold: number = 0.1 // 10% overlap triggers removal
): boolean {
  const [x1a, y1a, x2a, y2a] = bbox1
  const [x1b, y1b, x2b, y2b] = bbox2
  
  // Calculate overlap area
  const overlapX = Math.max(0, Math.min(x2a, x2b) - Math.max(x1a, x1b))
  const overlapY = Math.max(0, Math.min(y2a, y2b) - Math.max(y1a, y1b))
  const overlapArea = overlapX * overlapY
  
  // Calculate bbox1 area
  const bbox1Area = (x2a - x1a) * (y2a - y1a)
  
  // Check if overlap is significant relative to target item
  const overlapRatio = overlapArea / bbox1Area
  
  return overlapRatio > threshold
}
```

### 5. Integrate into Detection Flow

**Update: `/app/page.tsx` (in `detectItems` function)**

```typescript
// After detection completes
const detectionData = await response.json()
const detectedBboxes = detectionData.bboxes

// Check for contamination (coat overlapping with bag/accessories)
console.log('🔍 Checking for object contamination...')

const targetCategories = ['coat', 'jacket', 'tops']
const contaminants = ['bag', 'purse', 'handbag', 'backpack']

const needsCleaning: Array<{
  targetBbox: any
  contaminantBboxes: any[]
}> = []

for (const target of detectedBboxes) {
  if (targetCategories.includes(target.category)) {
    const overlappingContaminants = detectedBboxes.filter(
      (other: any) => 
        contaminants.includes(other.category) &&
        bboxesOverlap(target.bbox, other.bbox, 0.1) // 10% overlap
    )
    
    if (overlappingContaminants.length > 0) {
      console.log(`⚠️ ${target.category} contaminated by: ${overlappingContaminants.map(c => c.category).join(', ')}`)
      needsCleaning.push({
        targetBbox: target,
        contaminantBboxes: overlappingContaminants
      })
    }
  }
}

// Clean contaminated items
if (needsCleaning.length > 0) {
  console.log(`🧹 Cleaning ${needsCleaning.length} contaminated item(s)...`)
  
  for (const item of needsCleaning) {
    // Generate mask covering contaminants
    const { generateMaskFromBboxes } = await import('@/lib/maskGenerator')
    const maskDataUrl = generateMaskFromBboxes(
      imageSize[0],
      imageSize[1],
      item.contaminantBboxes.map(c => c.bbox)
    )
    
    // Remove objects
    const cleanResponse = await fetch('/api/remove-object', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: uploadedImageUrl,
        maskDataUrl: maskDataUrl
      })
    })
    
    const cleanData = await cleanResponse.json()
    
    if (cleanData.success) {
      console.log(`✅ Cleaned ${item.targetBbox.category} in ${cleanData.elapsed}s`)
      // Use cleaned image for this item
      item.targetBbox.cleanedImageUrl = cleanData.cleanedImageUrl
    } else {
      console.warn(`⚠️ Cleaning failed, using original image`)
    }
  }
}

// Continue with cropping (use cleanedImageUrl if available)
```

## Cost Analysis

### Per-Image Costs

**With Object Removal:**
```
1. Detection (GroundingDINO): $0 (cached)
2. Object removal (Replicate): $0.01-0.02
3. 7 crop variations: $0 (local)
4. 7 searches (Serper): $0.035 (7 × $0.005)
5. GPT selection: $0.01
───────────────────────────────────────
Total per contaminated item: ~$0.055-0.065
```

**Without Object Removal (current):**
```
1. 7 searches with contamination: $0.035
2. GPT selection (poor results): $0.01
───────────────────────────────────────
Total: ~$0.045 but poor quality
```

**Tradeoff:**
- +$0.015-0.020 per contaminated item
- But dramatically better results (no bag contamination!)
- Only applies to items that overlap with contaminants (~30% of cases?)

### Monthly Estimate

If 30% of items need cleaning:
- 1000 searches/month × 0.3 contaminated × $0.015 = **$4.50/month extra**
- **Worth it** for clean results!

## Alternatives to Consider

### Option A: Replicate (Recommended)
- ✅ Easiest to implement
- ✅ No infrastructure management
- ✅ Pay per use
- Cost: ~$0.01-0.02 per image

### Option B: Modal + Custom Model
- ✅ More control
- ✅ Can optimize
- ❌ More complex
- Cost: ~$0.50/hour GPU (pay for uptime)

### Option C: Don't Remove, Just Filter Better
- Make GPT stricter about rejecting bag results
- Cheaper but less effective
- See `BETTER_GPT_FILTERING.md`

## Testing Strategy

1. **Test with Replicate directly:**
   ```bash
   curl -X POST https://api.replicate.com/v1/predictions \
     -H "Authorization: Token $REPLICATE_API_TOKEN" \
     -d '{"version": "...", "input": {"image": "...", "mask": "..."}}'
   ```

2. **Test mask generation:**
   - Upload coat + bag image
   - Detect both objects
   - Generate mask
   - Verify mask looks correct (white over bag, black elsewhere)

3. **Test full pipeline:**
   - Upload test image
   - Verify detection
   - Verify cleaning
   - Verify improved search results

## Deployment Checklist

- [ ] Add `REPLICATE_API_TOKEN` to Vercel environment variables
- [ ] Test locally first: `npm run dev`
- [ ] Deploy to Vercel: `git push`
- [ ] Test production deployment
- [ ] Monitor costs on Replicate dashboard
- [ ] A/B test: cleaned vs uncleaned results

## Expected Results

**Before (contaminated):**
- 7 variations with bag visible
- Search returns mix of coats + bags
- GPT struggles to filter bags out
- Poor final selection

**After (cleaned):**
- 7 variations, bag removed
- Search returns only coats
- GPT has clean candidates
- Excellent final selection! 🎯

---

## Summary

✅ **Feasible** - Works with Vercel serverless  
✅ **Easy** - Just API calls to Replicate  
✅ **Fast** - 2-5s per image  
✅ **Cheap** - ~$0.01-0.02 per contaminated item  
✅ **Effective** - Completely removes background objects  

**Recommendation:** Start with Replicate, measure impact, optimize if needed.

