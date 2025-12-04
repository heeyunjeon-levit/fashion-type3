import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI lazily to read fresh env vars on each request
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
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
    
    // Use GPT-4 Turbo to analyze and categorize the results
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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a fashion product analyzer. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    })
    timingData.gpt4_turbo_api_time = (Date.now() - gptStart) / 1000
    console.log(`   ⏱️  Fallback GPT-4 Turbo: ${timingData.gpt4_turbo_api_time.toFixed(2)}s`)

    const responseText = completion.choices[0].message.content || '{}'
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    const gptResult = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned)
    
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

    const allResults: Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>> = {}
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
        // Call Serper Lens 3 times for best result coverage
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

        const serperStart = Date.now()
        const serperResponses = await Promise.all(serperCallPromises)
        const serperTime = (Date.now() - serperStart) / 1000
        timingData.serper_total_api_time += serperTime
        timingData.serper_count += 1
        console.log(`   ⏱️  Serper API (3x parallel): ${serperTime.toFixed(2)}s`)
        
        // Aggregate results from 3 runs
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
            allOrganicResults.push(...serperData.organic)
          }
        }

        // Deduplicate by URL and keep unique results from cropped image
        const uniqueCroppedResults = Array.from(
          new Map(allOrganicResults.map(item => [item.link, item])).values()
        )
        
        console.log(`📊 Cropped image search: ${uniqueCroppedResults.length} unique results`)
        
        // Filter full image results to only include items relevant to this category
        const filteredFullImageResults = fullImageResults.filter(item => {
          const title = item.title?.toLowerCase() || ''
          const snippet = item.snippet?.toLowerCase() || ''
          const combinedText = `${title} ${snippet}`
          
          // Check if the result contains keywords relevant to this category
          const categoryTerms = categorySearchTerms[categoryKey] || [categoryKey]
          return categoryTerms.some(term => combinedText.includes(term.toLowerCase()))
        })
        
        console.log(`📊 Full image results: ${fullImageResults.length} total, ${filteredFullImageResults.length} relevant to ${categoryKey}`)
        
        // Combine cropped image results with filtered full image results
        const combinedResults = [...uniqueCroppedResults, ...filteredFullImageResults]
        
        // Deduplicate the combined results
        const uniqueCombinedResults = Array.from(
          new Map(combinedResults.map(item => [item.link, item])).values()
        )
        
        console.log(`📊 Combined (cropped + full image): ${uniqueCombinedResults.length} unique results`)
        
        const organicResults = uniqueCombinedResults.slice(0, 30) // Keep top 30 for best GPT analysis
        
        if (organicResults.length === 0) {
          console.log(`⚠️ No Serper results for ${resultKey} after 3 runs`)
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
              'ring': 'necklaces, earrings, bracelets, watches, hats, belts, scarves, sunglasses',
              'necklace': 'rings, earrings, bracelets, watches, hats, belts, scarves, sunglasses',
              'earrings': 'rings, necklaces, bracelets, watches, hats, belts, scarves, sunglasses',
              'bracelet': 'rings, necklaces, earrings, watches, hats, belts, scarves, sunglasses',
              'watch': 'rings, necklaces, earrings, bracelets, hats, belts, scarves, sunglasses',
              'headwear': 'rings, necklaces, earrings, bracelets, watches, belts, scarves, sunglasses',
              'belt': 'rings, necklaces, earrings, bracelets, watches, hats, scarves, sunglasses',
              'scarf': 'rings, necklaces, earrings, bracelets, watches, hats, belts, sunglasses',
              'eyewear': 'rings, necklaces, earrings, bracelets, watches, hats, belts, scarves'
            }
            if (specificSubType && accessoryExclusions[specificSubType]) subTypeExclusion = `- ⚠️ CRITICAL: You are searching for ${specificSubType} ONLY. ❌ EXCLUDE: ${accessoryExclusions[specificSubType]}, clothing, shoes, bags`
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
        console.log(`   ✂️  Cropped image search: ${organicResults.length} results (for alternatives)`)
        
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
        
        // Use filtered results for GPT analysis
        const resultsForGPT = filteredResults
        
        const prompt = `You are analyzing aggregated image search results from multiple runs for ${categoryLabels[categoryKey]}.

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
🚨 **PRIORITY #2: PRIMARY COLOR IS ${primaryColor.toUpperCase()}** 🚨
- You MUST find products that are ${primaryColor.toUpperCase()} colored!
- ❌ DO NOT return items with INVERTED colors (e.g., if color is BLACK, don't return WHITE/CREAM items)
- ❌ If item is BLACK with white details, find BLACK items (not white/cream)
- ❌ If item is WHITE/CREAM with black details, find WHITE/CREAM items (not black)
` : ''}

