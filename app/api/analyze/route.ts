import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run'

export interface DetectedItem {
  category: string  // e.g., "tops", "bottoms", "bag"
  groundingdino_prompt: string  // e.g., "gray shirt"
  description: string  // Detailed description
  croppedImageUrl?: string  // URL to cropped image
  confidence?: number  // Detection confidence (0-1)
}

export interface AnalyzeResponse {
  items: DetectedItem[]
  cached: boolean
  timing?: {
    // Chronological order of pipeline operations:
    download_seconds: number
    gpt4o_seconds: number
    groundingdino_seconds: number
    processing_seconds: number
    upload_seconds: number
    overhead_seconds: number
    total_seconds: number
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    console.log('\n================================================================================')
    console.log('=== ANALYZE + CROP REQUEST STARTED (GPT + GroundingDINO) ===')
    console.log(`🖼️ Image URL: ${imageUrl}`)
    console.log(`🎯 Backend: ${BACKEND_URL}`)
    console.log('================================================================================\n')

    // Call Python backend for GPT analysis
    const analyzeStart = Date.now()
    
    // Add retry logic for cold starts
    let backendResponse
    let lastError
    const maxRetries = 2
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} to reach backend...`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout
        
        backendResponse = await fetch(`${BACKEND_URL}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl
          }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (backendResponse.ok) {
          break // Success!
        }
        
        lastError = await backendResponse.text()
        console.warn(`⚠️ Attempt ${attempt} failed with status ${backendResponse.status}: ${lastError}`)
        
        if (attempt < maxRetries) {
          console.log('⏳ Waiting 3 seconds before retry...')
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        console.warn(`⚠️ Attempt ${attempt} error: ${lastError}`)
        
        if (attempt < maxRetries && (lastError.includes('timeout') || lastError.includes('aborted'))) {
          console.log('⏳ Backend might be cold starting, waiting 5 seconds...')
          await new Promise(resolve => setTimeout(resolve, 5000))
        } else if (attempt >= maxRetries) {
          throw error
        }
      }
    }

    if (!backendResponse || !backendResponse.ok) {
      const errorText = backendResponse ? await backendResponse.text() : lastError
      console.error('❌ Backend analysis failed after all retries:', errorText)
      throw new Error(`Backend returned ${backendResponse?.status || 'no response'}: ${errorText}`)
    }

    const result: AnalyzeResponse = await backendResponse.json()
    const analyzeTime = ((Date.now() - analyzeStart) / 1000).toFixed(2)

    console.log(`✅ Analysis complete in ${analyzeTime}s`)
    console.log(`📊 Detected ${result.items.length} items:`)
    result.items.forEach(item => {
      console.log(`   - ${item.category}: ${item.groundingdino_prompt}`)
    })
    console.log(`💾 Cached: ${result.cached}`)
    
    // Log backend timing if available (chronological order)
    if (result.timing) {
      console.log('\n⏱️  BACKEND TIMING (chronological):')
      console.log(`   1. Download image: ${result.timing.download_seconds}s`)
      console.log(`   2. GPT-4o Vision: ${result.timing.gpt4o_seconds}s`)
      console.log(`   3. GroundingDINO: ${result.timing.groundingdino_seconds}s`)
      console.log(`   4. Image processing: ${result.timing.processing_seconds}s`)
      console.log(`   5. Upload crops: ${result.timing.upload_seconds}s`)
      console.log(`   6. Overhead: ${result.timing.overhead_seconds}s`)
      console.log(`   → Total: ${result.timing.total_seconds}s`)
    }
    console.log('================================================================================\n')

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed', items: [], cached: false },
      { status: 500 }
    )
  }
}

