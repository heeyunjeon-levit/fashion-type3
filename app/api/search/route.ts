import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { GoogleGenAI, ThinkingLevel } from '@google/genai'

// Initialize OpenAI lazily to read fresh env vars on each request
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// Initialize Gemini client
function getGeminiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GCLOUD_API_KEY || ''
  })
}

// Map categories to search terms
const categorySearchTerms: Record<string, string[]> = {
  tops: ['jacket', 'coat', 'outerwear', 'shirt', 'sweater', 'blouse', 'top', 'blazer', 'cardigan'],
  bottoms: ['shorts', 'slacks', 'pants', 'trousers', 'jeans', 'skirt', 'leg trousers'],
  bag: ['bag', 'backpack', 'handbag', 'tote bag', 'purse', 'clutch', 'messenger bag', 'shoulder bag', 'wallet'],
  shoes: ['shoes', 'sneakers', 'boots', 'sandals', 'heels', 'flats', 'loafers', 'oxford'],
  accessory: ['accessory', 'jewelry', 'watch', 'necklace', 'earrings', 'bracelet', 'ring', 'hat', 'cap', 'beanie', 'belt', 'scarf', 'sunglasses'],
  dress: ['dress', 'gown', 'maxi dress', 'midi dress', 'mini dress', 'cocktail dress', 'casual dress'],
}

const categoryLabels: Record<string, string> = {
  tops: '상의 (tops - jackets, coats, shirts, sweaters)',
  bottoms: '하의 (bottoms - shorts, pants, skirts)',
  bag: '가방 (bag - handbags, backpacks, totes)',
  shoes: '신발 (shoes - sneakers, boots, sandals)',
  accessory: '악세사리 (accessories - jewelry, watches, hats, belts)',
  dress: '드레스 (dress - dresses, gowns)',
}