🎯 **IMPORTANT: Results are ordered by quality - TOP results are from full-image search (most accurate for iconic items)**
- First ${fullImageResults.length} results are from full image search (recognizes context, celebrity outfits, exact matches)
- Remaining results are from cropped image search (finds similar styles)
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
- ${categoryKey === 'bag' && !specificSubType ? '❌ ABSOLUTELY REJECT: clothing items, shoes, accessories (except bags)' : ''}
- ${categoryKey === 'accessory' && !specificSubType ? '❌ ABSOLUTELY REJECT: clothing items, shoes, bags' : ''}
- ${categoryKey === 'dress' ? '❌ ABSOLUTELY REJECT: Any title mentioning "pants", "jeans", "shorts", "shirt", "jacket", "바지", "셔츠", "재킷"' : ''}

CRITICAL SELECTION RULES (in order of priority):
${characterName ? `0. 🎭 **CHARACTER/GRAPHIC MATCH FIRST**: Item MUST feature "${characterName.toUpperCase()}"! Reject different characters!` : ''}
${primaryColor ? `${characterName ? '1' : '0'}. 🎨 **COLOR MATCH ${characterName ? 'SECOND' : 'FIRST'}**: Item MUST be ${primaryColor.toUpperCase()} colored! Reject inverted colors!` : ''}
${characterName || primaryColor ? '2' : '1'}. 🇰🇷 **PREFER KOREAN SITES**: G마켓, 11번가, Coupang, Musinsa, Zigzag → often have EXACT matches!
${characterName || primaryColor ? '3' : '2'}. CATEGORY MATCH: Must be correct garment type (${categorySearchTerms[categoryKey]?.join(' OR ')})
${characterName || primaryColor ? '4' : '3'}. VISUAL MATCH: Look for similar style, color, material
4. Accept ANY e-commerce/product website (Korean, international, boutique)
5. Accept: G마켓, 11번가, Coupang, Musinsa, Amazon, Zara, H&M, Nordstrom, Uniqlo, YesStyle, Etsy, Depop
7. 🚫 REJECT these sites (NOT product pages): Instagram, TikTok, YouTube, Pinterest, Facebook, Twitter/X, Reddit, Google Images, image CDNs, blogs, news sites, wikis, non-product pages
8. 🚫 REJECT non-product pages: URLs ending with /reviews, /questions, /qa, /ratings (these are NOT product detail pages)
9. If you cannot find 3 VALID PRODUCT LINKS, return fewer than 3. NEVER include non-product sites just to fill the quota.

SELECTION PROCESS:
- These results are aggregated from 3 cropped image runs + 3 full image runs for maximum coverage
- Each result has: "link", "title", "thumbnail" fields
- **CRITICAL: You MUST read and validate the "title" field for EVERY result before selecting it**
- The "title" describes what the link actually shows - use it to verify accuracy
- Example for bottoms: "blue shorts" ✅, "blue hoodie" ❌ (wrong category)
- Example for tops: "red sweatshirt" ✅, "red skirt" ❌ (wrong category)
- Prefer actual product pages over homepages, category pages, or general listings

