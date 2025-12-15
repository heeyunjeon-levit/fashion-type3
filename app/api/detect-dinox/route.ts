import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const DINOX_API_BASE = 'https://api.deepdataspace.com'
const DINOX_API_TOKEN = process.env.DINOX_API_TOKEN || 'bdf2ed490ebe69a28be81ea9d9b0b0e3'

interface DetectionObject {
  category: string
  bbox: number[]
  score: number
}

interface DINOXDetectionResult {
  objects: DetectionObject[]
  image?: {
    width: number
    height: number
  }
}

// Fashion categories for detection (ordered by priority for better detection)
const FASHION_CATEGORIES = [
  "fur coat", "leather jacket", "coat", "jacket",
  "robe","dress", "blouse", "button up shirt", "sweater", "cardigan", "hoodie", "vest", "shirt",
  "jeans", "pants", "trousers", "shorts", "skirt",
  "heels","sneakers", "shoes", "boots", "sandals",
  "clutch", "handbag", "bag", 
  "sunglasses", "hat", "cap", "scarf", "belt", "watch",
  "necklace", "bracelet", "earrings", "ring", "jewelry"
]

const FASHION_PROMPT = FASHION_CATEGORIES.join(". ")

// Convert image URL to base64 (with size optimization for faster processing)
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    console.log('   Converting image to base64...')
    const response = await fetch(imageUrl)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const originalSize = arrayBuffer.byteLength
    
    // For very large images, we could resize here, but for now just convert
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = response.headers.get('content-type') || 'image/jpeg'
    
    console.log(`   ✅ Converted ${(originalSize / 1024).toFixed(1)} KB to base64 (${base64.length} chars)`)
    
    return `data:${mimeType};base64,${base64}`
  } catch (error: any) {
    console.error('   ❌ Image conversion failed:', error.message)
    throw new Error(`Image conversion failed: ${error.message}`)
  }
}

