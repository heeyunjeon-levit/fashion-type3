import { NextRequest, NextResponse } from 'next/server'

const DINOX_API_BASE = 'https://api.deepdataspace.com'
const DINOX_API_TOKEN = process.env.DINOX_API_TOKEN || 'bdf2ed490ebe69a28be81ea9d9b0b0e3'

interface DetectionObject {
  category: string
  bbox: number[]
  score: number
}

interface DINOXDetectionResult {
  objects: DetectionObject[]
}

// Fashion categories for detection
const FASHION_CATEGORIES = [
  "shirt", "jacket", "blouse", "button up shirt", "vest", "skirt",
  "shorts", "pants", "shoes", "bag", "dress", "coat", "sweater",
  "cardigan", "hoodie", "jeans", "sneakers", "boots",
  "sandals", "backpack", "purse", "handbag", "hat", "cap", "scarf",
  "belt", "watch", "sunglasses", "jewelry", "necklace", "bracelet",
  "earrings", "ring"
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
    bbox_threshold: 0.45,  // Increased threshold to focus on main subject
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
        return data.data?.result
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
  'shirt': 'tops',
  'blouse': 'tops',
  'button up shirt': 'tops',
  'button_up_shirt': 'tops',
  'vest': 'tops',
  'sweater': 'tops',
  'cardigan': 'tops',
  'hoodie': 'tops',
  'jacket': 'tops',
  'coat': 'tops',
  'pants': 'bottoms',
  'jeans': 'bottoms',
  'shorts': 'bottoms',
  'skirt': 'bottoms',
  'dress': 'dress',
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

    // Filter and score items for main subject focus
    const CONFIDENCE_THRESHOLD = 0.45
    const MAIN_SUBJECT_THRESHOLD = 0.35
    const MAX_ITEMS = 8
    const EXCLUDED_CATEGORIES = ['leggings', 'tights', 'stockings']

    console.log(`   Applying filters: confidence >= ${CONFIDENCE_THRESHOLD}, excluding ${EXCLUDED_CATEGORIES.join(', ')}`)
    
    const afterConfidenceFilter = objects.filter(obj => {
      const pass = obj.score >= CONFIDENCE_THRESHOLD
      if (!pass) console.log(`   ❌ Filtered out (low confidence): ${obj.category} (${obj.score})`)
      return pass
    })
    console.log(`   After confidence filter: ${afterConfidenceFilter.length}/${objects.length}`)
    
    const afterCategoryFilter = afterConfidenceFilter.filter(obj => {
      const excluded = EXCLUDED_CATEGORIES.includes(obj.category.toLowerCase())
      if (excluded) console.log(`   ❌ Filtered out (excluded category): ${obj.category}`)
      return !excluded
    })
    console.log(`   After category filter: ${afterCategoryFilter.length}/${afterConfidenceFilter.length}`)
    
    // Calculate scores for all items
    const allScored = afterCategoryFilter.map((obj, idx) => {
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
          mainSubjectScore = confidence * 0.4 + centralityScore * 0.35 + sizeScore * 0.25
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
      image_size: [0, 0], // Not needed for normalized coords
      processing_time: 0,
      source: 'dino-x-direct'
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