// Fallback search handler when no items are detected
async function handleFallbackSearch(originalImageUrl: string, requestStartTime: number) {
  console.log('🔍 FALLBACK: Starting full image search...')
  
  const timingData = {
    serper_api_time: 0,
    gpt4_turbo_api_time: 0,
    processing_time: 0
  }
  
  try {
    // Run full image search multiple times for better coverage
    const fullImagePromises = Array.from({ length: 3 }, (_, i) => {
      console.log(`   Fallback run ${i + 1}/3...`)
      return fetch('https://google.serper.dev/lens', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: originalImageUrl,
          gl: 'kr',
          hl: 'ko',
        }),
      })
    })

    const serperStart = Date.now()
    const fullImageResponses = await Promise.all(fullImagePromises)
    timingData.serper_api_time = (Date.now() - serperStart) / 1000
    console.log(`   ⏱️  Fallback Serper (3x): ${timingData.serper_api_time.toFixed(2)}s`)
    
    // Aggregate all results
    const allResults: any[] = []
    for (let i = 0; i < fullImageResponses.length; i++) {
      if (fullImageResponses[i].ok) {
        const data = await fullImageResponses[i].json()
        if (data.organic) {
          allResults.push(...data.organic)
        }
      }
    }
    
    // Deduplicate
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.link, item])).values()
    )
    
    console.log(`📊 Fallback: Found ${uniqueResults.length} unique results`)
    
    if (uniqueResults.length === 0) {
      console.log('❌ Fallback: No results found')
      return NextResponse.json({
        results: {},
        meta: {
          fallbackMode: true,
          success: false,
          message: 'No products found in fallback search'
        }
      })
    }
    
    // Use GPT-4.1 to analyze and categorize the results
    const topResults = uniqueResults.slice(0, 30)
    
    const prompt = `You are analyzing image search results for a fashion product where automatic detection failed.

The user uploaded an image but our AI couldn't detect specific items. These are visual search results from the full image.

Your task: Analyze these results and extract the TOP 3-5 BEST product links that match what you see.

CRITICAL RULES:
1. ✅ MUST be fashion items (clothing, shoes, bags, accessories)
2. ✅ MUST be actual product pages (not category pages, not social media)
3. ✅ Prefer reputable retailers and e-commerce sites
4. ✅ Look for consistent product types across results (what is this image showing?)
5. ❌ REJECT: Instagram, TikTok, Pinterest, YouTube, blogs, forums
6. ❌ REJECT: Category/search/listing pages
7. ❌ REJECT: Non-shopping sites

Determine what type of fashion item this is based on the search results, then select the best product matches.

Search results:
${JSON.stringify(topResults, null, 2)}

Respond with JSON:
{
  "detected_category": "tops|bottoms|shoes|bag|accessory|dress|unknown",
  "product_links": ["url1", "url2", "url3"],
  "reasoning": "brief explanation of what you detected"
}

Return TOP 3-5 BEST matches only. Quality over quantity.`

    const openai = getOpenAIClient()
    const gptStart = Date.now()
    
    // Use GPT-4 Turbo for analysis (fast & reliable!)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-2024-04-09',
      messages: [
        {
          role: 'system',
          content: 'You are a fashion product analyzer. Return only valid JSON without any markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })
    
    timingData.gpt4_turbo_api_time = (Date.now() - gptStart) / 1000
    console.log(`   ⏱️  Fallback GPT-4 Turbo: ${timingData.gpt4_turbo_api_time.toFixed(2)}s`)

    // Parse response from GPT-4
    const responseText = completion.choices[0]?.message?.content || '{}'
    
    if (!responseText || responseText === '{}') {
      console.error(`❌ No response from Fallback GPT-4 Turbo`)
    }
    
    // Parse JSON - improved extraction
    let gptResult: any
    try {
      let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      // Extract ONLY the JSON object
      const firstBrace = cleaned.indexOf('{')
      if (firstBrace === -1) throw new Error('No JSON object found')
      
      let braceCount = 0
      let lastBrace = firstBrace
      for (let i = firstBrace; i < cleaned.length; i++) {
        if (cleaned[i] === '{') braceCount++
        if (cleaned[i] === '}') {
          braceCount--
          if (braceCount === 0) {
            lastBrace = i
            break
          }
        }
      }
      
      const jsonStr = cleaned.substring(firstBrace, lastBrace + 1)
      gptResult = JSON.parse(jsonStr)
      
    } catch (parseError: any) {
      console.error(`❌ Fallback JSON parse error:`, parseError.message)
      console.error(`   Raw response:`, responseText.substring(0, 500))
      gptResult = { product_links: [] }
    }
    
    console.log(`📋 Fallback GPT detected: ${gptResult.detected_category}`)
    console.log(`📋 Fallback GPT reasoning: ${gptResult.reasoning}`)
    
    // Filter and format results
    const validLinks = (gptResult.product_links || []).filter((link: string) => {
      return typeof link === 'string' && link.startsWith('http')
    })
    
    if (validLinks.length === 0) {
      console.log('❌ Fallback: GPT found no valid products')
      return NextResponse.json({
        results: {},
        meta: {
          fallbackMode: true,
          success: false,
          message: 'No valid products found after analysis'
        }
      })
    }
    
    // Format results
    const products = validLinks.slice(0, 3).map((link: string) => {
      const resultItem = uniqueResults.find((item: any) => item.link === link)
      return {
        link,
        thumbnail: resultItem?.thumbnail || resultItem?.image || null,
        title: resultItem?.title || 'Product'
      }
    })
    
    const category = gptResult.detected_category === 'unknown' ? 'general_item' : `${gptResult.detected_category}_1`
    
    const totalTime = (Date.now() - requestStartTime) / 1000
    
    console.log(`✅ Fallback SUCCESS: ${products.length} products found`)
    console.log(`⏱️  Fallback total time: ${totalTime.toFixed(2)}s`)
    
    return NextResponse.json({
      results: {
        [category]: products
      },
      meta: {
        fallbackMode: true,
        success: true,
        detectedCategory: gptResult.detected_category,
        reasoning: gptResult.reasoning,
        timing: {
          serper_api_seconds: timingData.serper_api_time,
          gpt4_turbo_seconds: timingData.gpt4_turbo_api_time,
          total_seconds: totalTime
        }
      }
    })
    
  } catch (error) {
    console.error('❌ Fallback search error:', error)
    return NextResponse.json({
      results: {},
      meta: {
        fallbackMode: true,
        success: false,
        error: 'Fallback search failed'
      }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestStartTime = Date.now()
    console.log('=== SEARCH REQUEST STARTED ===')
    
    const { categories, croppedImages, descriptions, originalImageUrl, useOCRSearch } = await request.json()
    console.log('📤 Received categories:', categories)
    console.log('📤 Cropped images:', Object.keys(croppedImages || {}))
    console.log('📝 Descriptions:', descriptions ? Object.keys(descriptions) : 'none')
    console.log('🖼️ Original image URL:', originalImageUrl || 'none')
    console.log('🔍 OCR Search Mode:', useOCRSearch ? 'ENABLED (V3.1)' : 'disabled')

    // NEW: OCR Search Mode (V3.1 Pipeline)
    // This is a gradual integration - enabled when useOCRSearch flag is true
    if (useOCRSearch && originalImageUrl) {
      console.log('\n🎯 Using V3.1 OCR Search Pipeline...')
      console.log(`   useOCRSearch flag: ${useOCRSearch}`)
      console.log(`   originalImageUrl: ${originalImageUrl?.substring(0, 80)}...`)
      
      try {
        // Use Next.js OCR endpoint (bypasses Modal deployment issues)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
        console.log(`   🔗 Using Next.js OCR endpoint: ${baseUrl}/api/ocr-search`)
        
        const ocrResponse = await fetch(`${baseUrl}/api/ocr-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: originalImageUrl }),
          signal: AbortSignal.timeout(120000) // 2 minute timeout (Next.js OCR is faster than Modal)
        })
        
        if (ocrResponse.ok) {
          const ocrData = await ocrResponse.json()
          console.log(`   ✅ OCR search complete: ${ocrData.success}`)
          console.log(`   📦 Product results count: ${ocrData.product_results?.length || 0}`)
          
          if (ocrData.success) {
            // Transform to existing format for frontend compatibility
            const results: Record<string, any> = {}
            
            for (const productResult of ocrData.product_results || []) {
              const brand = productResult.brand
              const productType = productResult.product_type
              
              // Use brand + product type as key
              const resultKey = `${brand} ${productType}`
              
              // Transform to match expected format (direct array)
              results[resultKey] = productResult.results.map((r: any) => ({
                title: r.title || 'Product',
                link: r.link || '',
                thumbnail: r.thumbnail || null
              }))
            }
            
            const totalTime = (Date.now() - requestStartTime) / 1000
            console.log(`\n✅ V3.1 OCR Search complete in ${totalTime.toFixed(1)}s`)
            console.log(`   Products found: ${Object.keys(results).length}`)
            
            return NextResponse.json({
              results,
              meta: {
                mode: 'ocr_v3.1_nextjs',
                success: true,
                total_time: totalTime,
                extracted_text: ocrData.extracted_text
              },
              timing: {
                total_seconds: totalTime
              }
            })
          } else {
            // OCR succeeded but found no text or products
            const totalTime = (Date.now() - requestStartTime) / 1000
            console.log(`   ⚠️ OCR returned no results: ${ocrData.reason || 'unknown reason'}`)
            return NextResponse.json({
              results: {},
              meta: {
                mode: 'ocr_v3.1_nextjs',
                success: false,
                reason: ocrData.reason || 'No OCR text detected',
                total_time: totalTime
              },
              timing: {
                total_seconds: totalTime
              }
            })
          }
        } else {
          console.error(`   ❌ OCR search failed: ${ocrResponse.status}`)
          const errorText = await ocrResponse.text()
          console.error(`   Error details: ${errorText}`)
          const totalTime = (Date.now() - requestStartTime) / 1000
          return NextResponse.json({
            results: {},
            meta: {
              mode: 'ocr_v3.1_nextjs',
              success: false,
              reason: `OCR endpoint returned ${ocrResponse.status}`,
              total_time: totalTime
            },
            timing: {
              total_seconds: totalTime
            }
          })
        }
      } catch (ocrError) {
        console.error('   ❌ OCR search error:', ocrError)
        const totalTime = (Date.now() - requestStartTime) / 1000
        return NextResponse.json({
          results: {},
          meta: {
            mode: 'ocr_v3.1',
            success: false,
            reason: `OCR search error: ${ocrError}`,
            total_time: totalTime
          },
          timing: {
            total_seconds: totalTime
          }
        })
      }
    }

    // Check if we need to use fallback mode (no items detected)
    const useFallbackMode = !categories || categories.length === 0 || !croppedImages || Object.keys(croppedImages).length === 0
    
    if (useFallbackMode && !originalImageUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }
    
    // FALLBACK MODE: If no items detected, search using full image
    if (useFallbackMode) {
      console.log('⚠️ FALLBACK MODE: No items detected, using full image search')
      return await handleFallbackSearch(originalImageUrl, requestStartTime)
    }

    // Results can be in two formats:
    // 1. Two-stage format: { colorMatches: [], styleMatches: [] }
    // 2. Legacy format: Array of items (for backward compatibility)
    type ResultItem = { link: string; thumbnail: string | null; title: string | null }
    type TwoStageResults = {
      colorMatches: ResultItem[]
      styleMatches: ResultItem[]
    }
    const allResults: Record<string, TwoStageResults | ResultItem[]> = {}
    const gptReasoningData: Record<string, any> = {}
    const timingData: Record<string, number> = {
      serper_total_api_time: 0,  // Accumulated time across all Serper calls
      gpt4_turbo_total_api_time: 0,  // Accumulated time across all GPT calls
      full_image_search_time: 0,  // Full image search
      per_category_search_time: 0,  // Per-category searches
      processing_overhead_time: 0,  // Deduplication, merging, etc.
      serper_count: 0,
      gpt4_turbo_count: 0,
      search_wall_clock_start: Date.now()  // Actual elapsed time
    }
    
    console.log(`🔍 Searching categories: ${categories.join(', ')}`)
    
    // First, do a full image search to get results for all item types
    let fullImageResults: any[] = []
    if (originalImageUrl) {
      console.log('\n🔍 Doing full image search for all item types...')
      try {
        const fullImagePromises = Array.from({ length: 3 }, (_, i) => {
          console.log(`   Full image run ${i + 1}/3...`)
          return fetch('https://google.serper.dev/lens', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: originalImageUrl,
              gl: 'kr',
              hl: 'ko',
            }),
          })
        })

        const fullImageStart = Date.now()
        const fullImageResponses = await Promise.all(fullImagePromises)
        const fullImageTime = (Date.now() - fullImageStart) / 1000
        timingData.full_image_search_time = fullImageTime
        console.log(`   ⏱️  Full image Serper (3x parallel): ${fullImageTime.toFixed(2)}s`)
        
        const processingStart = Date.now()
        const allFullImageResults: any[] = []
        for (let i = 0; i < fullImageResponses.length; i++) {
          if (!fullImageResponses[i].ok) {
            console.log(`   ❌ Full image run ${i + 1}/3 failed`)
            continue
          }
          const fullImageData = await fullImageResponses[i].json()
          console.log(`   ✅ Full image run ${i + 1}/3 returned ${fullImageData.organic?.length || 0} results`)
          
          if (fullImageData.organic) {
            allFullImageResults.push(...fullImageData.organic)
          }
        }

        // Deduplicate full image results
        fullImageResults = Array.from(
          new Map(allFullImageResults.map(item => [item.link, item])).values()
        )
        const processingTime = (Date.now() - processingStart) / 1000
        timingData.processing_overhead_time += processingTime
        
        console.log(`📊 Full image search returned ${fullImageResults.length} unique results`)
        console.log(`   ⏱️  Processing/deduplication: ${processingTime.toFixed(3)}s`)
        
        // Log top full image results for debugging
        if (fullImageResults.length > 0) {
          console.log('🔝 Top 5 full image results:')
          fullImageResults.slice(0, 5).forEach((r: any, i: number) => {
            console.log(`   ${i + 1}. ${r.source || 'Unknown'}: ${r.title?.substring(0, 50)}...`)
            console.log(`      Link: ${r.link?.substring(0, 60)}...`)
            console.log(`      Has thumbnail: ${!!(r.thumbnailUrl || r.thumbnail || r.imageUrl)}`)
          })
        }
      } catch (error) {
        console.error('❌ Error in full image search:', error)
        // Continue with cropped image search even if full image search fails
      }
    }
    
    // Search each cropped image entry in parallel (handles tops, tops_1, tops_2, ...)
    const croppedEntries = Object.entries(croppedImages || {}) as [string, string][]
    
    // Process all cropped images in parallel for maximum speed
    const categoriesStart = Date.now()
    const searchPromises = croppedEntries.map(async ([resultKey, croppedImageUrl]) => {
      if (!croppedImageUrl) {
        console.log(`⚠️ No cropped image for ${resultKey}`)
        return { resultKey, results: null }
      }

      const categoryKey = resultKey.split('_')[0] // base category without instance suffix
      
      console.log(`\n🔍 Searching for ${resultKey} (3 runs for best coverage)...`)
      console.log(`   📸 Cropped image URL: ${croppedImageUrl}`)
      
      try {
        // Call Serper Lens 3 times for best result coverage (VISUAL SEARCH)
        const serperCallPromises = Array.from({ length: 3 }, (_, i) => {
          console.log(`   Run ${i + 1}/3...`)
          return fetch('https://google.serper.dev/lens', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: croppedImageUrl,
              gl: 'kr',
              hl: 'ko',
            }),
          })
        })

        // NEW: Text-based image search using description (KEYWORD SEARCH)
        const descriptionForSearch = descriptions?.[resultKey]
        let textSearchPromise: Promise<Response> | null = null
        
        if (descriptionForSearch) {
          console.log(`   📝 Text search with description: "${descriptionForSearch.substring(0, 60)}..."`)
          textSearchPromise = fetch('https://google.serper.dev/images', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: descriptionForSearch,
              gl: 'kr',
              hl: 'ko',
              num: 60, // Get 60 results
            }),
          })
        }

        const serperStart = Date.now()
        const allPromises = textSearchPromise 
          ? [...serperCallPromises, textSearchPromise]
          : serperCallPromises
        
        const allResponses = await Promise.all(allPromises)
        const serperResponses = allResponses.slice(0, 3) // First 3 are visual
        const textSearchResponse = textSearchPromise ? allResponses[3] : null
        
        const serperTime = (Date.now() - serperStart) / 1000
        timingData.serper_total_api_time += serperTime
        timingData.serper_count += textSearchPromise ? 2 : 1 // Count visual + text searches
        console.log(`   ⏱️  Serper API (${textSearchPromise ? '3x visual + 1x text' : '3x visual'}): ${serperTime.toFixed(2)}s`)
        
        // Aggregate results from 3 visual search runs
        const allOrganicResults: any[] = []
        for (let i = 0; i < serperResponses.length; i++) {
          if (!serperResponses[i].ok) {
            const errorText = await serperResponses[i].text()
            console.log(`   ❌ Run ${i + 1}/3 failed:`, errorText.substring(0, 200))
            continue
          }
          const serperData = await serperResponses[i].json()
          console.log(`   ✅ Run ${i + 1}/3 returned ${serperData.organic?.length || 0} results`)
          
          if (serperData.organic) {
            // Mark as visual search for debugging
            allOrganicResults.push(...serperData.organic.map((item: any) => ({
              ...item,
              searchType: 'visual'
            })))
          }
        }

        // Process text-based search results if available
        const textSearchResults: any[] = []
        if (textSearchResponse && textSearchResponse.ok) {
          const textData = await textSearchResponse.json()
          console.log(`   ✅ Text search returned ${textData.images?.length || 0} results`)
          
          if (textData.images) {
            // Transform text search results to match visual search format AND mark them as text search
            textSearchResults.push(...textData.images.map((img: any) => ({
              title: img.title,
              link: img.link,
              source: img.source,
              thumbnail: img.thumbnailUrl || img.imageUrl,
              imageUrl: img.imageUrl,
              position: img.position,
              searchType: 'text' // Mark as text search for debugging
            })))
            
            // LOG first 10 text search results for debugging
            console.log(`\n📝 TEXT SEARCH RESULTS (first 10):`)
            textSearchResults.slice(0, 10).forEach((item, idx) => {
              console.log(`   ${idx + 1}. "${item.title?.substring(0, 60)}..." - ${item.link}`)
            })
          }
        } else if (textSearchResponse) {
          const errorText = await textSearchResponse.text()
          console.log(`   ❌ Text search failed:`, errorText.substring(0, 200))
        }

        // Merge visual + text search results
        const combinedSearchResults = [...allOrganicResults, ...textSearchResults]
        console.log(`📊 Combined search: ${allOrganicResults.length} visual + ${textSearchResults.length} text = ${combinedSearchResults.length} total`)

        // Deduplicate by URL and keep unique results
        const uniqueCroppedResults = Array.from(
          new Map(combinedSearchResults.map(item => [item.link, item])).values()
        )
        
        console.log(`📊 After deduplication: ${uniqueCroppedResults.length} unique results`)
        
        // STRICT CATEGORY FILTERING: Filter full image results to only include items relevant to this category
        const filteredFullImageResults = fullImageResults.filter(item => {
          const title = item.title?.toLowerCase() || ''
          const snippet = item.snippet?.toLowerCase() || ''
          const url = item.link?.toLowerCase() || ''
          const combinedText = `${title} ${snippet} ${url}`
          
          // Define STRICT category exclusion rules (prevent wrong categories from contaminating results)
          const categoryExclusions: Record<string, string[]> = {
            'bags': [
              // EXCLUDE clothing
              'sweater', 'cardigan', 'jacket', 'coat', 'shirt', 'blouse', 'top', 'dress', 'pants', 'jeans', 'skirt', 'shorts',
              '스웨터', '가디건', '재킷', '코트', '셔츠', '블라우스', '상의', '원피스', '바지', '청바지', '치마', '반바지',
              // EXCLUDE shoes
              'sneaker', 'boot', 'shoe', 'sandal', 'heel', 'slipper', '신발', '부츠', '샌들', '슬리퍼',
              // EXCLUDE accessories
              'hat', 'cap', 'scarf', 'glove', 'belt', 'watch', 'jewelry', '모자', '스카프', '장갑', '벨트', '시계'
            ],
            'tops': [
              // EXCLUDE bottoms
              'pants', 'jeans', 'trousers', 'shorts', 'skirt', '바지', '청바지', '반바지', '치마', 'slacks',
              // EXCLUDE bags/shoes/accessories
              'bag', 'backpack', 'purse', 'tote', 'clutch', '가방', '백팩',
              'sneaker', 'boot', 'shoe', '신발', '부츠'
            ],
            'bottoms': [
              // EXCLUDE tops
              'shirt', 'blouse', 'sweater', 'jacket', 'coat', 'hoodie', 'cardigan', 'blazer', '셔츠', '블라우스', '스웨터', '재킷', '코트', '후드', '가디건',
              // EXCLUDE bags/shoes/accessories
              'bag', 'backpack', 'purse', 'tote', '가방', '백팩',
              'sneaker', 'boot', 'shoe', '신발', '부츠'
            ],
            'shoes': [
              // EXCLUDE clothing
              'shirt', 'sweater', 'jacket', 'pants', 'dress', 'skirt', '셔츠', '스웨터', '재킷', '바지', '원피스',
              // EXCLUDE bags/accessories
              'bag', 'backpack', 'purse', 'tote', '가방', '백팩'
            ],
            'accessory': [
              // EXCLUDE ALL clothing
              'shirt', 'sweater', 'jacket', 'coat', 'pants', 'dress', 'skirt', 'shorts', 
              '셔츠', '스웨터', '재킷', '코트', '바지', '원피스', '치마', '반바지',
              // EXCLUDE ALL bags (critical for sunglasses/jewelry searches!)
              'bag', 'backpack', 'purse', 'tote', 'clutch', 'crossbody', 'shoulder bag', 
              'handbag', 'belt bag', 'fanny pack', 'bum bag', 'messenger', 'satchel',
              '가방', '백팩', '토트백', '크로스백', '숄더백', '클러치',
              // EXCLUDE ALL shoes
              'sneaker', 'boot', 'shoe', 'sandal', 'heel', 'slipper',
              '신발', '부츠', '샌들', '슬리퍼', '운동화'
            ]
          }
          
          // Check for EXCLUDED categories (strict filtering)
          const exclusionList = categoryExclusions[categoryKey] || []
          const hasExcludedCategory = exclusionList.some(excludedTerm => {
            // Check in title, snippet, AND url path
            return combinedText.includes(excludedTerm.toLowerCase()) ||
                   combinedText.includes(`/${excludedTerm}/`) ||
                   combinedText.includes(`-${excludedTerm}-`)
          })
          
          if (hasExcludedCategory) {
            console.log(`🚫 CATEGORY MISMATCH: Excluded "${item.title?.substring(0, 40)}" from ${categoryKey} results`)
            return false
          }
          
          // Check if the result contains keywords relevant to this category
          const categoryTerms = categorySearchTerms[categoryKey] || [categoryKey]
          const hasRelevantKeyword = categoryTerms.some(term => combinedText.includes(term.toLowerCase()))
          
          if (!hasRelevantKeyword) {
            console.log(`ℹ️  No relevant keyword for ${categoryKey}: "${item.title?.substring(0, 40)}"`)
          }
          
          return hasRelevantKeyword
        })
        
        console.log(`📊 Full image results: ${fullImageResults.length} total, ${filteredFullImageResults.length} relevant to ${categoryKey}`)
        
        // APPLY SAME STRICT CATEGORY FILTERING to cropped results
        const filteredCroppedResults = uniqueCroppedResults.filter(item => {
          const title = item.title?.toLowerCase() || ''
          const url = item.link?.toLowerCase() || ''
          const combinedText = `${title} ${url}`
          
          // Same exclusion rules as full image filtering
          const categoryExclusions: Record<string, string[]> = {
            'bags': ['sweater', 'cardigan', 'jacket', 'coat', 'shirt', 'blouse', 'top', 'dress', 'pants', 'jeans', 'skirt', 'shorts', '스웨터', '가디건', '재킷', '코트', '셔츠', '블라우스', '상의', '원피스', '바지', '청바지', '치마', '반바지', 'sneaker', 'boot', 'shoe', 'sandal', 'heel', 'slipper', '신발', '부츠', '샌들', '슬리퍼'],
            'tops': ['pants', 'jeans', 'trousers', 'shorts', 'skirt', '바지', '청바지', '반바지', '치마', 'slacks', 'bag', 'backpack', 'purse', 'tote', 'clutch', '가방', '백팩', 'sneaker', 'boot', 'shoe', '신발', '부츠'],
            'bottoms': ['shirt', 'blouse', 'sweater', 'jacket', 'coat', 'hoodie', 'cardigan', 'blazer', '셔츠', '블라우스', '스웨터', '재킷', '코트', '후드', '가디건', 'bag', 'backpack', 'purse', 'tote', '가방', '백팩', 'sneaker', 'boot', 'shoe', '신발', '부츠'],
            'shoes': ['shirt', 'sweater', 'jacket', 'pants', 'dress', 'skirt', '셔츠', '스웨터', '재킷', '바지', '원피스', 'bag', 'backpack', 'purse', 'tote', '가방', '백팩'],
            'accessory': ['shirt', 'sweater', 'jacket', 'pants', 'dress', '셔츠', '스웨터', '재킷', '바지', 'bag', 'backpack', 'purse', 'tote', '가방', '백팩', 'sneaker', 'boot', 'shoe', '신발', '부츠']
          }
          
          const exclusionList = categoryExclusions[categoryKey] || []
          const hasExcludedCategory = exclusionList.some(excludedTerm => {
            return combinedText.includes(excludedTerm.toLowerCase()) ||
                   combinedText.includes(`/${excludedTerm}/`) ||
                   combinedText.includes(`-${excludedTerm}-`)
          })
          
          if (hasExcludedCategory) {
            console.log(`🚫 CROPPED FILTER: Excluded "${item.title?.substring(0, 40)}" from ${categoryKey}`)
            return false
          }
          
          return true
        })
        
        console.log(`📊 Cropped+Text results filtered: ${uniqueCroppedResults.length} → ${filteredCroppedResults.length} (removed ${uniqueCroppedResults.length - filteredCroppedResults.length} wrong categories)`)
        
        // Combine filtered cropped+text results with filtered full image results
        const combinedResults = [...filteredCroppedResults, ...filteredFullImageResults]
        
        // Deduplicate the combined results
        const uniqueCombinedResults = Array.from(
          new Map(combinedResults.map(item => [item.link, item])).values()
        )
        
        console.log(`📊 Combined (visual + text + full image): ${uniqueCombinedResults.length} unique results`)
        console.log(`   🖼️  Visual search: ${allOrganicResults.length} results`)
        console.log(`   📝 Text search: ${textSearchResults.length} results`)
        console.log(`   🎯 Full image: ${filteredFullImageResults.length} results`)
        
        const organicResults = uniqueCombinedResults.slice(0, 80) // Increased to 80 for better coverage
        
        if (organicResults.length === 0) {
          console.log(`⚠️ No Serper results for ${resultKey} after all searches`)
          return { resultKey, results: null }
        }
        
        console.log(`📋 Using top ${organicResults.length} results for ${resultKey}`)

        // Get GPT-4o Vision description from request (if provided)
        // This describes the specific item in detail (color, style, material, etc.)
        const itemDescription = descriptions?.[resultKey] || null
        
        // Extract primary color from description for strict matching
        let primaryColor: string | null = null
        let characterName: string | null = null
        
        if (itemDescription) {
          // Extract character/brand names (MOST IMPORTANT for graphic items!)
          const characterPatterns = [
            // Disney characters (English)
            /\b(Mickey Mouse|Minnie Mouse|Donald Duck|Daisy Duck|Winnie the Pooh|Pooh|Goofy|Pluto|Dumbo|Bambi|Simba|Stitch|Elsa|Anna|Ariel|Belle|Cinderella)\b/i,
            // Other characters (English)
            /\b(Hello Kitty|Snoopy|Pikachu|Pokemon|SpongeBob|Batman|Superman|Spider-Man|Avengers|Marvel|Disney)\b/i,
            // Brands/logos
            /\b(Nike|Adidas|Puma|Supreme|Gucci|Louis Vuitton|Chanel|Champion|North Face|Patagonia)\b/i,
            // Korean character names
            /(미키|미니|도널드|곰돌이|푸|스누피|헬로키티|포켓몬|피카츄)/
          ]
          for (const pattern of characterPatterns) {
            const match = itemDescription.match(pattern)
            if (match) {
              characterName = match[1] || match[0]
              break
            }
          }
          
          // Extract color
          const colorPatterns = [
            // English colors
            /\b(black|white|cream|ivory|beige|brown|tan|gray|grey|navy|blue|red|pink|green|yellow|orange|purple|burgundy|maroon|olive|khaki|charcoal|mint)\b/i,
            // Korean colors
            /(검정|검은|블랙|흰|화이트|크림|아이보리|베이지|브라운|네이비|블루|레드|핑크|그린|옐로우|퍼플|민트)/
          ]
          for (const pattern of colorPatterns) {
            const match = itemDescription.match(pattern)
            if (match) {
              primaryColor = match[1] || match[0]
              break
            }
          }
          console.log(`   📝 Using GPT description: "${itemDescription.substring(0, 80)}..."`)
          console.log(`   🎨 Extracted primary color: ${primaryColor || 'none detected'}`)
          console.log(`   🎭 Extracted character/graphic: ${characterName || 'none detected'}`)
        } else {
          console.log(`   ℹ️  No description provided for ${resultKey}`)
        }
        
        console.log(`🎯 Detected item: ${itemDescription || 'generic terms'}`)

        // Ask GPT to extract product links from results
        const searchTerms = itemDescription 
          ? [itemDescription, ...(categorySearchTerms[categoryKey] || [categoryKey])]
          : (categorySearchTerms[categoryKey] || [categoryKey])
        
        console.log(`🎯 Search terms for GPT: ${searchTerms.join(', ')}`)
        
        // Determine specific sub-type for ALL categories to filter correctly
        let specificSubType = null
        let subTypeExclusion = ''
        
        if (itemDescription) {
          const desc = itemDescription.toLowerCase()
          
          // TOPS sub-types
          if (categoryKey === 'tops') {
            if (desc.includes('jacket') || desc.includes('coat')) specificSubType = 'jacket/coat'
            else if (desc.includes('shirt') || desc.includes('blouse')) specificSubType = 'shirt/blouse'
            else if (desc.includes('sweater') || desc.includes('pullover') || desc.includes('knit')) specificSubType = 'sweater/knit'
            else if (desc.includes('hoodie') || desc.includes('sweatshirt')) specificSubType = 'hoodie/sweatshirt'
            else if (desc.includes('cardigan')) specificSubType = 'cardigan'
            else if (desc.includes('blazer')) specificSubType = 'blazer'
            else if (desc.includes('vest')) specificSubType = 'vest'
            
            const topsExclusions: Record<string, string> = {
              'jacket/coat': 'shirts, blouses, sweaters, hoodies, cardigans, t-shirts, tanks',
              'shirt/blouse': 'jackets, coats, sweaters, hoodies, cardigans (button-up shirts only)',
              'sweater/knit': 'jackets, coats, shirts, blouses, hoodies (pullover sweaters only)',
              'hoodie/sweatshirt': 'jackets, coats, shirts, sweaters, cardigans, blazers',
              'cardigan': 'jackets, coats, shirts, sweaters, hoodies, blazers (open-front cardigans only)',
              'blazer': 'jackets, coats, shirts, sweaters, hoodies, cardigans (structured blazers only)',
              'vest': 'jackets, coats, shirts, sweaters, hoodies, cardigans (sleeveless vests only)'
            }
            if (specificSubType && topsExclusions[specificSubType]) subTypeExclusion = `- ⚠️ CRITICAL: You are searching for ${specificSubType} ONLY. ❌ EXCLUDE: ${topsExclusions[specificSubType]}`
          }
          
          // BOTTOMS sub-types
          else if (categoryKey === 'bottoms') {
            if (desc.includes('skirt')) specificSubType = 'skirt'
            else if (desc.includes('short')) specificSubType = 'shorts'
            else if (desc.includes('jean')) specificSubType = 'jeans'
            else if (desc.includes('pant') || desc.includes('trouser') || desc.includes('slack')) specificSubType = 'pants/trousers'
            
            const bottomsExclusions: Record<string, string> = {
              'skirt': 'pants, jeans, shorts, trousers, slacks (skirts only, NOT pants)',
              'shorts': 'pants, jeans, skirts, trousers, slacks (shorts only, NOT long pants)',
              'jeans': 'skirts, shorts, dress pants, slacks (denim jeans only)',
              'pants/trousers': 'skirts, shorts (full-length pants only, NOT shorts or skirts)'
            }
            if (specificSubType && bottomsExclusions[specificSubType]) subTypeExclusion = `- ⚠️ CRITICAL: You are searching for ${specificSubType} ONLY. ❌ EXCLUDE: ${bottomsExclusions[specificSubType]}`
          }
          
          // SHOES sub-types
          else if (categoryKey === 'shoes') {
            if (desc.includes('boot')) specificSubType = 'boots'
            else if (desc.includes('sneaker') || desc.includes('trainer')) specificSubType = 'sneakers'
            else if (desc.includes('sandal')) specificSubType = 'sandals'
            else if (desc.includes('heel') || desc.includes('pump')) specificSubType = 'heels/pumps'
            else if (desc.includes('flat') || desc.includes('ballet')) specificSubType = 'flats'
            else if (desc.includes('loafer') || desc.includes('moccasin')) specificSubType = 'loafers'
            else if (desc.includes('oxford') || desc.includes('derby')) specificSubType = 'oxfords'
            
            const shoesExclusions: Record<string, string> = {
              'boots': 'sneakers, sandals, heels, flats, loafers (boots only, NOT low-top shoes)',
              'sneakers': 'boots, sandals, heels, flats, dress shoes (sneakers/trainers only)',
              'sandals': 'boots, sneakers, heels, flats, closed-toe shoes (open-toe sandals only)',
              'heels/pumps': 'boots, sneakers, sandals, flats (high heels/pumps only)',
              'flats': 'boots, sneakers, heels, sandals (flat shoes only, NO heels)',
              'loafers': 'boots, sneakers, sandals, heels (slip-on loafers only)',
              'oxfords': 'boots, sneakers, sandals, heels (lace-up oxfords only)'
            }
            if (specificSubType && shoesExclusions[specificSubType]) subTypeExclusion = `- ⚠️ CRITICAL: You are searching for ${specificSubType} ONLY. ❌ EXCLUDE: ${shoesExclusions[specificSubType]}`
          }
          
          // BAGS sub-types
          else if (categoryKey === 'bag') {
            if (desc.includes('backpack')) specificSubType = 'backpack'
            else if (desc.includes('tote')) specificSubType = 'tote bag'
            else if (desc.includes('clutch')) specificSubType = 'clutch'
            else if (desc.includes('crossbody') || desc.includes('shoulder')) specificSubType = 'shoulder/crossbody bag'
            else if (desc.includes('handbag') || desc.includes('purse')) specificSubType = 'handbag'
            
            const bagsExclusions: Record<string, string> = {
              'backpack': 'totes, clutches, handbags, purses, shoulder bags (backpacks only)',
              'tote bag': 'backpacks, clutches, handbags, shoulder bags (large tote bags only)',
              'clutch': 'backpacks, totes, handbags, shoulder bags (small clutches only)',
              'shoulder/crossbody bag': 'backpacks, totes, clutches (shoulder/crossbody bags only)',
              'handbag': 'backpacks, totes, clutches (structured handbags only)'
            }
            if (specificSubType && bagsExclusions[specificSubType]) subTypeExclusion = `- ⚠️ CRITICAL: You are searching for ${specificSubType} ONLY. ❌ EXCLUDE: ${bagsExclusions[specificSubType]}`
          }
          
          // ACCESSORIES sub-types
          else if (categoryKey === 'accessory') {
            if (desc.includes('ring')) specificSubType = 'ring'
            else if (desc.includes('necklace')) specificSubType = 'necklace'
            else if (desc.includes('earring')) specificSubType = 'earrings'
            else if (desc.includes('bracelet')) specificSubType = 'bracelet'
            else if (desc.includes('watch')) specificSubType = 'watch'
            else if (desc.includes('hat') || desc.includes('cap') || desc.includes('beanie')) specificSubType = 'headwear'
            else if (desc.includes('belt')) specificSubType = 'belt'
            else if (desc.includes('scarf')) specificSubType = 'scarf'
            else if (desc.includes('sunglasses') || desc.includes('glasses')) specificSubType = 'eyewear'
            
            const accessoryExclusions: Record<string, string> = {
              'ring': 'necklaces, earrings, bracelets, watches, hats, belts, scarves, sunglasses, ALL BAGS, ALL CLOTHING',
              'necklace': 'rings, earrings, bracelets, watches, hats, belts, scarves, sunglasses, ALL BAGS, ALL CLOTHING',
              'earrings': 'rings, necklaces, bracelets, watches, hats, belts, scarves, sunglasses, ALL BAGS, ALL CLOTHING',
              'bracelet': 'rings, necklaces, earrings, watches, hats, belts, scarves, sunglasses, ALL BAGS, ALL CLOTHING',
              'watch': 'rings, necklaces, earrings, bracelets, hats, belts, scarves, sunglasses, ALL BAGS, ALL CLOTHING',
              'headwear': 'rings, necklaces, earrings, bracelets, watches, belts, scarves, sunglasses, ALL BAGS, ALL CLOTHING',
              'belt': 'rings, necklaces, earrings, bracelets, watches, hats, scarves, sunglasses, ALL BAGS, ALL CLOTHING',
              'scarf': 'rings, necklaces, earrings, bracelets, watches, hats, belts, sunglasses, ALL BAGS, ALL CLOTHING',
              'eyewear': 'rings, necklaces, earrings, bracelets, watches, hats, belts, scarves, ALL BAGS (purses, totes, backpacks, crossbody, shoulder bags, clutches, belt bags, fanny packs, handbags), ALL CLOTHING'
            }
            if (specificSubType && accessoryExclusions[specificSubType]) subTypeExclusion = `- ⚠️ CRITICAL: You are searching for ${specificSubType} ONLY. ❌ ABSOLUTELY EXCLUDE: ${accessoryExclusions[specificSubType]}. ONLY ${specificSubType.toUpperCase()}!`
          }
        }
        
        // PRE-FILTER: Remove wrong sub-types BEFORE sending to GPT (faster & better quality)
        const getExcludedKeywords = (subType: string | null): string[] => {
          if (!subType) return []
          
          const exclusionMap: Record<string, string[]> = {
            // ACCESSORIES (English + Korean for international sites)
            'ring': ['necklace', 'earring', 'bracelet', 'watch', 'belt', 'scarf', 'hat', 'cap', 'beanie', 'sunglasses', 'glasses',
                     '목걸이', '귀걸이', '브레이슬릿', '팔찌', '시계', '벨트', '스카프', '모자', '선글라스'],  // Korean
            'necklace': ['ring', 'earring', 'bracelet', 'watch', 'belt', 'scarf', 'hat', 'cap', 'beanie', 'sunglasses', 'glasses',
                         '반지', '귀걸이', '브레이슬릿', '팔찌', '시계', '벨트', '스카프', '모자', '선글라스'],
            'earrings': ['ring', 'necklace', 'bracelet', 'watch', 'belt', 'scarf', 'hat', 'cap', 'beanie', 'sunglasses', 'glasses',
                         '반지', '목걸이', '브레이슬릿', '팔찌', '시계', '벨트', '스카프', '모자', '선글라스'],
            'bracelet': ['ring', 'necklace', 'earring', 'watch', 'belt', 'scarf', 'hat', 'cap', 'beanie', 'sunglasses', 'glasses',
                         '반지', '목걸이', '귀걸이', '시계', '벨트', '스카프', '모자', '선글라스'],
            'watch': ['ring', 'necklace', 'earring', 'bracelet', 'belt', 'scarf', 'hat', 'cap', 'beanie', 'sunglasses', 'glasses',
                      '반지', '목걸이', '귀걸이', '브레이슬릿', '팔찌', '벨트', '스카프', '모자', '선글라스'],
            'headwear': ['ring', 'necklace', 'earring', 'bracelet', 'watch', 'belt', 'scarf', 'sunglasses', 'glasses',
                         '반지', '목걸이', '귀걸이', '브레이슬릿', '팔찌', '시계', '벨트', '스카프', '선글라스'],
            'belt': ['ring', 'necklace', 'earring', 'bracelet', 'watch', 'scarf', 'hat', 'cap', 'beanie', 'sunglasses', 'glasses',
                     '반지', '목걸이', '귀걸이', '브레이슬릿', '팔찌', '시계', '스카프', '모자', '선글라스'],
            'scarf': ['ring', 'necklace', 'earring', 'bracelet', 'watch', 'belt', 'hat', 'cap', 'beanie', 'sunglasses', 'glasses',
                      '반지', '목걸이', '귀걸이', '브레이슬릿', '팔찌', '시계', '벨트', '모자', '선글라스'],
            'eyewear': ['ring', 'necklace', 'earring', 'bracelet', 'watch', 'belt', 'scarf', 'hat', 'cap', 'beanie',
                        '반지', '목걸이', '귀걸이', '브레이슬릿', '팔찌', '시계', '벨트', '스카프', '모자'],
            
            // TOPS (English + Korean)
            'jacket/coat': ['shirt', 'blouse', 'sweater', 'pullover', 'hoodie', 'sweatshirt', 't-shirt', 'tank',
                            '셔츠', '블라우스', '스웨터', '니트', '후드티', '맨투맨', '티셔츠', '탱크톱'],
            'shirt/blouse': ['jacket', 'coat', 'sweater', 'pullover', 'hoodie', 'sweatshirt',
                             '재킷', '코트', '아우터', '스웨터', '니트', '후드티', '맨투맨'],
            'sweater/knit': ['jacket', 'coat', 'shirt', 'blouse', 'hoodie', 'sweatshirt',
                             '재킷', '코트', '아우터', '셔츠', '블라우스', '후드티', '맨투맨'],
            'hoodie/sweatshirt': ['jacket', 'coat', 'shirt', 'blouse', 'sweater', 'pullover', 'blazer',
                                  '재킷', '코트', '아우터', '셔츠', '블라우스', '스웨터', '니트', '블레이저'],
            'cardigan': ['jacket', 'coat', 'shirt', 'blouse', 'sweater', 'pullover', 'hoodie', 'sweatshirt', 'blazer',
                         '재킷', '코트', '셔츠', '블라우스', '스웨터', '니트', '후드티', '맨투맨', '블레이저'],
            'blazer': ['jacket', 'coat', 'shirt', 'blouse', 'sweater', 'pullover', 'hoodie', 'sweatshirt',
                       '재킷', '코트', '셔츠', '블라우스', '스웨터', '니트', '후드티', '맨투맨'],
            'vest': ['jacket', 'coat', 'shirt', 'blouse', 'sweater', 'pullover', 'hoodie', 'sweatshirt',
                     '재킷', '코트', '셔츠', '블라우스', '스웨터', '니트', '후드티', '맨투맨'],
            
            // BOTTOMS (English + Korean)
            'skirt': ['pant', 'trouser', 'jean', 'short', 'slack',
                      '바지', '팬츠', '청바지', '반바지', '슬랙스'],
            'shorts': ['pant', 'trouser', 'jean', 'skirt', 'slack',
                       '바지', '팬츠', '청바지', '치마', '슬랙스'],
            'jeans': ['skirt', 'short',
                      '치마', '반바지'],
            'pants/trousers': ['skirt', 'short',
                               '치마', '반바지'],
            
            // SHOES (English + Korean)
            'boots': ['sneaker', 'trainer', 'sandal', 'heel', 'pump', 'flat', 'loafer', 'oxford',
                      '스니커즈', '운동화', '샌들', '힐', '펌프스', '플랫', '로퍼', '구두'],
            'sneakers': ['boot', 'sandal', 'heel', 'pump', 'flat', 'loafer', 'oxford',
                         '부츠', '샌들', '힐', '펌프스', '플랫', '로퍼', '구두'],
            'sandals': ['boot', 'sneaker', 'trainer', 'heel', 'pump', 'flat', 'loafer', 'oxford',
                        '부츠', '스니커즈', '운동화', '힐', '펌프스', '플랫', '로퍼', '구두'],
            'heels/pumps': ['boot', 'sneaker', 'trainer', 'sandal', 'flat', 'loafer', 'oxford',
                            '부츠', '스니커즈', '운동화', '샌들', '플랫', '로퍼', '구두'],
            'flats': ['boot', 'sneaker', 'trainer', 'sandal', 'heel', 'pump', 'loafer', 'oxford',
                      '부츠', '스니커즈', '운동화', '샌들', '힐', '펌프스', '로퍼', '구두'],
            'loafers': ['boot', 'sneaker', 'trainer', 'sandal', 'heel', 'pump', 'flat', 'oxford',
                        '부츠', '스니커즈', '운동화', '샌들', '힐', '펌프스', '플랫', '구두'],
            'oxfords': ['boot', 'sneaker', 'trainer', 'sandal', 'heel', 'pump', 'flat', 'loafer',
                        '부츠', '스니커즈', '운동화', '샌들', '힐', '펌프스', '플랫', '로퍼'],
            
            // BAGS (English + Korean)
            'backpack': ['tote', 'clutch', 'handbag', 'purse', 'shoulder', 'crossbody',
                         '토트백', '클러치', '핸드백', '숄더백', '크로스백'],
            'tote bag': ['backpack', 'clutch', 'handbag', 'purse',
                         '백팩', '클러치', '핸드백'],
            'clutch': ['backpack', 'tote', 'handbag', 'purse', 'shoulder', 'crossbody',
                       '백팩', '토트백', '핸드백', '숄더백', '크로스백'],
            'shoulder/crossbody bag': ['backpack', 'tote', 'clutch',
                                       '백팩', '토트백', '클러치'],
            'handbag': ['backpack', 'tote', 'clutch',
                        '백팩', '토트백', '클러치']
          }
          
          return exclusionMap[subType] || []
        }
        
        const excludedKeywords = getExcludedKeywords(specificSubType)
        
        // SEPARATE full image results for "Exact Match" section
        // Full image search = searches with entire original photo → often finds exact product
        // Cropped image search = searches with just the item → finds similar alternatives
        console.log(`📊 Results breakdown:`)
        console.log(`   🎯 Full image search: ${fullImageResults.length} results (for exact matches)`)
        console.log(`   ✂️  Cropped+Text search: ${organicResults.length} results (for alternatives)`)
        
        // Use cropped results for category-based search
        const mergedResults: any[] = [...organicResults]
        
        // Filter merged results BEFORE GPT to save time and improve quality
        let filteredResults = mergedResults
        if (excludedKeywords.length > 0) {
          console.log(`🔍 Pre-filtering with sub-type: ${specificSubType}, excluding: ${excludedKeywords.join(', ')}`)
          
          filteredResults = mergedResults.filter((item: any) => {
            const title = item?.title?.toLowerCase() || ''
            const url = item?.link?.toLowerCase() || ''
            
            // Check title for excluded keywords
            if (title) {
              const hasExcludedInTitle = excludedKeywords.some(keyword => title.includes(keyword))
              if (hasExcludedInTitle) {
                console.log(`🚫 Pre-filtered (title): "${item.title?.substring(0, 50)}..."`)
                return false
              }
            }
            
            // Check URL path for excluded keywords (handles both English and Korean)
            const hasExcludedInUrl = excludedKeywords.some(keyword => {
              // For English keywords, check plural forms
              if (/^[a-zA-Z]+$/.test(keyword)) {
                const pluralKeyword = keyword.endsWith('s') ? keyword : keyword + 's'
                return url.includes(`/${keyword}/`) || 
                       url.includes(`/${pluralKeyword}/`) ||
                       url.includes(`-${keyword}-`) ||
                       url.includes(`-${pluralKeyword}-`)
              } else {
                // For non-English (Korean, etc.), check exact matches in URL
                return url.includes(keyword)
              }
            })
            
            if (hasExcludedInUrl) {
              console.log(`🚫 Pre-filtered (URL): ${item.link?.substring(0, 60)}...`)
              return false
            }
            
            return true
          })
          
          console.log(`✅ Pre-filter complete: ${mergedResults.length} → ${filteredResults.length} results (removed ${mergedResults.length - filteredResults.length} wrong sub-types)`)
        }
        
        // COLOR PRE-FILTERING (Remove wrong colors BEFORE GPT sees them!)
        let resultsForGPT = filteredResults
        
        if (primaryColor) {
          const colorBefore = resultsForGPT.length
          const colorLower = primaryColor.toLowerCase()
          
          // Define color rejection patterns based on primary color
          const colorRejectionPatterns: string[] = []
          const colorAcceptancePatterns: string[] = []
          
          if (colorLower === 'olive' || colorLower.includes('green')) {
            colorRejectionPatterns.push('neutral', 'beige', 'tan', 'mole', 'brown')
            colorAcceptancePatterns.push('olive', 'green', 'verde', 'khaki', 'kaki', 'olive green', 'dark green', 'army green', '올리브', '그린', '카키')
          } else if (colorLower === 'black') {
            colorRejectionPatterns.push('white', 'cream', 'ivory', 'beige', 'navy', 'grey', 'gray')
            colorAcceptancePatterns.push('black', 'noir', 'schwarz', 'negro', '블랙', '검정')
          } else if (colorLower === 'white' || colorLower === 'ivory' || colorLower === 'cream') {
            colorRejectionPatterns.push('black', 'navy', 'dark', 'grey', 'gray', 'brown')
            colorAcceptancePatterns.push('white', 'cream', 'ivory', 'off-white', 'ecru', '화이트', '흰색', '아이보리')
          } else if (colorLower === 'beige' || colorLower === 'tan') {
            colorRejectionPatterns.push('black', 'white', 'navy', 'brown', 'grey', 'gray')
            colorAcceptancePatterns.push('beige', 'tan', 'sand', 'camel', 'taupe', '베이지')
          } else if (colorLower === 'navy' || colorLower.includes('blue')) {
            colorRejectionPatterns.push('black', 'white', 'brown', 'grey', 'gray')
            colorAcceptancePatterns.push('navy', 'blue', 'indigo', 'azul', '네이비', '블루')
          }
          
          // Filter out results with wrong color in title
          resultsForGPT = resultsForGPT.filter((result: any) => {
            const title = (result.title || '').toLowerCase()
            
            // Check if title contains any acceptance patterns (green, olive, etc.)
            const hasAcceptedColor = colorAcceptancePatterns.some(pattern => title.includes(pattern.toLowerCase()))
            
            // Check if title contains any rejection patterns (neutrals, beige, etc.)
            const hasRejectedColor = colorRejectionPatterns.some(pattern => title.includes(pattern.toLowerCase()))
            
            // Keep if: (has accepted color) OR (no color mentioned at all)
            // Reject if: has rejected color AND doesn't have accepted color
            if (hasRejectedColor && !hasAcceptedColor) {
              console.log(`   ❌ COLOR FILTER: Rejected "${result.title?.substring(0, 60)}..." (contains rejected color, not ${primaryColor})`)
              return false // REJECT
            }
            
            return true // KEEP
          })
          
          console.log(`🎨 Color pre-filter (text): ${colorBefore} → ${resultsForGPT.length} results (removed ${colorBefore - resultsForGPT.length} wrong colors for "${primaryColor}")`)
        }
        
        // PRE-FILTER: Remove blocked domains (news sites, social media) BEFORE sending to GPT
        const blockedDomainsPreFilter = [
          // Social media
          'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'pinterest.com', 'pin.it',
          'facebook.com', 'fb.com', 'twitter.com', 'x.com', 'reddit.com', 'tumblr.com',
          'snapchat.com', 'threads.net', 'threads.com', 'weibo.com',
          // News & entertainment sites
          'newsen.com', 'm.newsen.com', 'www.newsen.com',
          'xportsnews.com', 'dispatch.co.kr', 'sportsseoul.com', 'sportalkorea.com',
          'osen.co.kr', 'm.osen.co.kr', 'entertain.naver.com', 'sports.naver.com',
          'starnewskorea.com', 'tenasia.co.kr', 'mydaily.co.kr',
          'news.nate.com', 'news.zum.com', 'news.chosun.com', 'news.joins.com',
          // Magazines
          'vogue.com', 'elle.com', 'elle.co.kr', 'harpersbazaar.com', 'gq.com'
        ]
        
        const beforeBlockedFilter = resultsForGPT.length
        resultsForGPT = resultsForGPT.filter((result: any) => {
          const linkLower = (result.link || '').toLowerCase()
          const isBlocked = blockedDomainsPreFilter.some(domain => linkLower.includes(domain))
          if (isBlocked) {
            console.log(`🚫 PRE-FILTER: Blocked news/social site: ${result.link?.substring(0, 60)}...`)
            return false
          }
          return true
        })
        
        if (beforeBlockedFilter > resultsForGPT.length) {
          console.log(`✅ PRE-FILTER complete: ${beforeBlockedFilter} → ${resultsForGPT.length} results (removed ${beforeBlockedFilter - resultsForGPT.length} news/social sites)`)
        }
        
        // VISUAL VALIDATION: Analyze thumbnails with Gemini Flash
        if (primaryColor && resultsForGPT.length > 0) {
          console.log(`\n🖼️  Starting visual color validation with Gemini 2.5 Flash Image...`)
          console.log(`   📊 Analyzing ${Math.min(30, resultsForGPT.length)} thumbnails in batches of 5 with rate limiting`)
          const visualBefore = resultsForGPT.length
          const startVisual = Date.now()
          
          try {
            const geminiClient = getGeminiClient()
            
            // Batch analyze thumbnails with rate limiting (Free tier: 15 RPM for gemini-2.5-flash-image)
            const resultsToAnalyze = resultsForGPT.slice(0, 30) // Reduced to 30 to stay under rate limits
            const batchSize = 5 // 5 at a time in parallel
            const delayBetweenBatches = 2000 // 2s delay between batches to avoid rate limits
            const visuallyValidResults: any[] = []
            
            for (let i = 0; i < resultsToAnalyze.length; i += batchSize) {
              const batch = resultsToAnalyze.slice(i, i + batchSize)
              const batchNum = Math.floor(i / batchSize) + 1
              const totalBatches = Math.ceil(resultsToAnalyze.length / batchSize)
              
              console.log(`\n   📦 Batch ${batchNum}/${totalBatches} (${batch.length} thumbnails)`)
              
              // Add delay between batches to respect rate limits (except first batch)
              if (i > 0) {
                console.log(`   ⏱️  Waiting 2s to respect rate limits...`)
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
              }
              
              // Analyze batch in parallel
              const batchPromises = batch.map(async (result: any) => {
                try {
                  if (!result.thumbnailUrl) return null
                  
                  // Fetch and encode the thumbnail image
                  let imageData: string
                  try {
                    const response = await fetch(result.thumbnailUrl)
                    const arrayBuffer = await response.arrayBuffer()
                    imageData = Buffer.from(arrayBuffer).toString('base64')
                  } catch (fetchError) {
                    console.log(`   ⚠️  Could not fetch thumbnail, keeping result: ${result.title?.substring(0, 40)}`)
                    return result // Keep if we can't fetch thumbnail
                  }
                  
                  // Retry logic for rate limit errors
                  let response
                  let retries = 0
                  const maxRetries = 2
                  
                  while (retries <= maxRetries) {
                    try {
                      response = await geminiClient.models.generateContent({
                        model: 'gemini-2.5-flash-image', // Higher quota than 2.0-flash-exp
                    contents: [{
                      role: 'user',
                      parts: [
                        {
                          inlineData: {
                            mimeType: 'image/jpeg',
                            data: imageData
                          }
                        },
                        {
                          text: `Is this product's primary color ${primaryColor.toUpperCase()}?

Answer ONLY "MATCH" or "DIFFERENT".

${primaryColor.toLowerCase() === 'olive' || primaryColor.toLowerCase().includes('green') ? 'MATCH = olive/green shades. DIFFERENT = beige/tan/brown/neutral.' : ''}
${primaryColor.toLowerCase() === 'black' ? 'MATCH = black. DIFFERENT = navy/grey/dark blue.' : ''}
${primaryColor.toLowerCase() === 'white' || primaryColor.toLowerCase() === 'cream' ? 'MATCH = white/cream/ivory. DIFFERENT = beige/grey/black.' : ''}

Answer:`
                        }
                      ]
                    }],
                        config: {
                          maxOutputTokens: 10,
                          temperature: 0.1
                        }
                      })
                      break // Success, exit retry loop
                    } catch (retryErr: any) {
                      retries++
                      if (retryErr.message?.includes('429') || retryErr.message?.includes('RESOURCE_EXHAUSTED')) {
                        if (retries <= maxRetries) {
                          const waitTime = Math.pow(2, retries) * 1000 // Exponential backoff: 2s, 4s
                          console.log(`   ⏳ Rate limit hit, waiting ${waitTime/1000}s before retry ${retries}/${maxRetries}...`)
                          await new Promise(resolve => setTimeout(resolve, waitTime))
                        } else {
                          throw retryErr // Max retries exceeded
                        }
                      } else {
                        throw retryErr // Non-rate-limit error
                      }
                    }
                  }
                  
                  if (!response) {
                    console.log(`   ⚠️  Max retries exceeded, keeping result: ${result.title?.substring(0, 40)}`)
                    return result
                  }
                  
                  const answer = (response.text?.trim() || '').toUpperCase()
                  const isMatch = answer.includes('MATCH')
                  
                  console.log(`   ${isMatch ? '✅' : '❌'} Visual: "${result.title?.substring(0, 50)}..." → ${answer}`)
                  
                  return isMatch ? result : null
                } catch (err) {
                  console.error(`   ⚠️  Visual analysis failed for thumbnail, keeping result:`, err)
                  return result // Keep if analysis fails
                }
              })
              
              const batchResults = await Promise.all(batchPromises)
              visuallyValidResults.push(...batchResults.filter(r => r !== null))
            }
            
            // Add remaining results that weren't analyzed (top 40 already filtered)
            if (resultsForGPT.length > resultsToAnalyze.length) {
              visuallyValidResults.push(...resultsForGPT.slice(resultsToAnalyze.length))
            }
            
            const visualDuration = ((Date.now() - startVisual) / 1000).toFixed(2)
            console.log(`\n🖼️  Visual validation complete in ${visualDuration}s`)
            console.log(`   ${visualBefore} → ${visuallyValidResults.length} results (removed ${visualBefore - visuallyValidResults.length} wrong colors visually)`)
            
            resultsForGPT = visuallyValidResults
          } catch (error) {
            console.error('❌ Visual validation failed, continuing with text-filtered results:', error)
            // Continue with text-filtered results if visual analysis fails
          }
        }
        
        // Extract brand names from titles (strong signal for exact matches!)
        const brandFrequency: Record<string, { count: number; examples: string[] }> = {}
        
        resultsForGPT.forEach((result: any) => {
          const title = result.title || ''
          
          // Extract potential brand names (capitalized words, Korean brand names, etc.)
          // Common patterns:
          // - "BAGGU Duck Bag" → "BAGGU"
          // - "Nike Air Force 1" → "Nike"
          // - "Zara Wool Coat" → "Zara"
          // - "[브랜드명] Product Name" (Korean bracket pattern)
          
          const brandMatches: string[] = []
          
          // Pattern 1: Korean brackets [브랜드]
          const koreanBracketMatch = title.match(/\[([^\]]+)\]/)
          if (koreanBracketMatch) {
            brandMatches.push(koreanBracketMatch[1].trim())
          }
          
          // Pattern 2: Capitalized words at the start (before hyphens or common separators)
          const capitalizedMatch = title.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/)
          if (capitalizedMatch) {
            brandMatches.push(capitalizedMatch[1].trim())
          }
          
          // Pattern 3: All-caps brand names (e.g., "BAGGU", "NIKE")
          const allCapsMatches = title.match(/\b([A-Z]{3,})\b/g)
          if (allCapsMatches) {
            brandMatches.push(...allCapsMatches)
          }
          
          // Count each brand
          brandMatches.forEach(brand => {
            if (!brandFrequency[brand]) {
              brandFrequency[brand] = { count: 0, examples: [] }
            }
            brandFrequency[brand].count++
            if (brandFrequency[brand].examples.length < 2) {
              brandFrequency[brand].examples.push(title.substring(0, 60))
            }
          })
        })
        
        // Sort by frequency and show top repeated brands
        const topRepeatedBrands = Object.entries(brandFrequency)
          .filter(([_, data]) => data.count >= 2) // Only show brands appearing 2+ times
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([brand, data]) => `"${brand}" (×${data.count})`)
          .join(', ')
        
        // Log brand name frequency
        if (topRepeatedBrands) {
          console.log(`\n🔥 REPEATED BRAND NAMES in titles (high confidence signal):`)
          console.log(`   ${topRepeatedBrands}`)
        }
        
        // Log cropped image results being sent to GPT (show more for debugging)
        console.log(`\n📦 CROPPED IMAGE RESULTS sent to GPT (${resultsForGPT.length} total items):`)
        console.log('─'.repeat(80))
        resultsForGPT.slice(0, 30).forEach((r: any, i: number) => {
          console.log(`   ${i + 1}. ${r.source || 'Unknown'}: ${r.title?.substring(0, 70)}...`)
          console.log(`      🔗 ${r.link?.substring(0, 80)}...`)
        })
        if (resultsForGPT.length > 30) {
          console.log(`   ... and ${resultsForGPT.length - 30} more items`)
        }
        console.log('─'.repeat(80) + '\n')
        
        const prompt = `You are analyzing aggregated image search results from multiple runs for ${categoryLabels[categoryKey]}.

${topRepeatedBrands ? `
🔥🔥🔥 **BRAND NAME FREQUENCY - HIGH CONFIDENCE SIGNALS** 🔥🔥🔥
Brand names appearing multiple times in titles (sorted by frequency): ${topRepeatedBrands}

**WHY THIS MATTERS**: When the same BRAND NAME appears in 3+ product titles, it's Google's algorithm saying "THIS IS THE EXACT BRAND!"
→ Example: If "BAGGU" (×4) appears above, products with "BAGGU" in the title are almost certainly the exact match!
→ **STRONGLY PRIORITIZE these repeated brand names in your selection!**
→ Note: This is brand name frequency from titles, not domain names (since sites like Musinsa carry multiple brands)
` : ''}

${characterName ? `
🎭🎭🎭 **CRITICAL PRIORITY #1: CHARACTER/GRAPHIC IS "${characterName.toUpperCase()}"** 🎭🎭🎭
- This is a GRAPHIC/CHARACTER item - the character is THE MOST IMPORTANT feature!
- You MUST find products featuring "${characterName.toUpperCase()}"!
- ❌ ABSOLUTELY REJECT items with DIFFERENT characters (e.g., if looking for "Donald Duck", reject "Winnie the Pooh" or "Mickey Mouse")
- ❌ DO NOT mix up characters just because they're similar style (all Disney, all kids', etc.)
- The character name MUST match or you MUST reject the product!
- Korean mappings: 푸 = Pooh, 미키 = Mickey, 미니 = Minnie, 도널드 = Donald Duck
` : ''}

${primaryColor ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨🚨🚨 CRITICAL #1 PRIORITY: COLOR MUST BE ${primaryColor.toUpperCase()} 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**MANDATORY COLOR MATCHING:**
- Look at the product title - does it mention ${primaryColor.toUpperCase()} or a similar color word?
- ❌ ABSOLUTELY REJECT if title says a DIFFERENT color (see rejection list below)
- ✅ ONLY SELECT products whose titles match the color "${primaryColor.toUpperCase()}"

**COLOR REJECTION LIST FOR ${primaryColor.toUpperCase()}:**
${primaryColor.toLowerCase() === 'olive' || primaryColor.toLowerCase().includes('green') ? `- ❌ REJECT: "Neutrals", "Beige", "Tan", "Mole", "Brown", "Khaki" (these are NOT olive/green!)
- ✅ ACCEPT: "Olive", "Green", "Dark Green", "Khaki Green", "Army Green"` : ''}
${primaryColor.toLowerCase() === 'black' ? `- ❌ REJECT: "White", "Cream", "Ivory", "Beige", "Navy", "Grey", "Dark Blue"
- ✅ ACCEPT: "Black", "Jet Black", "Charcoal Black"` : ''}
${primaryColor.toLowerCase() === 'white' || primaryColor.toLowerCase() === 'ivory' || primaryColor.toLowerCase() === 'cream' ? `- ❌ REJECT: "Black", "Navy", "Dark", "Grey", "Brown"  
- ✅ ACCEPT: "White", "Cream", "Ivory", "Off-White", "Ecru"` : ''}
${primaryColor.toLowerCase() === 'beige' || primaryColor.toLowerCase() === 'tan' ? `- ❌ REJECT: "Black", "White", "Navy", "Brown", "Grey"
- ✅ ACCEPT: "Beige", "Tan", "Sand", "Camel", "Taupe"` : ''}
${primaryColor.toLowerCase() === 'navy' || primaryColor.toLowerCase().includes('blue') ? `- ❌ REJECT: "Black", "White", "Brown", "Grey" (unless they also say "Blue")
- ✅ ACCEPT: "Navy", "Blue", "Dark Blue", "Indigo"` : ''}

**WHY THIS MATTERS:** "Olive Green" pants and "Neutral Beige" pants look VERY different!
Don't confuse them just because they have similar silhouettes!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

🎯 **IMPORTANT: Results are ordered by quality - TOP results are from full-image search (most accurate for iconic items)**
- First ${fullImageResults.length} results are from full image search (recognizes context, celebrity outfits, exact matches)
- Remaining results are from cropped image search (visual similarity) + text-based search (keyword matching)
- STRONGLY PREFER selecting from the TOP results - they're higher quality matches

The original cropped image shows: ${searchTerms.join(', ')}
${itemDescription ? `\n🎯 **SPECIFIC ITEM DESCRIPTION: "${itemDescription}"**\n${primaryColor ? `   🎨 **PRIMARY COLOR: ${primaryColor.toUpperCase()} - MATCH THIS COLOR!**` : ''}\nYou SHOULD find products that match THIS DESCRIPTION, especially the COLOR.` : ''}

⚠️ CATEGORY GUIDANCE (FLEXIBLE FOR VISUAL MATCHES):
- General category: ${categoryLabels[categoryKey]}
- **HOWEVER**: Visual similarity is MORE important than exact category match
- If a "fur coat" looks like the item but category says "sweater", INCLUDE IT
- The first ${fullImageResults.length} results are from full image search - these are likely EXACT or very close matches
${subTypeExclusion ? subTypeExclusion : ''}
- ${categoryKey === 'tops' && !specificSubType ? '❌ ABSOLUTELY REJECT: Any title mentioning "jeans", "pants", "trousers", "shorts", "skirt", "dress", "바지", "청바지", "반바지", "치마"' : ''}
- ${categoryKey === 'bottoms' && !specificSubType ? '❌ ABSOLUTELY REJECT: Any title mentioning "shirt", "blouse", "jacket", "hoodie", "sweater", "coat", "blazer", "top", "modal-blend", "tie-front", "셔츠", "블라우스", "재킷", "후드", "코트", "상의", "티셔츠", "아우터"' : ''}
- ${categoryKey === 'shoes' && !specificSubType ? '❌ ABSOLUTELY REJECT: clothing items, bags, accessories' : ''}
- ${categoryKey === 'bag' && !specificSubType ? '❌ ABSOLUTELY REJECT: clothing items (sweaters, cardigans, jackets, shirts, coats, tops), shoes, accessories (except bags). ONLY BAGS/PURSES/BACKPACKS!' : ''}
- ${categoryKey === 'accessory' && !specificSubType ? '❌ ABSOLUTELY REJECT: ALL clothing, ALL shoes, ALL bags (purses, backpacks, totes, crossbody, belt bags, fanny packs)' : ''}
- ${categoryKey === 'accessory' && specificSubType === 'eyewear' ? '🕶️ SUNGLASSES/EYEWEAR ONLY! ❌ REJECT: ALL bags, belts, wallets, clothing, shoes. ONLY glasses/sunglasses!' : ''}
- ${categoryKey === 'dress' ? '❌ ABSOLUTELY REJECT: Any title mentioning "pants", "jeans", "shorts", "shirt", "jacket", "바지", "셔츠", "재킷"' : ''}

CRITICAL SELECTION RULES (in order of priority):
${topRepeatedBrands ? `
🔥 **BRAND FREQUENCY - STRONG SIGNAL (but not mandatory)**: ${topRepeatedBrands}
   → If a brand appears 4+ times AND visually matches: STRONGLY PREFER it!
   → If a brand appears 3+ times AND visually matches: Consider it highly
   → If a brand appears 2+ times: Give it priority when quality/visual match is similar
   → **BUT**: Use your judgment! Visual similarity + quality > raw frequency
   → Example: High-end brand (Berluti, Bottega Veneta) with good match > generic brand appearing 4× with poor match
` : ''}
${characterName ? `1. 🎭 **CHARACTER/GRAPHIC MATCH**: Item MUST feature "${characterName.toUpperCase()}"! Reject different characters!` : ''}
${primaryColor ? `2. 🎨 **COLOR MATCH**: Item MUST be ${primaryColor.toUpperCase()} colored! Reject inverted colors!` : ''}
3. 🇰🇷 **MANDATORY: AT LEAST 2 KOREAN SITES**: Your final selection MUST include minimum 2 Korean e-commerce sites!
4. CATEGORY MATCH: Must be correct garment type (${categorySearchTerms[categoryKey]?.join(' OR ')})
5. VISUAL MATCH: Look for similar style, color, material
4. Accept ANY e-commerce/product website (Korean, international, boutique)
5. Accept: G마켓, 11번가, Coupang, Musinsa, Amazon, Zara, H&M, Nordstrom, Uniqlo, YesStyle, Etsy, Depop
7. 🚫 REJECT these sites (NOT product pages): Instagram, TikTok, YouTube, Pinterest, Facebook, Twitter/X, Reddit, Google Images, image CDNs, blogs, news sites, wikis, non-product pages
8. 🚫 REJECT non-product pages: URLs ending with /reviews, /questions, /qa, /ratings (these are NOT product detail pages)
9. If you cannot find 3 VALID PRODUCT LINKS, return fewer than 3. NEVER include non-product sites just to fill the quota.

SELECTION PROCESS:
- These results are aggregated from 3 visual image runs + 1 text-based search + 3 full image runs for maximum coverage
- Each result has: "link", "title", "thumbnail" fields
- **CRITICAL: You MUST read and validate the "title" field for EVERY result before selecting it**
- The "title" describes what the link actually shows - use it to verify accuracy
- Example for bottoms: "blue shorts" ✅, "blue hoodie" ❌ (wrong category)
- Example for tops: "red sweatshirt" ✅, "red skirt" ❌ (wrong category)
- Prefer actual product pages over homepages, category pages, or general listings

🔥 **BRAND NAME FREQUENCY = STRONG SIGNAL (use with judgment)**:
- If a brand appears 4+ times in titles: This is a strong signal - check if it visually matches!
- If a brand appears 3+ times: Give it high priority IF the visual match is good
- If a brand appears 2+ times: Prefer it over single appearances when visual quality is similar
- **HOWEVER**: Don't blindly follow frequency! A high-end brand (Berluti, Bottega Veneta, Loewe) with a perfect visual match is better than a generic brand appearing 4× with poor match
- Use brand frequency as ONE factor alongside: visual similarity, product quality, color match, style match
- Note: Look at BRAND NAME in titles, not just domain (Musinsa/Amazon carry many brands)

TITLE VALIDATION RULES (STRICT COLOR MATCHING):
1. ✅ READ the "title" field carefully - it tells you what the product actually is
${primaryColor ? `2. 🚨 **COLOR VALIDATION (MANDATORY)**: Check if title mentions a color word
   - If title says "${primaryColor.toUpperCase()}" or similar → ✅ GOOD!
   - If title says a DIFFERENT color → ❌ REJECT IMMEDIATELY!
   - Example: Looking for "Olive Green"? "Neutrals", "Beige", "Mole" = WRONG COLOR, REJECT!
   - Don't assume "Neutrals" = "Olive" just because they're earthy tones. They're DIFFERENT!` : ''}
3. ✅ FLEXIBLE: Allow category variations within same body part (sweater/jacket/coat all OK for upper body)
${itemDescription ? `4. 🎯 **MATCH DESCRIPTION: "${itemDescription}"**
   - 🎨 **COLOR IS MOST IMPORTANT** - if description says "olive green", ONLY select "olive"/"green" items!
   - Don't mix up colors (olive→beige is WRONG, green→neutrals is WRONG)
   - Style/silhouette should match (tapered, cuffed, etc.)
   - For Korean text: 검정=black, 흰색/아이보리=white/ivory, 베이지=beige, 올리브=olive, 그린=green` : ''}
5. ⚠️ ONLY REJECT if clearly wrong body part:
   ${categoryKey === 'tops' ? '**REJECT ONLY: pants/jeans/shorts/skirts/leggings (lower body items)**' : ''}
   ${categoryKey === 'bottoms' ? '**REJECT ONLY: if title suggests it\'s NOT worn on lower body**' : ''}
6. ❌ REJECT if title is generic ("Shop now", "Homepage", "Category", "Collection")
7. ✅ ACCEPT style variations - but NEVER compromise on color!

Matching criteria (${characterName ? 'CHARACTER FIRST, then color' : 'COLOR + VISUAL SIMILARITY FIRST'}):
${topRepeatedBrands ? `0. 🔥 **BRAND FREQUENCY (strong signal)**: Repeated brands detected: ${topRepeatedBrands}
   - If these brands also have good visual/color match → Give them high priority!
   - But don't select them if they don't match the style/color/description
   - Use as a tie-breaker when multiple products look equally good` : ''}
${characterName ? `${topRepeatedBrands ? '1' : '0'}. 🎭 **#${topRepeatedBrands ? '1' : '0'} PRIORITY - CHARACTER/GRAPHIC MATCH**: Item MUST feature "${characterName.toUpperCase()}"!
   - Donald Duck mint green → find DONALD DUCK items (NOT Winnie the Pooh or Mickey!)
   - Winnie the Pooh yellow → find WINNIE THE POOH items (NOT Donald or Minnie!)
   - Don't mix up characters - this is a critical error!
   - Korean names: 푸 = Pooh, 미키 = Mickey, 미니 = Minnie, 도널드 = Donald Duck
${topRepeatedBrands ? '2' : '1'}. 🎨 **#${topRepeatedBrands ? '2' : '1'} PRIORITY - COLOR MATCH**: If item is ${primaryColor?.toUpperCase() || 'a specific color'}, find matching colors!` : `${topRepeatedBrands ? '1' : '0'}. 🎨 **#${topRepeatedBrands ? '1' : '0'} PRIORITY - COLOR MATCH**: If item is BLACK, find BLACK items. If WHITE/CREAM, find LIGHT items!`}
   - BLACK sweater with white bows → find BLACK sweaters (NOT beige/cream ones!)
   - WHITE/CREAM sweater with black bows → find WHITE/CREAM sweaters (NOT black ones!)
   - Don't return inverted colors - this is a critical error!
${primaryColor ? `   
   ━━━ COLOR REJECTION RULES ━━━
   ${primaryColor.toLowerCase() === 'olive' || primaryColor.toLowerCase() === 'green' ? '❌ REJECT if title says: "Neutrals", "Beige", "Tan", "Mole", "Brown", "Khaki" (unless it also says "Olive" or "Green")' : ''}
   ${primaryColor.toLowerCase() === 'black' ? '❌ REJECT if title says: "White", "Cream", "Beige", "Navy", "Grey" (NOT black)' : ''}
   ${primaryColor.toLowerCase() === 'white' || primaryColor.toLowerCase() === 'ivory' || primaryColor.toLowerCase() === 'cream' ? '❌ REJECT if title says: "Black", "Navy", "Grey", "Dark" (NOT white/light)' : ''}
   ${primaryColor.toLowerCase() === 'beige' || primaryColor.toLowerCase() === 'tan' ? '❌ REJECT if title says: "Black", "White", "Navy", "Brown", "Grey" (NOT beige)' : ''}
   ` : ''}
${characterName ? '3' : '2'}. ✅ Visual similarity (Google Lens found these based on IMAGE, trust it!)
${characterName ? '4' : '3'}. ✅ Style/material match (cable knit, bow details, ruffle hem, etc.)
${itemDescription ? `${characterName ? '5' : '4'}. 🎯 MATCH DESCRIPTION: "${itemDescription}" - especially the ${characterName ? 'CHARACTER and COLOR' : 'COLOR'} words!` : ''}
${characterName ? '6' : '5'}. ✅ FLEXIBLE: Category can vary within same general type (sweater, jacket, coat all = upper body wear)
${characterName ? '7' : '6'}. ✅ MUST: Link goes to a product detail page (not category/homepage)
${characterName ? '8' : '7'}. 🇰🇷 PREFER: Korean sites often have exact character + color matches!

**IMPORTANT: Return your BEST 3-5 HIGH-QUALITY matches ONLY. Quality over quantity.**

🌟 **SELECTION STRATEGY:**
- 🔥 **STEP 1 - BRAND FREQUENCY (strong signal, use with judgment)**:
  ${topRepeatedBrands ? `* Consider these repeated brands: ${topRepeatedBrands}
  * Check if products from these brands have good visual/color match
  * If they DO match visually, PREFER them (high confidence)!
  * If they DON'T match well, trust your visual judgment over frequency
  * Example: Berluti bag with perfect match > Louis Vuitton (×4) if LV products don't match style` : '* No repeated brands detected - proceed with visual matching'}
- **STEP 2**: Review the first ${fullImageResults.length} results (full image search)
  * Full image search often finds EXACT matches or designer pieces
  * High-end brands with good visual match are excellent selections
- **STEP 3**: Balance: repeated brands (if good match) + visual similarity + product quality
- **STEP 4**: Include 3-5 best matches considering ALL factors
- Return [] ONLY if literally no results are for the correct body part

🇰🇷 **KOREAN SITE REQUIREMENT** (search was done with gl=kr, hl=ko):
- ⚠️ **MANDATORY**: You MUST select AT LEAST 2 KOREAN SITES in your results!
- **Korean e-commerce sites**: gmarket.co.kr, 11st.co.kr, coupang.com, musinsa.com, zigzag.kr, wconcept.co.kr, 29cm.co.kr, ssg.com, elandmall.co.kr
- Korean sites often have EXACT matches with better prices and faster shipping in Korea
- **Required selection pattern**: 
  * If you find 3+ Korean matches → Select 3 Korean sites (all Korean)
  * If you find 2 Korean matches → Select 2 Korean + 1 international alternative
  * If you find only 1 Korean match → Select 1 Korean + look harder for a 2nd Korean + 1 international
  * If you find 0 Korean matches → Return international sites BUT LOG THIS AS UNUSUAL
- International alternatives (use ONLY if you have 2+ Korean already): Amazon, Zara, H&M, ASOS, Uniqlo, Mango
- ❌ NEVER select: Etsy, Depop, Poshmark, Gap, Old Navy (wrong market, often sold out)

Search results (scan all ${resultsForGPT.length} for best matches):
${JSON.stringify(resultsForGPT, null, 2)}

**VALIDATION PROCESS (COLOR-FIRST, THEN VISUAL):**
For EACH result you consider:
1. 📖 READ the "title" field first
${primaryColor ? `2. 🎨 **COLOR CHECK (MANDATORY)**: Does the title mention "${primaryColor.toUpperCase()}" or a matching color?
   - ✅ If YES → Proceed to next step
   - ❌ If NO (title says different color) → REJECT and move to next result
   - Example: Looking for "Olive Green"? Title says "Neutrals" → REJECT!` : '2. 🚫 CHECK THE URL: Does it end with /reviews, /questions, /qa? → SKIP IMMEDIATELY (not a product page)'}
3. 🚫 CHECK THE URL: Does it end with /reviews, /questions, /qa? → SKIP IMMEDIATELY (not a product page)
4. ⭐ **PRIORITY**: First ${fullImageResults.length} results are from FULL IMAGE SEARCH - strongly prefer these!
   - Full image search recognizes complete context (celebrity outfits, iconic pieces, exact scenes)
   - If any of the top results look like quality matches, SELECT THEM FIRST
   - Example: If category is "sweater" but top result shows luxury fur coat that matches the image, INCLUDE IT
4. ✅ Visual similarity - Google Lens found these because they LOOK similar to the user's image
5. ✅ CHECK: Does it seem like similar style/vibe/quality? (luxury vs casual, designer vs fast fashion)
6. ✅ PREFER: Similar or complementary colors (but allow variations)
7. ✅ FLEXIBLE: Category labels can vary - sweater/jacket/coat/cardigan are all upper body outerwear
   ${categoryKey === 'tops' ? '⚠️ ONLY REJECT: pants/jeans/shorts/skirts (clearly wrong body part)' : ''}
   ${categoryKey === 'bottoms' ? '⚠️ ONLY REJECT: if it\'s clearly NOT lower body wear' : ''}
8. ✅ CHECK: Is it a specific product (not "Shop", "Category", "Homepage")?

Find the TOP 3-5 BEST AVAILABLE MATCHES. Prioritize IN THIS ORDER:
1. **STRONGLY PREFER the first ${fullImageResults.length} results** (full image search = most accurate)
2. Visual similarity (Google Lens already filtered by appearance!)
3. Similar style/vibe/quality level (luxury vs fast fashion)
4. Similar color or aesthetic
5. Product variety (different retailers when possible)
6. Accessibility (prefer major retailers)

✅ IMPORTANT: Trust visual search results, especially FULL IMAGE results!
- **TOP ${fullImageResults.length} results are from full image search - PRIORITIZE these!**
- Full image search found these because the ENTIRE SCENE looks like the photo
- These often contain EXACT MATCHES or iconic items (celebrity outfits, designer pieces)
- Don't reject top results just because category label differs slightly
- ${categoryKey === 'tops' ? 'For tops: sweater, jacket, coat, blazer, cardigan, fur coat are ALL valid upper body wear' : ''}
- ${categoryKey === 'bottoms' ? 'For bottoms: pants, jeans, shorts, skirts are all valid lower body wear' : ''}
- Focus on: Does this product have a similar LOOK and FEEL?
- A luxury fur coat might be tagged as "sweater", "jacket", or "cardigan" - ALL VALID
- Return [] ONLY if results are completely unrelated (e.g., shoes when looking for tops)

🚨 **FINAL VALIDATION - BEFORE RETURNING YOUR RESULTS:**
1. Count Korean sites in your selection: coupang.com, gmarket.co.kr, 11st.co.kr, musinsa.com, zigzag.kr, elandmall.co.kr, wconcept.co.kr, 29cm.co.kr, ssg.com
2. If you have fewer than 2 Korean sites → GO BACK and find more Korean options from the search results
3. Only include international sites (Zara, Gap, Etsy, Amazon, etc.) AFTER you have 2+ Korean sites
4. **REQUIRED PATTERN**: [Korean site 1, Korean site 2, Korean site 3] OR [Korean site 1, Korean site 2, International site]

Return JSON: {"${resultKey}": ["url1", "url2", "url3"]} (3-5 links, minimum 2 MUST be Korean sites) or {"${resultKey}": []} ONLY if zero valid products found.`

        const openai = getOpenAIClient()
        const gptStart = Date.now()
        
        // Use GPT-4 Turbo for filtering (fast & reliable!)
        const completion = await openai.chat.completions.create({
          model: 'gpt-4-turbo-2024-04-09',
          messages: [
            {
              role: 'system',
              content: 'You extract product links from search results. Return only valid JSON without any markdown formatting.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        })
        
        const gptTime = (Date.now() - gptStart) / 1000
        timingData.gpt4_turbo_total_api_time += gptTime
        timingData.gpt4_turbo_count += 1
        console.log(`   ⏱️  GPT-4 Turbo filtering: ${gptTime.toFixed(2)}s`)

        // Parse response from GPT-4 Turbo
        const responseText = completion.choices[0]?.message?.content || '{}'
        
        if (!responseText || responseText === '{}') {
          console.error(`❌ No response from GPT-4 Turbo for ${resultKey}`)
        }

        console.log(`📄 GPT-4 Turbo response for ${resultKey}:`, responseText.substring(0, 200))
        
        // Store GPT reasoning/response for this category
        gptReasoningData[resultKey] = {
          itemDescription,
          searchTerms,
          selectedLinks: [],
          timestamp: new Date().toISOString(),
          candidateCount: resultsForGPT.length,
          croppedImageResults: resultsForGPT.slice(0, 50), // Store first 50 cropped results for debugging
          fullImageResults: fullImageResults.slice(0, 50) // Store first 50 full image results for debugging
        }
        
        // Parse response - improved JSON extraction
        let result: any
        try {
          // Remove markdown code blocks and trim
          let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          
          // Extract ONLY the JSON object (first { to last matching })
          const firstBrace = cleaned.indexOf('{')
          if (firstBrace === -1) {
            throw new Error('No JSON object found in response')
          }
          
          // Find the matching closing brace
          let braceCount = 0
          let lastBrace = firstBrace
          for (let i = firstBrace; i < cleaned.length; i++) {
            if (cleaned[i] === '{') braceCount++
            if (cleaned[i] === '}') {
              braceCount--
              if (braceCount === 0) {
                lastBrace = i
                break
              }
            }
          }
          
          const jsonStr = cleaned.substring(firstBrace, lastBrace + 1)
          result = JSON.parse(jsonStr)
          
        } catch (parseError: any) {
          console.error(`❌ JSON parse error for ${resultKey}:`, parseError.message)
          console.error(`   Raw response:`, responseText.substring(0, 500))
          result = {}
        }
        
        // Handle both single string and array responses
        let links = result[resultKey]
        if (!Array.isArray(links)) {
          // If GPT returns a single link, convert to array
          links = links && typeof links === 'string' && links.startsWith('http') ? [links] : []
        }
        
        // Blocked domains - social media and non-product sites
        const blockedDomains = [
          // Social media platforms
          'instagram.com', 'www.instagram.com', 'ig.me', 'instagr.am',
          'tiktok.com', 'www.tiktok.com', 'vt.tiktok.com',
          'youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com',
          'pinterest.com', 'www.pinterest.com', 'pin.it',
          'facebook.com', 'www.facebook.com', 'fb.com', 'fb.me', 'm.facebook.com',
          'twitter.com', 'x.com', 'www.twitter.com', 't.co',
          'reddit.com', 'www.reddit.com', 'redd.it',
          'tumblr.com', 'www.tumblr.com',
          'snapchat.com', 'www.snapchat.com',
          'threads.net', 'www.threads.net', 'threads.com',  // Meta's Threads
          'weibo.com', 'weibo.cn',  // Chinese social media
          // Image search engines (not product pages)
          'images.google.com', 'google.com/images', 'www.google.com/images',
          'yandex.com/images', 'images.search.yahoo.com',
          // Magazines and editorial sites (not shopping)
          'vogue.com', 'elle.com', 'elle.co.kr', 'harpersbazaar.com', 'cosmopolitan.com',
          'gq.com', 'wmagazine.com', 'instyle.com', 'marieclaire.com',
          'glamour.com', 'allure.com', 'nylon.com', 'refinery29.com',
          'whowhatwear.com', 'popsugar.com', 'byrdie.com',
          // Korean entertainment/news sites (celebrity photos, not products)
          'newsen.com', 'm.newsen.com', 'www.newsen.com',
          'xportsnews.com', 'www.xportsnews.com',
          'dispatch.co.kr', 'www.dispatch.co.kr',
          'sportsseoul.com', 'www.sportsseoul.com',
          'sportalkorea.com', 'www.sportalkorea.com',
          'osen.co.kr', 'www.osen.co.kr', 'm.osen.co.kr',
          'entertain.naver.com', 'sports.naver.com',
          'starnewskorea.com', 'tenasia.co.kr', 'mydaily.co.kr',
          'news.nate.com', 'news.zum.com'
        ]
        
        // Problematic URL patterns (geo-restricted, frequently broken links)
        const problematicPatterns = [
          '/sq/', '/al/', '/xk/',  // Albania/Kosovo region codes (often geo-restricted)
          '/rs/', '/ba/', '/mk/',  // Serbia/Bosnia/Macedonia (geo-restricted)
          '/test/', '/staging/', '/dev.',  // Test/staging environments
          'localhost', '127.0.0.1',  // Local development
        ]
        
        // POST-FILTER: Final safety check after GPT (backup layer)
        const validLinks = links.filter((link: any) => {
          if (typeof link !== 'string' || !link.startsWith('http')) return false
          
          // Check if link contains any blocked domain (with boundary checking to avoid false positives)
          const linkLower = link.toLowerCase()
          const isBlocked = blockedDomains.some(domain => {
            // For very short domains like 't.co', check for exact domain match with boundaries
            if (domain.length <= 5) {
              // Match: //t.co/ or //t.co? or //www.t.co/
              return linkLower.includes(`//${domain}/`) || 
                     linkLower.includes(`//${domain}?`) ||
                     linkLower.includes(`//www.${domain}/`) ||
                     linkLower.includes(`//www.${domain}?`)
            }
            // For longer domains, regular substring match is safe
            return linkLower.includes(domain)
          })
          
          if (isBlocked) {
            console.log(`🚫 Blocked social media link: ${link.substring(0, 50)}...`)
            return false
          }
          
          // CRITICAL: Category mismatch filter - Check product title for wrong category keywords
          const resultItem = resultsForGPT.find((item: any) => item.link === link)
          if (resultItem && resultItem.title) {
            const title = resultItem.title.toLowerCase()
            
            // Define wrong category keywords for each category (very comprehensive)
            const wrongKeywords: Record<string, string[]> = {
              'tops': [
                // English
                'jean', 'jeans', 'pant', 'pants', 'trouser', 'trousers', 'short', 'shorts', 'skirt', 'skirts', 'dress', 'dresses',
                'denim pant', 'denim short', 'cargo pant', 'wide pant', 'slim pant', 'baggy pant',
                // Korean - comprehensive list
                '바지', '청바지', '반바지', '치마', '드레스', '팬츠', '슬랙스', 
                '데님팬츠', '데님바지', '진', '스키니', '와이드팬츠', '부츠컷', '벨보텀',
                '카고팬츠', '조거팬츠', '슬랙스바지', '면바지', '린넨바지', '코튼팬츠',
                '핀턱바지', '밴딩팬츠', '밴딩바지', '통바지', '일자바지', '스트레이트팬츠',
                '포켓바지', '포켓팬츠', '워싱바지', '워싱팬츠', '루즈핏바지', '루즈핏팬츠',
                // Common product descriptors for pants in Korean
                '하의', '치마바지', '큐롯', '쇼츠', '하프팬츠', '5부바지', '7부바지', '9부바지',
                '롱팬츠', '크롭팬츠', '크롭바지', '앵클팬츠'
              ],
              'bottoms': [
                // English - comprehensive tops list
                'shirt', 'blouse', 'jacket', 'coat', 'sweater', 'hoodie', 'cardigan', 'top', 'blazer', 'vest',
                't-shirt', 'tshirt', 'tee', 'polo', 'button-up', 'button up', 'tie-front', 'crop top',
                'tank top', 'camisole', 'sweatshirt', 'pullover', 'jumper', 'tunic', 'poncho',
                // Korean - comprehensive tops list
                '셔츠', '재킷', '후드', '코트', '스웨터', '니트', '가디건', '블라우스', '상의',
                '티셔츠', '맨투맨', '후드티', '집업', '아우터', '점퍼', '자켓', '블레이저',
                '베스트', '조끼', '가디건', '니트티', '폴라티', '긴팔티', '반팔티', '민소매',
                '크롭티', '크롭탑', '캐미솔', '뷔스티에', '슬리브리스', '나시',
                // Modal/tie-front specific (appears in Korean shopping)
                'modal', 'tie-front', '타이', '프론트', '모달'
              ],
              'shoes': ['shirt', 'pant', 'jean', 'jacket', 'dress', 'bag', 'backpack', '셔츠', '바지', '가방', '재킷'],
              'bag': ['shirt', 'pant', 'jean', 'jacket', 'dress', 'shoe', 'boot', 'sneaker', '셔츠', '바지', '신발', '재킷'],
              'accessory': ['shirt', 'pant', 'jean', 'jacket', 'dress', 'shoe', 'bag', '셔츠', '바지', '신발', '가방', '재킷'],
              'dress': ['pant', 'jean', 'short', 'shirt', 'jacket', '바지', '셔츠', '재킷']
            }
            
            const keywordsToAvoid = wrongKeywords[categoryKey] || []
            
            // Check if title contains any wrong category keywords
            for (const keyword of keywordsToAvoid) {
              // For exact word matching (avoid false positives like "shortened" containing "short")
              const regex = new RegExp(`\\b${keyword}\\b`, 'i')
              if (regex.test(title) || title.includes(keyword)) {
                console.log(`🚫 Category mismatch (title): "${resultItem.title.substring(0, 60)}..." contains "${keyword}" (searching for ${categoryKey})`)
                return false
              }
            }
            
            // ADDITIONAL: Check URL path for category indicators (Korean sites often use URL segments)
            if (categoryKey === 'tops') {
              const urlPath = linkLower
              const wrongUrlPatterns = [
                '/pants/', '/jeans/', '/denim/', '/trousers/', '/shorts/', '/skirt/', '/bottom/',
                '/바지/', '/청바지/', '/팬츠/', '/반바지/', '/치마/', '/하의/',
                'category=pants', 'category=bottom', 'category=jeans',
                '/goods/pants', '/goods/jeans', '/goods/bottom',
                '/product/pants', '/product/jeans', '/product/bottom'
              ]
              
              for (const pattern of wrongUrlPatterns) {
                if (urlPath.includes(pattern)) {
                  console.log(`🚫 Category mismatch (URL): "${link.substring(0, 60)}..." URL contains "${pattern}" (searching for tops)`)
                  return false
                }
              }
            }
            
            // ADDITIONAL: Check URL path for tops when searching for bottoms
            if (categoryKey === 'bottoms') {
              const urlPath = linkLower
              const wrongUrlPatterns = [
                '/shirt/', '/blouse/', '/top/', '/jacket/', '/coat/', '/sweater/', '/hoodie/',
                '/셔츠/', '/블라우스/', '/상의/', '/티셔츠/', '/재킷/', '/아우터/',
                'category=shirt', 'category=top', 'category=blouse',
                '/goods/shirt', '/goods/blouse', '/goods/top',
                '/product/shirt', '/product/blouse', '/product/top'
              ]
              
              for (const pattern of wrongUrlPatterns) {
                if (urlPath.includes(pattern)) {
                  console.log(`🚫 Category mismatch (URL): "${link.substring(0, 60)}..." URL contains "${pattern}" (searching for bottoms)`)
                  return false
                }
              }
            }
          }
          
          // Filter out category/search/listing pages (not actual products)
          // Be precise to avoid false positives on actual product pages with query params
          const isCategoryPage = 
            // Search pages
            linkLower.includes('/search?') ||
            linkLower.includes('/search.') ||
            linkLower.includes('/search_') ||
            linkLower.includes('/searchresult') ||
            linkLower.includes('search-result') ||
            // List/category pages
            linkLower.includes('/list?') ||
            linkLower.includes('/list.') ||
            linkLower.includes('/category?') ||
            linkLower.includes('/category/') && !linkLower.match(/\/category\/[^\/]+\/product/) || // Allow /category/xyz/product/123
            linkLower.includes('/shop/list') ||
            // Query parameters that indicate search/listing (but not product params)
            linkLower.match(/[?&]query=/i) ||
            linkLower.match(/[?&]keyword=/i) ||
            linkLower.match(/[?&]q=/i) && !linkLower.includes('/product') || // Allow /product?q=... but not /search?q=...
            // Collection/product listing endpoints (but allow specific products)
            linkLower.match(/\/products\?/i) && !linkLower.match(/\/products\/[^?]+\?/) || // Block /products? but allow /products/123?
            linkLower.match(/\/collections\?/i) && !linkLower.match(/\/collections\/[^?]+\/products/) ||  // Block /collections? but allow /collections/xyz/products/123
            // Catalog pages ending with generic plural category names (e.g., /bags/, /shoes/, /travel-bags.html)
            linkLower.match(/\/(bags|shoes|accessories|clothing|apparel|dresses|pants|trousers|shirts|tops|bottoms|outerwear|jackets|coats|sweaters|knitwear|skirts|shorts|jeans|sneakers|boots|sandals|jewelry|watches|belts|scarves|hats|gloves|sunglasses|wallets|purses|backpacks|luggage|travel-bags|duffle|tote|crossbody|handbags|clutches|shoulder-bags)\.html?$/i) ||
            linkLower.match(/\/(bags|shoes|accessories|clothing|travel-bags|duffle|handbags)\/?$/i) && !linkLower.match(/\/product/i) ||
            // Multi-level category paths without product identifiers (e.g., /men/accessories/bags/travel-bags.html)
            linkLower.match(/\/(men|women|kids|unisex)\/(accessories|clothing|shoes|bags)\/.+\.(html?|aspx?)$/i) && !linkLower.match(/\/(product|item|p)[\/-]/i) && !linkLower.match(/\d{5,}/i) || // Allow if has product ID (5+ digits)
            // Non-product pages (reviews, Q&A, etc.)
            linkLower.endsWith('/reviews') ||
            linkLower.endsWith('/reviews/') ||
            linkLower.includes('/reviews?') ||
            linkLower.endsWith('/questions') ||
            linkLower.endsWith('/qa') ||
            linkLower.endsWith('/ratings') ||
            linkLower.includes('/customer-reviews') ||
            linkLower.includes('/product-reviews')
          
          if (isCategoryPage) {
            console.log(`🚫 Blocked category/search page: ${link.substring(0, 60)}...`)
            return false
          }
          
          // Check for problematic URL patterns (geo-restricted, broken links)
          const hasProblematicPattern = problematicPatterns.some(pattern => linkLower.includes(pattern))
          if (hasProblematicPattern) {
            console.log(`🚫 Blocked geo-restricted/problematic link: ${link.substring(0, 60)}...`)
            return false
          }
          
          // Post-filter check (backup - most filtering already done pre-GPT)
          // Only catches items if GPT somehow selected a filtered-out result
          const foundResult = resultsForGPT.find((item: any) => item.link === link)
          if (!foundResult) {
            console.log(`🚫 Post-filter: Link not in filtered results: ${link.substring(0, 60)}...`)
            return false
          }
          
          // ADDITIONAL VALIDATION: Check if title matches the specific item description
          // This catches cases where GPT might have missed specific attribute mismatches
          if (itemDescription && foundResult.title) {
            const title = foundResult.title.toLowerCase()
            const description = itemDescription.toLowerCase()
            
            // Extract key descriptive words from the description (color, material, type, etc.)
            const descWords = description.split(/[\s_]+/).filter((word: string) => word.length > 2)
            
            // Check for critical attribute mismatches
            const criticalMismatches = [
              // Sleeve length mismatches
              { desc: ['short sleeve', 'short-sleeve'], exclude: ['long sleeve', 'long-sleeve', 'longsleeve'] },
              { desc: ['long sleeve', 'long-sleeve', 'longsleeve'], exclude: ['short sleeve', 'short-sleeve', 'shortsleeve'] },
              { desc: ['sleeveless'], exclude: ['long sleeve', 'short sleeve', 'sleeved'] },
              
              // Neckline mismatches
              { desc: ['collar', 'collared'], exclude: ['halter', 'v-neck', 'vneck', 'crew neck', 'crewneck'] },
              { desc: ['halter'], exclude: ['collar', 'v-neck', 'vneck', 'crew neck', 'crewneck'] },
              { desc: ['v-neck', 'vneck'], exclude: ['collar', 'halter', 'crew neck', 'crewneck'] },
              
              // Completely wrong item types
              { desc: ['hoodie', 'hooded'], exclude: ['cardigan', 'blazer', 'vest', 'socks', '양말', '스타킹', 'stockings'] },
              { desc: ['jacket', 'coat'], exclude: ['shirt', 'blouse', 'sweater', 'hoodie', 'socks', '양말'] },
              { desc: ['sweater', 'knit'], exclude: ['jacket', 'coat', 'blazer', 'socks', '양말', '스타킹'] }
            ]
            
            for (const mismatch of criticalMismatches) {
              const hasDescAttribute = mismatch.desc.some(attr => description.includes(attr))
              if (hasDescAttribute) {
                const hasExcludedAttribute = mismatch.exclude.some(attr => title.includes(attr))
                if (hasExcludedAttribute) {
                  console.log(`🚫 Post-filter: Title attribute mismatch for "${itemDescription}": "${foundResult.title?.substring(0, 80)}..."`)
                  return false
                }
              }
            }
          }
          
          return true
        })
        
        if (validLinks.length > 0) {
          // KOREAN SITE VALIDATION: Ensure at least 2 Korean sites
          const koreanDomains = ['coupang.com', 'gmarket.co.kr', '11st.co.kr', 'musinsa.com', 'zigzag.kr', 
                                 'elandmall.co.kr', 'wconcept.co.kr', '29cm.co.kr', 'ssg.com', 
                                 'oottbebe.co.kr', 'jenybiny.com', 'ably.co.kr', 'brandi.co.kr']
          
          const koreanLinks = validLinks.filter((link: string) => 
            koreanDomains.some(domain => link.toLowerCase().includes(domain))
          )
          const internationalLinks = validLinks.filter((link: string) => 
            !koreanDomains.some(domain => link.toLowerCase().includes(domain))
          )
          
          console.log(`🇰🇷 Korean site validation: ${koreanLinks.length} Korean, ${internationalLinks.length} international`)
          
          // Enforce minimum 2 Korean sites
          let finalLinks: string[]
          if (koreanLinks.length >= 2) {
            // Good! We have enough Korean sites
            if (koreanLinks.length >= 3) {
              // All Korean if we have 3+
              finalLinks = koreanLinks.slice(0, 3)
              console.log(`✅ Using 3 Korean sites (have ${koreanLinks.length} available)`)
            } else {
              // 2 Korean + 1 international
              finalLinks = [...koreanLinks.slice(0, 2), ...internationalLinks.slice(0, 1)]
              console.log(`✅ Using 2 Korean + 1 international`)
            }
          } else if (koreanLinks.length === 1) {
            // Only 1 Korean - still use it but warn
            finalLinks = [...koreanLinks, ...internationalLinks.slice(0, 2)]
            console.warn(`⚠️  Only found 1 Korean site, adding 2 international (not ideal)`)
          } else {
            // No Korean sites - use international but log this
            finalLinks = internationalLinks.slice(0, 3)
            console.warn(`⚠️  NO KOREAN SITES FOUND - using international only (unusual!)`)
          }
          
          // Re-validate finalLinks exist
          validLinks.length = 0
          validLinks.push(...finalLinks)
          
          // ONLY use full image results for non-character items AND same category
          // For character/graphic items, DON'T mix full image results (they may be different characters!)
          if (!characterName) {
            console.log(`📌 No character - checking if top full image results match category...`)
            
            // Category validation: Define what to accept per category
            // Map ALL possible category keys (not just generic ones!)
            const categoryKeywords: Record<string, string[]> = {
              // Bags
              'bag': ['bag', 'backpack', 'purse', 'tote', 'clutch', 'crossbody', 'shoulder bag', 'handbag', 'messenger', 'satchel', '가방', '백팩', '토트백'],
              'bags': ['bag', 'backpack', 'purse', 'tote', 'clutch', 'crossbody', 'shoulder bag', 'handbag', 'messenger', 'satchel', '가방', '백팩', '토트백'],
              
              // Tops
              'top': ['jacket', 'coat', 'sweater', 'shirt', 'blouse', 'cardigan', 'blazer', 'hoodie', 'top', '재킷', '코트', '스웨터', '셔츠', '상의'],
              'tops': ['jacket', 'coat', 'sweater', 'shirt', 'blouse', 'cardigan', 'blazer', 'hoodie', 'top', '재킷', '코트', '스웨터', '셔츠', '상의'],
              'shirt': ['shirt', 'blouse', 'top', 'tee', 't-shirt', 'polo', 'button-up', '셔츠', '블라우스', '상의'],
              'sweater': ['sweater', 'cardigan', 'pullover', 'knit', 'jumper', '스웨터', '니트', '가디건'],
              'jacket': ['jacket', 'coat', 'blazer', 'parka', 'bomber', 'windbreaker', '재킷', '코트', '아우터'],
              'coat': ['coat', 'jacket', 'overcoat', 'trench', 'peacoat', '코트', '외투'],
              'hoodie': ['hoodie', 'sweatshirt', 'pullover', 'zip-up', '후드', '후디'],
              
              // Bottoms
              'pants': ['pants', 'trousers', 'slacks', 'chinos', '바지', '팬츠', '슬랙스'],  // REMOVED 'jeans'!
              'bottoms': ['pants', 'jeans', 'skirt', 'shorts', 'trousers', 'slacks', '바지', '청바지', '치마', '반바지'],
              'jeans': ['jeans', 'denim', '청바지', '데님'],  // REMOVED 'pants' to separate jeans from trousers!
              'skirt': ['skirt', 'mini skirt', 'midi skirt', 'maxi skirt', '치마', '스커트'],
              'shorts': ['shorts', 'short pants', 'bermuda', '반바지', '쇼츠'],
              
              // Dresses
              'dress': ['dress', 'gown', 'frock', 'sundress', 'maxi dress', 'mini dress', '드레스', '원피스'],
              
              // Shoes
              'shoe': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'oxford', 'pump', '신발', '부츠', '샌들', '슈즈'],
              'shoes': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'oxford', 'pump', '신발', '부츠', '샌들', '슈즈'],
              'sneaker': ['sneaker', 'trainer', 'running shoe', 'athletic shoe', '스니커즈', '운동화'],
              'boot': ['boot', 'ankle boot', 'knee boot', 'chelsea boot', '부츠'],
              
              // Accessories
              'accessory': ['sunglasses', 'glasses', 'eyewear', 'ring', 'necklace', 'earring', 'bracelet', 'watch', 'hat', 'cap', 'belt', 'scarf', '선글라스', '안경', '모자'],
              'hat': ['hat', 'cap', 'beanie', 'beret', 'fedora', 'bucket hat', '모자', '비니', '캡'],
              'sunglasses': ['sunglasses', 'shades', 'eyewear', 'glasses', '선글라스', '썬글라스'],
              'eyewear': ['sunglasses', 'glasses', 'eyewear', 'spectacles', 'shades', '안경', '선글라스'],
              'belt': ['belt', 'waist belt', 'leather belt', '벨트', '허리띠'],
              'scarf': ['scarf', 'shawl', 'wrap', 'stole', '스카프', '목도리'],
              'jewelry': ['ring', 'necklace', 'earring', 'bracelet', 'pendant', 'chain', '반지', '목걸이', '귀걸이', '팔찌'],
              'watch': ['watch', 'timepiece', 'wristwatch', '시계', '손목시계']
            }
            
            // Extract key descriptive words with WEIGHTED IMPORTANCE
            // Distinctive features (collar style, patterns, special details, specific colors) get 5x weight
            // Common features (generic colors like black/white, basic materials) get 1x weight
            const distinctiveKeywords = [
              // Collar styles
              'collar', 'collared', 'shirt collar', 'pointed collar', 'shawl collar', 'v-neck', 'crew neck', 'turtle neck', 'mock neck',
              
              // Closures & details
              'drawstring', 'toggle', 'zipper', 'zip-up', 'button-down', 'snap', 'velcro',
              
              // Fits & silhouettes
              'cropped', 'oversized', 'slim-fit', 'relaxed-fit', 'tailored', 'boxy', 'form-fitting', 'baggy',
              
              // Textures & knits
              'ribbed', 'cable-knit', 'chunky', 'fine-knit', 'waffle-knit', 'honeycomb',
              
              // Leg styles & trouser features  
              'pleated', 'flared', 'wide-leg', 'tapered', 'straight-leg', 'bootcut', 'skinny',
              'center crease', 'cuffed hem', 'turn-up cuffs', 'front pleat', 'double pleat', 'dress pants',
              
              // Sleeve styles
              'ruffled', 'puff sleeve', 'bell sleeve', 'cap sleeve', 'raglan', 'dolman', 'bishop sleeve',
              
              // Design details
              'asymmetric', 'cutout', 'backless', 'halter', 'off-shoulder', 'one-shoulder',
              
              // Embellishments
              'fringe', 'sequin', 'embroidered', 'studded', 'quilted', 'beaded', 'applique',
              
              // Patterns
              'houndstooth', 'plaid', 'striped', 'polka dot', 'leopard', 'zebra', 'gingham', 'checkered', 'herringbone', 'paisley',
              
              // Specific/distinctive colors (NOT generic black/white/navy/gray!)
              'olive', 'khaki', 'burgundy', 'maroon', 'emerald', 'forest green', 'mustard', 'rust', 'terracotta',
              'coral', 'peach', 'lavender', 'lilac', 'mint', 'teal', 'aqua', 'turquoise', 
              'blush', 'rose', 'mauve', 'sage', 'ochre', 'camel', 'cognac', 'chocolate'
            ]
            
            const descriptionLower = itemDescription ? itemDescription.toLowerCase() : ''
            const descriptionWords = descriptionLower.split(/\s+/).filter((w: string) => 
              w.length > 3 && !['item', 'the', 'and', 'with', 'for', 'from', 'long', 'sleeve', 'short'].includes(w)
            )
            
            // Build weighted keyword map
            const weightedKeywords: Array<{ word: string; weight: number }> = []
            
            // Add distinctive features with 5x weight
            distinctiveKeywords.forEach(keyword => {
              if (descriptionLower.includes(keyword)) {
                // For multi-word keywords, add each word separately
                keyword.split(/\s+/).forEach(word => {
                  if (word.length > 3) {
                    weightedKeywords.push({ word, weight: 5 })
                  }
                })
              }
            })
            
            // Add remaining words with 1x weight (avoid duplicates)
            const addedWords = new Set(weightedKeywords.map(k => k.word))
            descriptionWords.forEach((word: string) => {
              if (!addedWords.has(word)) {
                weightedKeywords.push({ word, weight: 1 })
                addedWords.add(word)
              }
            })
            
            const topFullImageLinks = fullImageResults
              .slice(0, 50) // Check top 50 to find better matches (e.g., silk-satin drawstring pants buried deep)
              .map((item: any) => {
                if (!item.link) return null
                const linkLower = item.link.toLowerCase()
                const titleLower = item.title?.toLowerCase() || ''
                const combinedText = `${titleLower} ${linkLower}`
                
                // Check if blocked domain
                const isBlocked = blockedDomains.some(domain => {
                  if (domain.length <= 5) {
                    return linkLower.includes(`//${domain}/`) || 
                           linkLower.includes(`//${domain}?`) ||
                           linkLower.includes(`//www.${domain}/`) ||
                           linkLower.includes(`//www.${domain}?`)
                  }
                  return linkLower.includes(domain)
                })
                if (isBlocked) {
                  console.log(`🚫 Blocked full image result: ${item.link.substring(0, 50)}...`)
                  return null
                }
                
                // CRITICAL: Check if same category (prevent bags in sunglasses results!)
                const allowedKeywords = categoryKeywords[categoryKey] || []
                const hasCategoryMatch = allowedKeywords.some(keyword => combinedText.includes(keyword))
                
                if (!hasCategoryMatch) {
                  console.log(`🚫 WRONG CATEGORY in full image: "${item.title?.substring(0, 40)}" (not ${categoryKey})`)
                  return null
                }
                
                // CRITICAL: For pants/trousers, EXCLUDE jeans explicitly!
                if (categoryKey === 'pants' && (combinedText.includes('jeans') || combinedText.includes('denim') || combinedText.includes('jean ') || combinedText.includes('청바지'))) {
                  console.log(`🚫 JEANS EXCLUDED from trousers: "${item.title?.substring(0, 40)}"`)
                  return null
                }
                
                // Calculate WEIGHTED match score (distinctive features get 5x weight!)
                let matchScore = 1 // Base score for category match
                weightedKeywords.forEach(({ word, weight }) => {
                  if (combinedText.includes(word)) {
                    matchScore += weight
                  }
                })
                
                // Log distinctiveness
                const distinctiveMatches = weightedKeywords.filter(k => k.weight === 5 && combinedText.includes(k.word))
                const distinctiveLabel = distinctiveMatches.length > 0 
                  ? ` [DISTINCTIVE: ${distinctiveMatches.map(k => k.word).join(', ')}]` 
                  : ''
                
                console.log(`✅ CATEGORY MATCH in full image: "${item.title?.substring(0, 40)}" (${categoryKey}, score: ${matchScore}${distinctiveLabel})`)
                return { link: item.link, score: matchScore }
              })
              .filter((item: any) => item !== null)
              .sort((a: any, b: any) => b.score - a.score) // Sort by score (highest first)
              .slice(0, 5) // Take top 5 best matches
              .map((item: any) => item.link)
            
            if (topFullImageLinks.length > 0) {
              console.log(`🌟 Top full image results (CATEGORY VERIFIED):`, topFullImageLinks.length)
              
              // Prepend ONLY if they're the same category
              const combinedLinks = [...topFullImageLinks, ...validLinks]
              const uniqueLinks = Array.from(new Set(combinedLinks))
              
              validLinks.length = 0
              validLinks.push(...uniqueLinks.slice(0, 5))
              
              console.log(`✅ Final links (full image + GPT-4):`, validLinks.slice(0, 3))
            } else {
              console.log(`⚠️  No category-matched full image results - using GPT-4 only`)
              console.log(`✅ Final links (GPT-4 only):`, validLinks.slice(0, 3))
            }
          } else {
            console.log(`🎭 Character item (${characterName}) - skipping full image results (may be different characters)`)
            console.log(`✅ Final links (GPT-4 only):`, validLinks.slice(0, 3))
          }
          
          // Debug: Check first result structure
          if (mergedResults.length > 0) {
            console.log('🔍 Sample merged result keys:', Object.keys(mergedResults[0]))
          }
          
          // Find the thumbnail images from multiple sources (priority order: full image > merged > cropped)
          const linksWithThumbnails = validLinks.slice(0, 3).map((link: string) => {
            // PRIORITY: Search full image results FIRST (these have the best metadata)
            // Then search merged results, then fallback to cropped results
            const resultItem = fullImageResults.find((item: any) => item.link === link)
              || mergedResults.find((item: any) => item.link === link) 
              || resultsForGPT.find((item: any) => item.link === link)
            
            // Try ALL possible field names for thumbnail (Serper uses different names!)
            const thumbnail = resultItem?.thumbnailUrl || resultItem?.thumbnail || resultItem?.image || resultItem?.imageUrl || resultItem?.ogImage || null
            
            // Debug: Log what fields are available when thumbnail is missing
            if (!thumbnail && resultItem) {
              console.log(`⚠️  No thumbnail for ${link.substring(0, 40)}`)
              console.log(`   Available fields:`, Object.keys(resultItem))
              console.log(`   Full item:`, JSON.stringify(resultItem, null, 2).substring(0, 300))
            } else if (thumbnail) {
              console.log(`✅ Thumbnail found for ${link.substring(0, 40)}: ${thumbnail.substring(0, 60)}`)
            }
            
            return {
              link,
              thumbnail,
              title: resultItem?.title || null
            }
          })
          
          // Update reasoning data with selected links (including thumbnails for analytics)
          gptReasoningData[resultKey].selectedLinks = linksWithThumbnails.map((item: any) => ({
            link: item.link,
            title: item.title,
            thumbnail: item.thumbnail
          }))
          gptReasoningData[resultKey].selectionCount = linksWithThumbnails.length
          
          // TWO-STAGE SELECTION: Split into Color Matches and Style Matches
          const colorMatches: any[] = []
          const styleMatches: any[] = []
          
          // Extract CORE features ONLY (garment type) - trust GPT for style details
          const extractCoreFeatures = (desc: string): string[] => {
            const descLower = desc.toLowerCase()
            const coreFeatures: string[] = []
            
            // ONLY extract garment type (CORE FEATURE)
            // Skip detail features like collar, pleat, cuff - GPT handles those visually
            if (descLower.includes('cardigan') || descLower.includes('가디건')) coreFeatures.push('cardigan')
            if (descLower.includes('sweater') || descLower.includes('스웨터')) coreFeatures.push('sweater')
            if (descLower.includes('hoodie') || descLower.includes('후드')) coreFeatures.push('hoodie')
            if (descLower.includes('jacket') || descLower.includes('재킷')) coreFeatures.push('jacket')
            if (descLower.includes('coat') || descLower.includes('코트')) coreFeatures.push('coat')
            if (descLower.includes('shirt') || descLower.includes('셔츠')) coreFeatures.push('shirt')
            if (descLower.includes('blouse') || descLower.includes('블라우스')) coreFeatures.push('blouse')
            if (descLower.includes('dress') || descLower.includes('드레스')) coreFeatures.push('dress')
            if (descLower.includes('pants') || descLower.includes('trouser') || descLower.includes('바지') || descLower.includes('팬츠')) coreFeatures.push('pants')
            if (descLower.includes('jeans') || descLower.includes('청바지') || descLower.includes('denim')) coreFeatures.push('jeans')
            if (descLower.includes('skirt') || descLower.includes('치마')) coreFeatures.push('skirt')
            if (descLower.includes('shorts') || descLower.includes('반바지')) coreFeatures.push('shorts')
            
            return coreFeatures
          }
          
          const coreFeatures = extractCoreFeatures(itemDescription || '')
          console.log(`🎯 Core features (garment type only): ${coreFeatures.join(', ')}`)
          console.log(`ℹ️  Trusting GPT-4 Turbo for style details (collar, pleat, cuff, etc.)`)
          
          if (primaryColor && linksWithThumbnails.length > 0) {
            // Define color matching keywords (exact and synonyms)
            const colorKeywords: Record<string, string[]> = {
              'olive': ['olive', '올리브', 'khaki green', 'army green'],
              'khaki': ['khaki', '카키', 'olive', 'army'],
              'beige': ['beige', '베이지', 'sand', 'tan', 'camel'],
              'black': ['black', '블랙', '검정', 'noir'],
              'white': ['white', '화이트', '흰색', 'ivory', 'cream', '아이보리'],
              'navy': ['navy', '네이비', '남색', 'dark blue', 'deep navy'], // Added variations
              'brown': ['brown', '브라운', '갈색', 'chocolate'],
              'grey': ['grey', 'gray', '그레이', '회색', 'charcoal'],
              'green': ['green', '그린', '녹색', 'emerald', 'forest'],
              'blue': ['blue', '블루', '파랑', 'azure', 'cobalt']
            }
            
            const matchingKeywords = colorKeywords[primaryColor.toLowerCase()] || [primaryColor.toLowerCase()]
            console.log(`\n🎨 COLOR MATCHING DEBUG:`)
            console.log(`   Primary color: "${primaryColor}"`)
            console.log(`   Matching keywords: [${matchingKeywords.join(', ')}]`)
            
            // LENIENT VALIDATION: Only check CORE features (garment type + color)
            // Trust GPT-4 Turbo for style details (collar, pleat, cuff, etc.)
            linksWithThumbnails.forEach((item: any, idx: number) => {
              const title = item.title?.toLowerCase() || ''
              const link = item.link?.toLowerCase() || ''
              const combinedText = `${title} ${link}`
              
              // Check color match with detailed logging
              const matchedColorKeyword = matchingKeywords.find(keyword => combinedText.includes(keyword))
              const hasColorMatch = !!matchedColorKeyword
              
              // Check if GARMENT TYPE matches (core feature) - WITH KOREAN SUPPORT
              const matchedGarmentFeature = coreFeatures.find(feature => {
                // Direct match
                if (combinedText.includes(feature)) return true
                
                // Pants variations (English + Korean)
                if (feature === 'pants' && (
                  combinedText.includes('trouser') || 
                  combinedText.includes('slacks') || 
                  combinedText.includes('chino') ||
                  combinedText.includes('팬츠') ||  // Korean: pants
                  combinedText.includes('바지') ||  // Korean: pants/trousers
                  combinedText.includes('치노') ||  // Korean: chino
                  combinedText.includes('슬랙스')   // Korean: slacks
                )) return true
                
                // Cardigan variations (Korean)
                if (feature === 'cardigan' && combinedText.includes('가디건')) return true
                
                // Sweater variations (Korean)
                if (feature === 'sweater' && (combinedText.includes('스웨터') || combinedText.includes('니트'))) return true
                
                return false
              })
              const hasGarmentTypeMatch = coreFeatures.length === 0 || !!matchedGarmentFeature
              
              // Check if this was from text search
              const isFromTextSearch = item.searchType === 'text'
              const searchTypeIcon = isFromTextSearch ? '📝' : '🖼️'
              
              // LENIENT: Accept if garment type matches (trust GPT for details)
              if (hasColorMatch && hasGarmentTypeMatch) {
                // Perfect match: right color + right garment type
                colorMatches.push(item)
                console.log(`${searchTypeIcon} 🎨 COLOR MATCH #${idx + 1}: "${item.title?.substring(0, 60)}..."`)
                console.log(`   ✓ Color: "${matchedColorKeyword}" | ✓ Garment: "${matchedGarmentFeature}" ${isFromTextSearch ? '(TEXT SEARCH)' : ''}`)
              } else if (!hasColorMatch && hasGarmentTypeMatch) {
                // Style match: wrong color but right garment type
                styleMatches.push(item)
                console.log(`${searchTypeIcon} ✂️  STYLE MATCH #${idx + 1}: "${item.title?.substring(0, 60)}..."`)
                console.log(`   ✗ Color (no match) | ✓ Garment: "${matchedGarmentFeature}" ${isFromTextSearch ? '(TEXT SEARCH)' : ''}`)
              } else {
                // Rejected: wrong garment type
                console.log(`${searchTypeIcon} ❌ REJECTED #${idx + 1}: "${item.title?.substring(0, 60)}..."`)
                console.log(`   Color: ${hasColorMatch ? '✓' : '✗'} | Garment: ✗ (expected: ${coreFeatures.join(', ')})`)
              }
            })
            
            // If we don't have enough color matches, fill from merged results (with lenient validation)
            if (colorMatches.length < 3) {
              console.log(`\n⚠️  Only ${colorMatches.length} color matches found, searching merged results for more...`)
              
              const additionalColorMatches = mergedResults
                .filter((item: any) => {
                  // CRITICAL: Must have a valid link
                  if (!item.link || typeof item.link !== 'string') {
                    console.log(`   🚫 Skipping item with invalid link`)
                    return false
                  }
                  
                  const title = item.title?.toLowerCase() || ''
                  const link = item.link?.toLowerCase() || ''
                  const combinedText = `${title} ${link}`
                  
                  // Must have color match
                  const matchedKeyword = matchingKeywords.find(keyword => combinedText.includes(keyword))
                  const hasColorMatch = !!matchedKeyword
                  if (!hasColorMatch) return false
                  
                  // Must have garment type (lenient - only core feature) WITH KOREAN SUPPORT
                  const hasGarmentTypeMatch = coreFeatures.length === 0 || coreFeatures.some(feature => {
                    if (combinedText.includes(feature)) return true
                    
                    // Pants variations (English + Korean)
                    if (feature === 'pants' && (
                      combinedText.includes('trouser') || 
                      combinedText.includes('slacks') || 
                      combinedText.includes('chino') ||
                      combinedText.includes('팬츠') ||
                      combinedText.includes('바지') ||
                      combinedText.includes('치노') ||
                      combinedText.includes('슬랙스')
                    )) return true
                    
                    // Cardigan variations (Korean)
                    if (feature === 'cardigan' && combinedText.includes('가디건')) return true
                    
                    // Sweater variations (Korean)
                    if (feature === 'sweater' && (combinedText.includes('스웨터') || combinedText.includes('니트'))) return true
                    
                    return false
                  })
                  if (!hasGarmentTypeMatch) return false
                  
                  // Not already included
                  const notAlreadyIncluded = !colorMatches.some(existing => existing.link === item.link)
                  if (notAlreadyIncluded) {
                    console.log(`   💡 Found potential: "${title.substring(0, 60)}..." (matched: "${matchedKeyword}")`)
                  }
                  return notAlreadyIncluded
                })
                .slice(0, 3 - colorMatches.length)
                .map((item: any) => ({
                  link: item.link,
                  thumbnail: item.thumbnailUrl || item.thumbnail || item.imageUrl || null,
                  title: item.title || null,
                  searchType: item.searchType || 'unknown' // PRESERVE searchType!
                }))
              
              colorMatches.push(...additionalColorMatches)
              console.log(`✅ Added ${additionalColorMatches.length} more color matches from merged results`)
            }
            
            // If we STILL don't have enough style matches, fill from merged results (lenient)
            if (styleMatches.length < 3) {
              console.log(`⚠️  Only ${styleMatches.length} style matches found, searching for more...`)
              
              const additionalStyleMatches = mergedResults
                .filter((item: any) => {
                  // CRITICAL: Must have a valid link
                  if (!item.link || typeof item.link !== 'string') {
                    console.log(`   🚫 Skipping item with invalid link`)
                    return false
                  }
                  
                  const title = item.title?.toLowerCase() || ''
                  const link = item.link?.toLowerCase() || ''
                  const combinedText = `${title} ${link}`
                  
                  // Must have garment type (ignore color, ignore detail features) WITH KOREAN SUPPORT
                  const hasGarmentTypeMatch = coreFeatures.length === 0 || coreFeatures.some(feature => {
                    if (combinedText.includes(feature)) return true
                    
                    // Pants variations (English + Korean)
                    if (feature === 'pants' && (
                      combinedText.includes('trouser') || 
                      combinedText.includes('slacks') || 
                      combinedText.includes('chino') ||
                      combinedText.includes('팬츠') ||
                      combinedText.includes('바지') ||
                      combinedText.includes('치노') ||
                      combinedText.includes('슬랙스')
                    )) return true
                    
                    // Cardigan variations (Korean)
                    if (feature === 'cardigan' && combinedText.includes('가디건')) return true
                    
                    // Sweater variations (Korean)
                    if (feature === 'sweater' && (combinedText.includes('스웨터') || combinedText.includes('니트'))) return true
                    
                    return false
                  })
                  if (!hasGarmentTypeMatch) return false
                  
                  // CRITICAL: Must NOT have the target color (this is STYLE match, not COLOR match!)
                  const hasTargetColor = matchingKeywords.some(keyword => combinedText.includes(keyword))
                  if (hasTargetColor) {
                    console.log(`   🚫 Skipping "${title.substring(0, 40)}..." (has target color, should be in colorMatches)`)
                    return false
                  }
                  
                  // Must NOT be in color matches or style matches already
                  const notInColorMatches = !colorMatches.some(existing => existing.link === item.link)
                  const notInStyleMatches = !styleMatches.some(existing => existing.link === item.link)
                  return notInColorMatches && notInStyleMatches
                })
                .slice(0, 3 - styleMatches.length)
                .map((item: any) => ({
                  link: item.link,
                  thumbnail: item.thumbnailUrl || item.thumbnail || item.imageUrl || null,
                  title: item.title || null,
                  searchType: item.searchType || 'unknown' // PRESERVE searchType!
                }))
              
              styleMatches.push(...additionalStyleMatches)
              console.log(`✅ Added ${additionalStyleMatches.length} more style matches (lenient validation)`)
            }
            
            // DEDUPLICATE BY DOMAIN to ensure brand variety
            const extractDomain = (url: string): string => {
              try {
                const urlObj = new URL(url)
                // Extract main domain (e.g., "hm.com" from "www2.hm.com")
                const parts = urlObj.hostname.split('.')
                return parts.length > 2 ? parts.slice(-2).join('.') : urlObj.hostname
              } catch {
                return url
              }
            }
            
            // Deduplicate color matches by domain
            const uniqueColorMatches: any[] = []
            const colorDomains = new Set<string>()
            for (const item of colorMatches) {
              const domain = extractDomain(item.link)
              if (!colorDomains.has(domain)) {
                uniqueColorMatches.push(item)
                colorDomains.add(domain)
                console.log(`   ✅ Color match from: ${domain}`)
              } else {
                console.log(`   🚫 Duplicate domain in color matches: ${domain}`)
              }
            }
            
            // Deduplicate style matches by domain
            const uniqueStyleMatches: any[] = []
            const styleDomains = new Set<string>()
            for (const item of styleMatches) {
              const domain = extractDomain(item.link)
              if (!styleDomains.has(domain)) {
                uniqueStyleMatches.push(item)
                styleDomains.add(domain)
                console.log(`   ✅ Style match from: ${domain}`)
              } else {
                console.log(`   🚫 Duplicate domain in style matches: ${domain}`)
              }
            }
            
            // Replace with deduplicated matches
            colorMatches.length = 0
            colorMatches.push(...uniqueColorMatches)
            styleMatches.length = 0
            styleMatches.push(...uniqueStyleMatches)
            
            // If we lost too many due to deduplication, try to refill with unique domains
            if (colorMatches.length < 3) {
              console.log(`⚠️  Only ${colorMatches.length} unique color matches after deduplication, refilling...`)
              const refillColorMatches = mergedResults
                .filter((item: any) => {
                  if (!item.link || typeof item.link !== 'string') return false
                  const domain = extractDomain(item.link)
                  if (colorDomains.has(domain)) return false
                  
                  const title = item.title?.toLowerCase() || ''
                  const link = item.link?.toLowerCase() || ''
                  const combinedText = `${title} ${link}`
                  
                  const hasColorMatch = matchingKeywords.some(keyword => combinedText.includes(keyword))
                  if (!hasColorMatch) return false
                  
                  const hasGarmentTypeMatch = coreFeatures.length === 0 || coreFeatures.some(feature => {
                    if (combinedText.includes(feature)) return true
                    if (feature === 'pants' && (combinedText.includes('trouser') || combinedText.includes('slacks') || combinedText.includes('chino') || combinedText.includes('팬츠') || combinedText.includes('바지') || combinedText.includes('치노') || combinedText.includes('슬랙스'))) return true
                    if (feature === 'cardigan' && combinedText.includes('가디건')) return true
                    if (feature === 'sweater' && (combinedText.includes('스웨터') || combinedText.includes('니트'))) return true
                    return false
                  })
                  if (!hasGarmentTypeMatch) return false
                  
                  return !colorMatches.some(existing => existing.link === item.link)
                })
                .slice(0, 3 - colorMatches.length)
                .map((item: any) => ({
                  link: item.link,
                  thumbnail: item.thumbnailUrl || item.thumbnail || item.imageUrl || null,
                  title: item.title || null,
                  searchType: item.searchType || 'unknown'
                }))
              
              colorMatches.push(...refillColorMatches)
              refillColorMatches.forEach(item => colorDomains.add(extractDomain(item.link)))
              console.log(`✅ Refilled to ${colorMatches.length} color matches with unique domains`)
            }
            
            if (styleMatches.length < 3) {
              console.log(`⚠️  Only ${styleMatches.length} unique style matches after deduplication, refilling...`)
              const refillStyleMatches = mergedResults
                .filter((item: any) => {
                  if (!item.link || typeof item.link !== 'string') return false
                  const domain = extractDomain(item.link)
                  if (styleDomains.has(domain)) return false
                  
                  const title = item.title?.toLowerCase() || ''
                  const link = item.link?.toLowerCase() || ''
                  const combinedText = `${title} ${link}`
                  
                  const hasTargetColor = matchingKeywords.some(keyword => combinedText.includes(keyword))
                  if (hasTargetColor) return false
                  
                  const hasGarmentTypeMatch = coreFeatures.length === 0 || coreFeatures.some(feature => {
                    if (combinedText.includes(feature)) return true
                    if (feature === 'pants' && (combinedText.includes('trouser') || combinedText.includes('slacks') || combinedText.includes('chino') || combinedText.includes('팬츠') || combinedText.includes('바지') || combinedText.includes('치노') || combinedText.includes('슬랙스'))) return true
                    if (feature === 'cardigan' && combinedText.includes('가디건')) return true
                    if (feature === 'sweater' && (combinedText.includes('스웨터') || combinedText.includes('니트'))) return true
                    return false
                  })
                  if (!hasGarmentTypeMatch) return false
                  
                  return !styleMatches.some(existing => existing.link === item.link) && !colorMatches.some(existing => existing.link === item.link)
                })
                .slice(0, 3 - styleMatches.length)
                .map((item: any) => ({
                  link: item.link,
                  thumbnail: item.thumbnailUrl || item.thumbnail || item.imageUrl || null,
                  title: item.title || null,
                  searchType: item.searchType || 'unknown'
                }))
              
              styleMatches.push(...refillStyleMatches)
              refillStyleMatches.forEach(item => styleDomains.add(extractDomain(item.link)))
              console.log(`✅ Refilled to ${styleMatches.length} style matches with unique domains`)
            }
            
            console.log(`\n📊 Two-Stage Selection Complete (after domain deduplication):`)
            console.log(`   🎨 Color Matches: ${colorMatches.length} (${colorMatches.length} unique domains)`)
            console.log(`   ✂️  Style Matches: ${styleMatches.length} (${styleMatches.length} unique domains)`)
          } else {
            // No primary color detected - validate garment type only (lenient)
            console.log(`ℹ️  No primary color detected - validating garment type only`)
            
            linksWithThumbnails.forEach((item: any) => {
              const title = item.title?.toLowerCase() || ''
              const link = item.link?.toLowerCase() || ''
              const combinedText = `${title} ${link}`
              
              // Check if garment type matches (lenient) WITH KOREAN SUPPORT
              const hasGarmentTypeMatch = coreFeatures.length === 0 || coreFeatures.some(feature => {
                if (combinedText.includes(feature)) return true
                
                // Pants variations (English + Korean)
                if (feature === 'pants' && (
                  combinedText.includes('trouser') || 
                  combinedText.includes('slacks') || 
                  combinedText.includes('chino') ||
                  combinedText.includes('팬츠') ||
                  combinedText.includes('바지') ||
                  combinedText.includes('치노') ||
                  combinedText.includes('슬랙스')
                )) return true
                
                // Cardigan variations (Korean)
                if (feature === 'cardigan' && combinedText.includes('가디건')) return true
                
                // Sweater variations (Korean)
                if (feature === 'sweater' && (combinedText.includes('스웨터') || combinedText.includes('니트'))) return true
                
                return false
              })
              
              if (hasGarmentTypeMatch) {
                styleMatches.push(item)
                console.log(`✂️  STYLE MATCH (no color): "${item.title?.substring(0, 60)}..." (${coreFeatures.join(', ')})`)
              } else {
                console.log(`❌ REJECTED (no color): "${item.title?.substring(0, 60)}..." (wrong garment type)`)
              }
            })
          }
          
          console.log(`✅ Found ${validLinks.length} link(s) for ${resultKey}:`, validLinks.slice(0, 3))
          
          // Summary: Text vs Visual search distribution
          const colorMatchesFromText = colorMatches.filter((item: any) => item.searchType === 'text').length
          const colorMatchesFromVisual = colorMatches.filter((item: any) => item.searchType === 'visual').length
          const styleMatchesFromText = styleMatches.filter((item: any) => item.searchType === 'text').length
          const styleMatchesFromVisual = styleMatches.filter((item: any) => item.searchType === 'visual').length
          
          console.log(`\n📊 FINAL RESULTS SUMMARY for ${resultKey}:`)
          console.log(`   🎨 Color Matches: ${colorMatches.length} total (📝 ${colorMatchesFromText} text, 🖼️  ${colorMatchesFromVisual} visual)`)
          console.log(`   ✂️  Style Matches: ${styleMatches.length} total (📝 ${styleMatchesFromText} text, 🖼️  ${styleMatchesFromVisual} visual)`)
          
          return { 
            resultKey, 
            colorMatches: colorMatches.slice(0, 3), 
            styleMatches: styleMatches.slice(0, 3),
            source: 'gpt' 
          }
        } else {
          // Fallback: take top 3 organic results directly (with STRICT filtering)
          const fallback = organicResults
            .filter((item: any) => {
              if (typeof item?.link !== 'string' || !item.link.startsWith('http')) return false
              
              const linkLower = item.link.toLowerCase()
              
              // Filter out social media
              const isSocialMedia = blockedDomains.some(domain => linkLower.includes(domain))
              if (isSocialMedia) {
                console.log(`🛟 Fallback: Blocked social media: ${item.link.substring(0, 60)}...`)
                return false
              }
              
              // Filter out forums, communities, blogs, media sites (NON-SHOPPING)
              const nonShoppingSites = [
                // Korean forums/communities
                'theqoo.net', 'pann.nate.com', 'dcinside.com', 'fmkorea.com', 'clien.net',
                'ppomppu.co.kr', 'bobaedream.co.kr', 'mlbpark.donga.com', 'ruliweb.com',
                'instiz.net', 'ygosu.com', 'ilbe.com', 'todayhumor.co.kr',
                // Blogs
                'blog.naver.com', 'tistory.com', 'medium.com', 'blogger.com', 'wordpress.com',
                'brunch.co.kr', 'velog.io', 'oopy.io',
                // Media/streaming
                'youtube.com', 'youtu.be', 'soundcloud.com', 'spotify.com', 'apple.com/music',
                'vimeo.com', 'twitch.tv', 'tiktok.com',
                // News/media
                'naver.com/news', 'daum.net/news', 'joins.com', 'chosun.com', 'donga.com',
                'hankyung.com', 'mk.co.kr', 'sedaily.com', 'mt.co.kr', 'hani.co.kr',
                // Korean entertainment/news sites
                'newsen.com', 'm.newsen.com', 'xportsnews.com', 'dispatch.co.kr',
                'sportsseoul.com', 'sportalkorea.com', 'osen.co.kr', 'm.osen.co.kr',
                'entertain.naver.com', 'sports.naver.com', 'starnewskorea.com',
                'tenasia.co.kr', 'mydaily.co.kr', 'news.nate.com', 'news.zum.com',
                // Wiki/reference
                'wikipedia.org', 'namu.wiki', 'wikiwand.com',
                // Q&A/forums
                'quora.com', 'reddit.com', 'stackoverflow.com', 'kin.naver.com',
                // File sharing
                'drive.google.com', 'dropbox.com', 'mega.nz'
              ]
              
              const isNonShopping = nonShoppingSites.some(domain => linkLower.includes(domain))
              if (isNonShopping) {
                console.log(`🛟 Fallback: Blocked non-shopping site: ${item.link.substring(0, 60)}...`)
                return false
              }
              
              // Filter out category/search pages and non-product pages
              const isCategoryPage = 
                linkLower.includes('/search?') ||
                linkLower.includes('/search.') ||
                linkLower.includes('/search_') ||
                linkLower.includes('/searchresult') ||
                linkLower.includes('search-result') ||
                linkLower.includes('/list?') ||
                linkLower.includes('/list.') ||
                linkLower.includes('/category?') ||
                linkLower.includes('/category/') && !linkLower.match(/\/category\/[^\/]+\/product/) ||
                linkLower.includes('/shop/list') ||
                linkLower.match(/[?&]query=/i) ||
                linkLower.match(/[?&]keyword=/i) ||
                linkLower.match(/[?&]q=/i) && !linkLower.includes('/product') ||
                linkLower.match(/\/products\?/i) && !linkLower.match(/\/products\/[^?]+\?/) ||
                linkLower.match(/\/collections\?/i) && !linkLower.match(/\/collections\/[^?]+\/products/) ||
                // Non-product pages (reviews, Q&A, etc.)
                linkLower.endsWith('/reviews') ||
                linkLower.endsWith('/reviews/') ||
                linkLower.includes('/reviews?') ||
                linkLower.endsWith('/questions') ||
                linkLower.endsWith('/qa') ||
                linkLower.endsWith('/ratings') ||
                linkLower.includes('/customer-reviews') ||
                linkLower.includes('/product-reviews')
              
              if (isCategoryPage) {
                console.log(`🛟 Fallback: Blocked category/non-product page: ${item.link.substring(0, 60)}...`)
                return false
              }
              
              // Positive signal: Must have shopping indicators (RELAXED for better results)
              const hasShoppingIndicators = 
                linkLower.includes('/product') ||
                linkLower.includes('/item') ||
                linkLower.includes('/goods') ||
                linkLower.includes('/shop') ||
                linkLower.includes('/store') ||
                linkLower.includes('/detail') ||
                linkLower.includes('smartstore.naver.com') ||
                linkLower.includes('.com/kr/') ||
                linkLower.includes('.co.kr') ||
                linkLower.includes('.com') ||  // Allow any .com (many shopping sites)
                linkLower.match(/\/(p|pd|prd|prod)\/\d+/) || // product ID patterns
                linkLower.match(/\/buy/) ||
                linkLower.match(/\/cart/) ||
                linkLower.match(/\/commerce/) ||
                linkLower.match(/\/clothing/) ||
                linkLower.match(/\/fashion/) ||
                linkLower.match(/\/wear/)
              
              if (!hasShoppingIndicators) {
                console.log(`🛟 Fallback: No shopping indicators: ${item.link.substring(0, 60)}...`)
                return false
              }
              
              return true
            })
            .slice(0, 3)
            .map((item: any) => ({
              link: item.link,
              thumbnail: item.thumbnail || item.image || item.imageUrl || item.ogImage || null,
              title: item.title || null,
            }))
          if (fallback.length > 0) {
            console.log(`🛟 Fallback used for ${resultKey} with ${fallback.length} link(s)`)
            // Fallback returns all results as style matches (no color filtering in fallback mode)
            return { 
              resultKey, 
              colorMatches: [],
              styleMatches: fallback, 
              source: 'fallback' 
            }
          } else {
            console.log(`⚠️ No valid link for ${resultKey}`)
            return { 
              resultKey, 
              colorMatches: [],
              styleMatches: [],
              source: 'none' 
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error searching for ${resultKey}:`, error)
        return { resultKey, results: null, source: 'error' }
      }
    })

    // Wait for all searches to complete in parallel
    const searchResults = await Promise.all(searchPromises)
    timingData.per_category_search_time = (Date.now() - categoriesStart) / 1000
    console.log(`⏱️  All category searches completed in: ${timingData.per_category_search_time.toFixed(2)}s (parallel)`)
    
    // Aggregate results and track sources
    const aggregateStart = Date.now()
    const sourceCounts = { gpt: 0, fallback: 0, none: 0, error: 0 }
    for (const result of searchResults) {
      const { resultKey, colorMatches, styleMatches, results, source } = result as any
      
      // New two-stage format (color + style matches)
      if (colorMatches || styleMatches) {
        allResults[resultKey] = {
          colorMatches: colorMatches || [],
          styleMatches: styleMatches || []
        }
      } 
      // Legacy format (backward compatibility)
      else if (results) {
        allResults[resultKey] = results
      }
      
      // Track source statistics
      if (source) {
        sourceCounts[source as keyof typeof sourceCounts]++
      }
    }

    const aggregateTime = (Date.now() - aggregateStart) / 1000
    timingData.processing_overhead_time += aggregateTime
    console.log(`⏱️  Result aggregation took: ${aggregateTime.toFixed(3)}s`)
    
    const requestTotalTime = (Date.now() - requestStartTime) / 1000
    const searchWallClockTime = (Date.now() - timingData.search_wall_clock_start) / 1000
    
    console.log('\n📊 Final results:', Object.keys(allResults))
    console.log(`📈 Result sources: GPT=${sourceCounts.gpt}, Fallback=${sourceCounts.fallback}, None=${sourceCounts.none}, Error=${sourceCounts.error}`)
    
    // Calculate overhead
    const measuredTime = timingData.full_image_search_time + 
                         timingData.per_category_search_time + 
                         timingData.gpt4_turbo_total_api_time + 
                         timingData.processing_overhead_time
    const unmeasuredOverhead = searchWallClockTime - measuredTime
    
    // Timing summary with detailed breakdown
    console.log('\n⏱️  TIMING SUMMARY (Search API) - Chronological:')
    console.log(`   1️⃣  Full image search (3x Serper): ${timingData.full_image_search_time.toFixed(2)}s`)
    console.log(`   2️⃣  Per-category searches (${timingData.serper_count}x parallel): ${timingData.per_category_search_time.toFixed(2)}s`)
    console.log(`      → Serper API time (accumulated): ${timingData.serper_total_api_time.toFixed(2)}s`)
    console.log(`      → Avg per category: ${(timingData.serper_total_api_time / Math.max(timingData.serper_count, 1)).toFixed(2)}s`)
    console.log(`   3️⃣  Gemini 3 Pro filtering (${timingData.gpt4_turbo_count}x): ${timingData.gpt4_turbo_total_api_time.toFixed(2)}s`)
    console.log(`      → Avg per category: ${(timingData.gpt4_turbo_total_api_time / Math.max(timingData.gpt4_turbo_count, 1)).toFixed(2)}s`)
    console.log(`   4️⃣  Processing overhead (parsing/dedup/merge): ${timingData.processing_overhead_time.toFixed(2)}s`)
    console.log(`   5️⃣  Other overhead (network/etc): ${unmeasuredOverhead.toFixed(2)}s`)
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`   ⏰ Wall-clock time (actual): ${searchWallClockTime.toFixed(2)}s`)
    console.log(`   ⏱️  Total request time: ${requestTotalTime.toFixed(2)}s\n`)
    
    return NextResponse.json({ 
      results: allResults,
      meta: { 
        sourceCounts,
        gptReasoning: gptReasoningData,  // Include GPT reasoning for each category
        timing: {
          // Chronological breakdown
          full_image_search_seconds: parseFloat(timingData.full_image_search_time.toFixed(2)),
          per_category_search_seconds: parseFloat(timingData.per_category_search_time.toFixed(2)),
          gpt4_turbo_api_time_seconds: parseFloat(timingData.gpt4_turbo_total_api_time.toFixed(2)),
          processing_overhead_seconds: parseFloat(timingData.processing_overhead_time.toFixed(2)),
          other_overhead_seconds: parseFloat((searchWallClockTime - (timingData.full_image_search_time + timingData.per_category_search_time + timingData.gpt4_turbo_total_api_time + timingData.processing_overhead_time)).toFixed(2)),
          // Wall-clock time (what user experiences)
          wall_clock_seconds: parseFloat(searchWallClockTime.toFixed(2)),
          // Accumulated API times (for reference)
          serper_api_time_seconds: parseFloat(timingData.serper_total_api_time.toFixed(2)),
          serper_count: timingData.serper_count,
          gpt4_turbo_count: timingData.gpt4_turbo_count,
          // Total request time (includes everything)
          total_seconds: parseFloat(requestTotalTime.toFixed(2)),
          // Parallel efficiency
          categories_parallel: timingData.serper_count
        }
      } 
    })
  } catch (error) {
    console.error('❌ Search error:', error)
    return NextResponse.json(
      { error: 'Failed to process search' },
      { status: 500 }
    )
  }
}