// Create DINO-X detection task
async function createDetectionTask(base64Image: string) {
  const payload = {
    model: "DINO-X-1.0",
    image: base64Image,
    prompt: { type: "text", text: FASHION_PROMPT },
    targets: ["bbox"],
    bbox_threshold: 0.25,  // Match Modal backend (0.45 was too high!)
    iou_threshold: 0.8
  }

  const response = await fetch(`${DINOX_API_BASE}/v2/task/dinox/detection`, {
    method: 'POST',
    headers: {
      'Token': DINOX_API_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`DINO-X API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data?.task_uuid
}

// Query task result
async function queryTaskResult(taskUuid: string, maxWait: number = 120): Promise<DINOXDetectionResult | null> {
  const startTime = Date.now()
  let attempts = 0

  while (Date.now() - startTime < maxWait * 1000) {
    attempts++
    
    try {
      const response = await fetch(`${DINOX_API_BASE}/v2/task_status/${taskUuid}`, {
        headers: { 'Token': DINOX_API_TOKEN },
        signal: AbortSignal.timeout(10000) // 10s timeout per request
      })

      if (!response.ok) {
        console.log(`   ⚠️  Query attempt ${attempts} failed: ${response.status}, retrying...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }

      const data = await response.json()
      const status = data.data?.status

      console.log(`   📊 Attempt ${attempts}: status = ${status}`)

      // Check for terminal states (according to official DINO-X API docs)
      if (status === 'success') {
        console.log('   ✅ Task completed successfully!')
        console.log('   📊 DINO-X result keys:', Object.keys(data.data?.result || {}))
        console.log('   📊 Image metadata:', JSON.stringify(data.data?.result?.image || 'NONE'))
        // Return full data including image dimensions for bbox normalization
        return {
          ...data.data?.result,
          image: data.data?.result?.image // Include image metadata (width, height)
        }
      } else if (status === 'failed') {
        console.error('   ❌ Task failed:', data)
        throw new Error('DINO-X task failed')
      } else if (status === 'waiting' || status === 'running') {
        // Task still processing, continue polling
        console.log(`   ⏳ Task ${status}, waiting...`)
      } else {
        console.warn(`   ⚠️  Unknown status: ${status}`)
      }

      // Wait 2 seconds between polls
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error: any) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        console.log(`   ⏱️  Query timeout, retrying...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      throw error
    }
  }

  console.error(`   ❌ Timeout after ${attempts} attempts over ${maxWait}s`)
  return null
}

// Category mapping
const CATEGORY_MAP: Record<string, string> = {
  'fur coat': 'tops',
  'fur jacket': 'tops',
  'leather jacket': 'tops',
  'coat': 'tops',
  'jacket': 'tops',
  'shirt': 'tops',
  'blouse': 'tops',
  'button up shirt': 'tops',
  'button_up_shirt': 'tops',
  'vest': 'tops',
  'sweater': 'tops',
  'cardigan': 'tops',
  'hoodie': 'tops',
  'pants': 'bottoms',
  'jeans': 'bottoms',
  'shorts': 'bottoms',
  'skirt': 'bottoms',
  'dress': 'dress',
  'robe': 'dress',  // Robe is a dress-like garment
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

function mapCategory(rawCategory: string): string {
  const normalized = rawCategory.toLowerCase().trim()
  return CATEGORY_MAP[normalized] || 'accessories'
}

// Calculate IoU (Intersection over Union) between two bounding boxes
function calculateIoU(bbox1: number[], bbox2: number[]): number {
  if (bbox1.length !== 4 || bbox2.length !== 4) return 0
  
  const [x1_1, y1_1, x2_1, y2_1] = bbox1
  const [x1_2, y1_2, x2_2, y2_2] = bbox2
  
  // Calculate intersection
  const x1_i = Math.max(x1_1, x1_2)
  const y1_i = Math.max(y1_1, y1_2)
  const x2_i = Math.min(x2_1, x2_2)
  const y2_i = Math.min(y2_1, y2_2)
  
  if (x2_i < x1_i || y2_i < y1_i) {
    return 0  // No intersection
  }
  
  const intersectionArea = (x2_i - x1_i) * (y2_i - y1_i)
  
  // Calculate union
  const area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
  const area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
  const unionArea = area1 + area2 - intersectionArea
  
  return intersectionArea / unionArea
}

// Check if bbox2 is engulfed (completely contained) by bbox1
// Returns true if bbox2 is inside bbox1 with some tolerance
function isEngulfed(bbox1: number[], bbox2: number[]): boolean {
  if (bbox1.length !== 4 || bbox2.length !== 4) return false
  
  const [x1_1, y1_1, x2_1, y2_1] = bbox1
  const [x1_2, y1_2, x2_2, y2_2] = bbox2
  
  // Calculate areas
  const area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
  const area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
  
  // If bbox2 is larger, it can't be engulfed by bbox1
  if (area2 > area1) return false
  
  // Check if bbox2 is completely inside bbox1 (with small tolerance for detection errors)
  const tolerance = 0.02  // 2% tolerance
  const engulfed = (
    x1_2 >= (x1_1 - tolerance) &&
    y1_2 >= (y1_1 - tolerance) &&
    x2_2 <= (x2_1 + tolerance) &&
    y2_2 <= (y2_1 + tolerance)
  )
  
  return engulfed
}

// Non-Maximum Suppression: Remove overlapping duplicate detections
// Keep only the best detection for each overlapping region
function applyNMS(objects: DetectionObject[], iouThreshold: number = 0.5): DetectionObject[] {
  if (objects.length === 0) return []
  
  // Sort by confidence score (highest first)
  const sorted = [...objects].sort((a, b) => b.score - a.score)
  const keep: DetectionObject[] = []
  const suppressed = new Set<number>()
  
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue
    
    const current = sorted[i]
    keep.push(current)
    
    // Suppress overlapping boxes with lower confidence
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue
      
      // Check for engulfment (one box completely inside another)
      const currentEngulfsSorted = isEngulfed(current.bbox, sorted[j].bbox)
      const sortedEngulfsCurrent = isEngulfed(sorted[j].bbox, current.bbox)
      
      if (currentEngulfsSorted) {
        // Current (higher confidence) box contains sorted[j] - suppress the smaller one
        suppressed.add(j)
        console.log(`      🔴 ENGULFMENT: "${current.category}" (${current.score.toFixed(3)}) contains "${sorted[j].category}" (${sorted[j].score.toFixed(3)}) - SUPPRESSED smaller box`)
        continue
      }
      
      if (sortedEngulfsCurrent) {
        // sorted[j] (lower confidence) contains current - this shouldn't happen since we sort by confidence
        // But if it does, keep the higher confidence one (current)
        suppressed.add(j)
        console.log(`      🔴 ENGULFMENT: "${sorted[j].category}" contains "${current.category}" but has lower confidence - SUPPRESSED`)
        continue
      }
      
      // Standard IoU check for overlapping boxes
      const iou = calculateIoU(current.bbox, sorted[j].bbox)
      
      // Log IoU for debugging
      console.log(`      🔍 IoU between "${current.category}" and "${sorted[j].category}": ${iou.toFixed(3)} (threshold: ${iouThreshold})`)
      
      if (iou > iouThreshold) {
        suppressed.add(j)
        console.log(`      ✅ OVERLAP: SUPPRESSED "${sorted[j].category}" (${sorted[j].score.toFixed(3)}) - overlaps with "${current.category}" (${current.score.toFixed(3)})`)
      }
    }
  }
  
  return keep
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }

    console.log('🔍 DINO-X Detection (Direct API Call)')
    console.log('   Image URL:', imageUrl.substring(0, 80))
    console.log('   DINO-X Token:', DINOX_API_TOKEN ? '✅ Set' : '❌ Missing')

    // Convert image to base64
    const base64Image = await imageUrlToBase64(imageUrl)
    console.log('   Base64 length:', base64Image.length)

    // Create detection task
    const taskUuid = await createDetectionTask(base64Image)
    if (!taskUuid) {
      throw new Error('Failed to create detection task')
    }

    console.log('   Task UUID:', taskUuid)

    // Poll for results
    const result = await queryTaskResult(taskUuid)
    if (!result) {
      throw new Error('Detection timeout')
    }

    const objects = result.objects || []
    console.log(`📦 DINO-X returned ${objects.length} raw objects`)
    console.log('   Raw result structure:', JSON.stringify(result, null, 2).substring(0, 500))
    
    // Get image dimensions for bbox normalization
    const imageInfo: { width?: number; height?: number } = result.image || {}
    let imageWidth = imageInfo.width || 0
    let imageHeight = imageInfo.height || 0
    
    // Fallback: If DINO-X didn't provide dimensions, calculate from bbox coordinates
    if ((imageWidth === 0 || imageHeight === 0) && objects.length > 0) {
      console.log('   ⚠️  No image dimensions from DINO-X API, calculating from bboxes...')
      
      // Find max coordinates across all bboxes (they're in pixel coordinates)
      let maxX = 0
      let maxY = 0
      objects.forEach(obj => {
        if (obj.bbox && obj.bbox.length === 4) {
          maxX = Math.max(maxX, obj.bbox[0], obj.bbox[2])
          maxY = Math.max(maxY, obj.bbox[1], obj.bbox[3])
        }
      })
      
      // Add 10% padding since items at edges might not reach actual image boundaries
      imageWidth = Math.round(maxX * 1.1)
      imageHeight = Math.round(maxY * 1.1)
      
      console.log(`   📐 Calculated dimensions from bboxes: ${imageWidth}x${imageHeight} (max coords: ${maxX.toFixed(0)}x${maxY.toFixed(0)})`)
    } else {
      console.log(`   📐 Image dimensions from DINO-X: ${imageWidth}x${imageHeight}`)
    }
    
    // Log sample bboxes for debugging
    if (objects.length > 0) {
      console.log('📏 Sample bboxes from DINOx:')
      objects.slice(0, 3).forEach((obj, i) => {
        console.log(`   [${i}] ${obj.category}: bbox=${JSON.stringify(obj.bbox)} (score=${obj.score})`)
      })
    }

    // Check if bboxes need normalization
    const needsNormalization = objects.length > 0 && objects[0].bbox && objects[0].bbox.some((coord: number) => coord > 1)
    
    if (needsNormalization && imageWidth > 0 && imageHeight > 0) {
      console.log(`   🔧 Normalizing pixel coordinates to 0-1 range using ${imageWidth}x${imageHeight}`)
      
      // Normalize all bboxes
      objects.forEach((obj) => {
        if (obj.bbox && obj.bbox.length === 4) {
          const [x1, y1, x2, y2] = obj.bbox
          obj.bbox = [
            x1 / imageWidth,
            y1 / imageHeight,
            x2 / imageWidth,
            y2 / imageHeight
          ]
        }
      })
      
      console.log('   ✅ Bboxes normalized to 0-1 range')
      console.log(`   Sample normalized bbox: ${JSON.stringify(objects[0]?.bbox)}`)
    } else if (needsNormalization) {
      console.warn(`   ⚠️  Bboxes need normalization but image dimensions not available!`)
    } else {
      console.log(`   ✅ Bboxes already normalized (values <= 1)`)
    }

    // Category-aware confidence thresholds
    // Primary garments: Lower threshold (these are the main focus)
    // Small accessories: Higher threshold (poor search quality, often false positives)
    const CATEGORY_THRESHOLDS: Record<string, number> = {
      // Primary garments (PRIORITY - lower threshold)
      'dress': 0.25,
      'robe': 0.25,
      'coat': 0.25,
      'jacket': 0.28,
      'leather jacket': 0.28,
      'fur coat': 0.28,
      'shirt': 0.30,
      'blouse': 0.30,
      'button up shirt': 0.30,
      'sweater': 0.30,
      'cardigan': 0.30,
      'hoodie': 0.30,
      'pants': 0.30,
      'jeans': 0.30,
      'trousers': 0.30,
      'skirt': 0.30,
      'shorts': 0.32,
      
      // Footwear & bags (medium threshold)
      'shoes': 0.35,
      'sneakers': 0.35,
      'boots': 0.35,
      'sandals': 0.35,
      'heels': 0.35,
      'bag': 0.38,
      'handbag': 0.38,
      'clutch': 0.38,
      'backpack': 0.40,
      
      // Medium accessories (standard threshold)
      'sunglasses': 0.40,
      'hat': 0.40,
      'cap': 0.40,
      'scarf': 0.40,
      'belt': 0.42,
      
      // Small accessories (HIGH threshold - poor search results)
      'watch': 0.50,
      'bracelet': 0.55,
      'necklace': 0.50,
      'ring': 0.60,  // Rings especially problematic
      'earrings': 0.55,
      'jewelry': 0.55
    }
    
    const DEFAULT_THRESHOLD = 0.40  // Fallback for unknown categories
    const MAIN_SUBJECT_THRESHOLD = 0.35  // Sweet spot: not too many, not zero (was 0.30→0.45→now 0.35)
    const MAX_ITEMS = 5  // Limit to top 5 items to reduce clutter
    
    console.log(`   Applying category-aware confidence thresholds`)
    
    const afterConfidenceFilter = objects.filter(obj => {
      const categoryThreshold = CATEGORY_THRESHOLDS[obj.category.toLowerCase()] || DEFAULT_THRESHOLD
      const pass = obj.score >= categoryThreshold
      if (!pass) {
        console.log(`   ❌ Filtered out (low confidence): ${obj.category} (${obj.score.toFixed(3)} < ${categoryThreshold})`)
      } else {
        console.log(`   ✅ Passed confidence: ${obj.category} (${obj.score.toFixed(3)} >= ${categoryThreshold})`)
      }
      return pass
    })
    console.log(`   After confidence filter: ${afterConfidenceFilter.length}/${objects.length}`)
    
    // Apply Non-Maximum Suppression to remove overlapping duplicates
    // (e.g., "dress" and "robe" detected for the same region)
    console.log(`   📦 Before NMS: ${afterConfidenceFilter.length} items`)
    afterConfidenceFilter.forEach(obj => {
      console.log(`      - ${obj.category} (score: ${obj.score.toFixed(3)}, bbox: ${JSON.stringify(obj.bbox.map((c: number) => c.toFixed(3)))})`)
    })
    
    const afterNMS = applyNMS(afterConfidenceFilter, 0.5)  // IoU threshold = 0.5 (50% overlap) - engulfment handled separately
    console.log(`   ✅ After NMS: ${afterNMS.length}/${afterConfidenceFilter.length} (removed ${afterConfidenceFilter.length - afterNMS.length} overlapping/engulfed duplicates)`)
    
    // Calculate scores for all items
    const allScored = afterNMS.map((obj, idx) => {
        const bbox = obj.bbox
        const confidence = obj.score

        // Calculate main subject score (size + centrality + confidence)
        let mainSubjectScore = confidence * 0.4

        if (bbox.length === 4) {
          const [x1, y1, x2, y2] = bbox
          const bboxWidth = Math.abs(x2 - x1)
          const bboxHeight = Math.abs(y2 - y1)
          const bboxArea = bboxWidth * bboxHeight

          const bboxCenterX = (x1 + x2) / 2
          const bboxCenterY = (y1 + y2) / 2
          const distanceFromCenter = Math.sqrt(
            Math.pow(bboxCenterX - 0.5, 2) + Math.pow(bboxCenterY - 0.5, 2)
          )

          const centralityScore = Math.max(0, 1 - distanceFromCenter * 2)
          const sizeScore = Math.min(1, bboxArea * 10)
          // Increased weight on size and centrality to better focus on main subject
          mainSubjectScore = confidence * 0.3 + centralityScore * 0.4 + sizeScore * 0.3
        }

        const mappedCategory = mapCategory(obj.category)

        return {
          id: `${mappedCategory}_${idx}`,
          bbox: bbox,
          category: obj.category,
          mapped_category: mappedCategory,
          confidence: Math.round(confidence * 1000) / 1000,
          main_subject_score: Math.round(mainSubjectScore * 1000) / 1000
        }
      })
    
    console.log(`   Calculated scores for ${allScored.length} items`)
    allScored.forEach(item => {
      console.log(`   ${item.category}: conf=${item.confidence}, main_subject_score=${item.main_subject_score}`)
    })
    
    // Filter by main subject threshold
    const bboxesWithScores = allScored
      .filter(item => {
        const pass = item.main_subject_score >= MAIN_SUBJECT_THRESHOLD
        if (!pass) console.log(`   ❌ Filtered out (low main_subject_score): ${item.category} (${item.main_subject_score})`)
        return pass
      })
      .sort((a, b) => b.main_subject_score - a.main_subject_score)
      .slice(0, MAX_ITEMS)

    console.log(`✅ Final result: ${bboxesWithScores.length} items after all filters`)
    if (bboxesWithScores.length > 0) {
      console.log('   Final items:')
      bboxesWithScores.forEach(item => {
        console.log(`     - ${item.category} (score: ${item.main_subject_score})`)
      })
    } else {
      console.warn('   ⚠️  NO ITEMS PASSED ALL FILTERS!')
    }

    return NextResponse.json({
      bboxes: bboxesWithScores,
      image_size: [imageWidth, imageHeight], // Required for backend cropping
      processing_time: 0,
      source: 'dino-x-direct',
      // Debug info
      debug: {
        raw_objects_count: objects.length,
        after_confidence_filter: afterConfidenceFilter.length,
        after_nms: afterNMS.length,
        after_main_subject_filter: bboxesWithScores.length,
        raw_objects: objects.map(o => ({ category: o.category, score: o.score })).slice(0, 10),
        image_dimensions: `${imageWidth}x${imageHeight}`,
        bboxes_normalized: !needsNormalization || (needsNormalization && imageWidth > 0)
      }
    })

  } catch (error: any) {
    console.error('❌ DINO-X detection error:', error)
    console.error('   Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Detection failed',
        details: error.stack,
        step: 'detection'
      },
      { status: 500 }
    )
  }
}