TITLE VALIDATION RULES (FLEXIBLE - trust visual similarity):
1. ✅ READ the "title" field carefully - it tells you what the product actually is
2. ✅ FLEXIBLE: Allow category variations within same body part (sweater/jacket/coat all OK for upper body)
${itemDescription ? `3. 🎯 **CRITICAL: Match "${itemDescription}"**
   - 🎨 **COLOR IS MOST IMPORTANT** - if description says "black", prefer BLACK items!
   - If description says "white/cream/beige", prefer LIGHT colored items!
   - Don't mix up inverted colors (black→white is WRONG, white→black is WRONG)
   - Style/silhouette should match (cable knit, bow details, etc.)
   - For Korean text: 검정=black, 흰색/아이보리=white/ivory, 베이지=beige` : ''}
4. 🎨 **COLOR PRIORITY**: If the item has a distinctive color (black, white, red, etc.), STRONGLY prefer matching colors
5. ⚠️ ONLY REJECT if clearly wrong body part:
   ${categoryKey === 'tops' ? '**REJECT ONLY: pants/jeans/shorts/skirts/leggings (lower body items)**' : ''}
   ${categoryKey === 'bottoms' ? '**REJECT ONLY: if title suggests it\'s NOT worn on lower body**' : ''}
6. ❌ REJECT if title is generic ("Shop now", "Homepage", "Category", "Collection")
7. ✅ ACCEPT style variations - luxury fur coat might be tagged as jacket, sweater, or cardigan

Matching criteria (${characterName ? 'CHARACTER FIRST, then color' : 'COLOR FIRST, then visual similarity'}):
${characterName ? `1. 🎭 **#1 PRIORITY - CHARACTER/GRAPHIC MATCH**: Item MUST feature "${characterName.toUpperCase()}"!
   - Donald Duck mint green → find DONALD DUCK items (NOT Winnie the Pooh or Mickey!)
   - Winnie the Pooh yellow → find WINNIE THE POOH items (NOT Donald or Minnie!)
   - Don't mix up characters - this is a critical error!
   - Korean names: 푸 = Pooh, 미키 = Mickey, 미니 = Minnie, 도널드 = Donald Duck
2. 🎨 **#2 PRIORITY - COLOR MATCH**: If item is ${primaryColor?.toUpperCase() || 'a specific color'}, find matching colors!` : '1. 🎨 **#1 PRIORITY - COLOR MATCH**: If item is BLACK, find BLACK items. If WHITE/CREAM, find LIGHT items!'}
   - BLACK sweater with white bows → find BLACK sweaters (NOT beige/cream ones!)
   - WHITE/CREAM sweater with black bows → find WHITE/CREAM sweaters (NOT black ones!)
   - Don't return inverted colors - this is a critical error!
${characterName ? '3' : '2'}. ✅ Visual similarity (Google Lens found these based on IMAGE, trust it!)
${characterName ? '4' : '3'}. ✅ Style/material match (cable knit, bow details, ruffle hem, etc.)
${itemDescription ? `${characterName ? '5' : '4'}. 🎯 MATCH DESCRIPTION: "${itemDescription}" - especially the ${characterName ? 'CHARACTER and COLOR' : 'COLOR'} words!` : ''}
${characterName ? '6' : '5'}. ✅ FLEXIBLE: Category can vary within same general type (sweater, jacket, coat all = upper body wear)
${characterName ? '7' : '6'}. ✅ MUST: Link goes to a product detail page (not category/homepage)
${characterName ? '8' : '7'}. 🇰🇷 PREFER: Korean sites often have exact character + color matches!

**IMPORTANT: Return your BEST 3-5 HIGH-QUALITY matches ONLY. Quality over quantity.**

🌟 **SELECTION STRATEGY:**
- START by reviewing the first ${fullImageResults.length} results (full image search)
- If ANY of these top results are from reputable retailers (Zara, Fendi, Nordstrom, ASOS, etc.), STRONGLY CONSIDER including them
- Full image search often finds EXACT matches or designer pieces that cropped search misses
- Include high-quality full-image results EVEN IF category label differs slightly (fur coat labeled as "sweater" is fine)
- Then supplement with best cropped-image results for variety
- Return [] ONLY if literally no results are for the correct body part

🇰🇷 **KOREAN SITE PRIORITY** (search was done with gl=kr, hl=ko):
- **SELECT KOREAN SITES FIRST**: gmarket.co.kr, 11st.co.kr, coupang.com, musinsa.com, zigzag.kr, wconcept.co.kr, 29cm.co.kr, ssg.com
- Korean sites often have the EXACT MATCH - select these before international sites!
- **Ideal selection**: 2 Korean sites + 1 international alternative
- International alternatives: Amazon, Zara, H&M, ASOS, Uniqlo, Mango
- Avoid: Etsy/Depop/Poshmark (often sold out), region-specific .sq/.al domains

Search results (scan all ${resultsForGPT.length} for best matches):
${JSON.stringify(resultsForGPT, null, 2)}

**VALIDATION PROCESS (VISUAL-FIRST, PRIORITIZE TOP RESULTS):**
For EACH result you consider:
1. 📖 READ the "title" field first
2. 🚫 CHECK THE URL: Does it end with /reviews, /questions, /qa? → SKIP IMMEDIATELY (not a product page)
3. ⭐ **PRIORITY**: First ${fullImageResults.length} results are from FULL IMAGE SEARCH - strongly prefer these!
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

Return JSON: {"${resultKey}": ["url1", "url2", "url3"]} (3-5 links preferred) or {"${resultKey}": []} ONLY if zero valid products found.`

        const openai = getOpenAIClient()
        const gptStart = Date.now()
        const completion = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',  // Original model - best quality
          messages: [
            {
              role: 'system',
              content: 'You extract product links. Return only valid JSON without any additional text or markdown.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
        })
        const gptTime = (Date.now() - gptStart) / 1000
        timingData.gpt4_turbo_total_api_time += gptTime
        timingData.gpt4_turbo_count += 1
        console.log(`   ⏱️  GPT-4 Turbo filtering: ${gptTime.toFixed(2)}s`)

        const responseText = completion.choices[0].message.content || '{}'
        console.log(`📄 GPT response for ${resultKey}:`, responseText.substring(0, 200))
        
        // Store GPT reasoning/response for this category
        gptReasoningData[resultKey] = {
          itemDescription,
          searchTerms,
          selectedLinks: [],
          timestamp: new Date().toISOString(),
          candidateCount: resultsForGPT.length,
          fullImageResults: fullImageResults // Store for exact match extraction
        }
        
        // Parse response
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        const result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned)
        
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
          'whowhatwear.com', 'popsugar.com', 'byrdie.com'
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
          
          // Check if link contains any blocked domain
          const linkLower = link.toLowerCase()
          const isBlocked = blockedDomains.some(domain => linkLower.includes(domain))
          
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
          // Debug: Check first result structure
          if (mergedResults.length > 0) {
            console.log('🔍 Sample merged result keys:', Object.keys(mergedResults[0]))
          }
          
          // Find the thumbnail images from MERGED results (includes both full image + cropped)
          // This fixes the bug where full image results had no thumbnails
          const linksWithThumbnails = validLinks.slice(0, 3).map((link: string) => {
            // Search in merged results first (includes full image + cropped), fallback to resultsForGPT
            const resultItem = mergedResults.find((item: any) => item.link === link) 
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
          
          console.log(`✅ Found ${validLinks.length} link(s) for ${resultKey}:`, validLinks.slice(0, 3))
          return { resultKey, results: linksWithThumbnails, source: 'gpt' }
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
            return { resultKey, results: fallback, source: 'fallback' }
          } else {
            console.log(`⚠️ No valid link for ${resultKey}`)
            return { resultKey, results: null, source: 'none' }
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
    for (const { resultKey, results, source } of searchResults) {
      if (results) {
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
    console.log(`   3️⃣  GPT-4 Turbo filtering (${timingData.gpt4_turbo_count}x): ${timingData.gpt4_turbo_total_api_time.toFixed(2)}s`)
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
