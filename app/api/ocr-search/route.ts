import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GCLOUD_API_KEY || '')

/**
 * Extract color of a SPECIFIC item from image using GPT-4 Vision
 * @param imageUrl - The original image URL
 * @param productType - Type of item (e.g., "tops", "bottoms", "bag")
 * @param productDescription - OCR text describing the item (e.g., "울 케이블 라운드넥 카디건")
 * @returns Color name (e.g., "gray", "navy", "beige")
 */
async function detectItemColor(
  imageUrl: string, 
  productType: string, 
  productDescription: string
): Promise<string | null> {
  try {
    console.log(`🎨 Detecting color for ${productType}: "${productDescription}"`)
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          },
          {
            type: 'text',
            text: `Look at this image. There is a ${productType} (${productDescription}).

What is the PRIMARY COLOR of this ${productType}?

Return ONLY ONE WORD (the most specific color name):
- Examples: "gray", "black", "navy", "white", "beige", "brown", "olive", "cream"
- Be specific: Use "navy" not "blue", "charcoal" not "gray"
- Focus ONLY on the ${productType}, ignore other items
- If there are multiple colors, return the DOMINANT one

ONE WORD ONLY:`
          }
        ]
      }],
      max_tokens: 20,
      temperature: 0
    })
    
    const color = response.choices[0]?.message?.content?.trim().toLowerCase() || null
    console.log(`   ✅ Detected color for ${productType}: ${color}`)
    return color
    
  } catch (error) {
    console.error(`   ❌ Color detection failed for ${productType}:`, error)
    return null
  }
}

/**
 * Filter results by color using GPT-5.1 Vision
 */
async function filterResultsByColor(
  originalImageUrl: string,
  results: Array<{ title: string; link: string; thumbnail: string | null }>,
  primaryColor: string
): Promise<Array<{ title: string; link: string; thumbnail: string | null; colorScore: number }>> {
  try {
    // Only process results with thumbnails
    const resultsWithThumbnails = results.filter(r => r.thumbnail)
    
    if (resultsWithThumbnails.length === 0) {
      console.log('   ⚠️  No thumbnails to filter')
      return []
    }
    
    console.log(`🎨 Filtering ${resultsWithThumbnails.length} results by color (${primaryColor})...`)
    
    // Prepare image content - original + candidates
    const imageContent: any[] = [
      {
        type: 'image_url',
        image_url: { url: originalImageUrl }
      },
      {
        type: 'text',
        text: 'ORIGINAL IMAGE (reference color)'
      }
    ]
    
    // Add candidate thumbnails (max 10 to avoid token limits)
    const candidatesToCheck = resultsWithThumbnails.slice(0, 10)
    candidatesToCheck.forEach((result, idx) => {
      imageContent.push({
        type: 'image_url',
        image_url: { url: result.thumbnail! }
      })
      imageContent.push({
        type: 'text',
        text: `Candidate ${idx + 1}: "${result.title}"`
      })
    })
    
    const prompt = `You are a fashion color expert. Compare the color of each candidate product to the ORIGINAL image.

TARGET COLOR: ${primaryColor}

For each candidate (1-${candidatesToCheck.length}), rate the COLOR MATCH (0-10):
- 9-10: Exact same color as original (${primaryColor})
- 7-8: Very close color match
- 4-6: Similar but noticeably different
- 0-3: Different color

CRITICAL:
- Be STRICT! White ≠ Beige, Navy ≠ Black, Gray ≠ Charcoal
- Focus on the garment color, ignore background
- Only high scores (7+) for true color matches

Return JSON array:
[
  {"candidate": 1, "colorMatch": 9, "reason": "Exact ${primaryColor} match"},
  {"candidate": 2, "colorMatch": 3, "reason": "Wrong color - black not ${primaryColor}"},
  ...
]`
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: imageContent as any
      }, {
        role: 'user',
        content: prompt
      }],
      max_tokens: 1000,
      temperature: 0
    })
    
    const content = response.choices[0]?.message?.content || '[]'
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.warn('   ⚠️  Could not parse color scores')
      return []
    }
    
    const scores = JSON.parse(jsonMatch[0])
    
    // Map scores to results and filter by colorScore ≥ 7
    const colorMatches = candidatesToCheck
      .map((result, idx) => {
        const score = scores[idx] || { colorMatch: 0, reason: 'No score' }
        return {
          ...result,
          colorScore: score.colorMatch || 0,
          colorReason: score.reason || 'Unknown'
        }
      })
      .filter(item => item.colorScore >= 7)
    
    console.log(`   ✅ Found ${colorMatches.length}/${candidatesToCheck.length} color matches (score≥7)`)
    colorMatches.forEach((item, idx) => {
      console.log(`      ${idx + 1}. ${item.colorScore}/10 - ${item.colorReason}`)
    })
    
    return colorMatches
    
  } catch (error) {
    console.error('   ❌ Color filtering failed:', error)
    return []
  }
}

export async function POST(request: Request) {
  try {
    console.log('\n🔍 OCR SEARCH REQUEST (Google Vision + GPT)')
    
    const { imageUrl } = await request.json()
    
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, reason: 'No image URL provided' },
        { status: 400 }
      )
    }
    
    console.log(`   Image URL: ${imageUrl.substring(0, 80)}...`)
    
    // Step 1: Use Gemini for OCR text extraction
    console.log('\n📖 Step 1: Extracting text with Gemini 2.0 Flash...')
    
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GCLOUD_API_KEY
    console.log(`   GEMINI_API_KEY configured: ${process.env.GEMINI_API_KEY ? 'YES' : 'NO'}`)
    console.log(`   GCLOUD_API_KEY configured: ${process.env.GCLOUD_API_KEY ? 'YES' : 'NO'}`)
    console.log(`   OPENAI_API_KEY configured: ${process.env.OPENAI_API_KEY ? 'YES' : 'NO'}`)
    console.log(`   SERPER_API_KEY configured: ${process.env.SERPER_API_KEY ? 'YES' : 'NO'}`)
    
    if (!geminiApiKey) {
      console.error('   ❌ GEMINI_API_KEY or GCLOUD_API_KEY not set in environment!')
      return NextResponse.json({
        success: false,
        reason: 'Gemini API key not configured in Vercel environment variables'
      }, { status: 500 })
    }
    
    // Prepare image for Gemini
    let imageData: { inlineData: { data: string; mimeType: string } }
    
    if (imageUrl.startsWith('data:')) {
      // Data URL - extract base64 and MIME type
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) {
        return NextResponse.json({
          success: false,
          reason: 'Invalid data URL format'
        }, { status: 400 })
      }
      imageData = {
        inlineData: {
          data: match[2],
          mimeType: match[1]
        }
      }
      console.log(`   ✅ Using data URL (${Math.round(match[2].length / 1024)}KB)`)
    } else {
      // HTTP URL - download and convert
      console.log('   Downloading image...')
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        return NextResponse.json({
          success: false,
          reason: 'Failed to download image'
        }, { status: 500 })
      }
      
      const imageBuffer = await imageResponse.arrayBuffer()
      const base64Image = Buffer.from(imageBuffer).toString('base64')
      const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'
      
      imageData = {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
      console.log(`   ✅ Image downloaded and encoded (${Math.round(base64Image.length / 1024)}KB)`)
    }
    
    // Use Gemini to extract ALL text from the image
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.0
      }
    })
    
    const prompt = `Extract ALL text visible in this image. Include:
- All Korean text (한글)
- All English text
- Brand names, usernames (like @brandname), product names
- Numbers, dates, prices
- Any text on clothing, tags, signs, or overlays

Return ONLY the extracted text, nothing else. If there's no text, say "NO TEXT FOUND".`
    
    const result = await model.generateContent([prompt, imageData])
    const response = await result.response
    const fullText = response.text()?.trim() || ''
    
    if (!fullText || fullText === 'NO TEXT FOUND') {
      console.log('   ⚠️  No text detected by Gemini')
      return NextResponse.json({
        success: false,
        reason: 'No text detected in image'
      })
    }
    
    console.log(`   ✅ Extracted text: "${fullText.substring(0, 150)}..."`)
    console.log(`   ✅ Text length: ${fullText.length} characters`)
    
    // Step 2: Use GPT-4.1 to map extracted text to fashion brands/products
    console.log('\n🧠 Step 2: Mapping text to fashion brands with GPT-4.1...')
    
    const mappingResponse = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "Extract brands and products from OCR text. Return only valid JSON."
        },
        {
          role: "user",
          content: `You are analyzing OCR text extracted from a product image.

TASK: Identify ALL brands and their products visible in this image.

OCR TEXT:
${fullText}

INSTRUCTIONS:
1. Find ALL brand names (clothing brands, not platform names like Instagram/Musinsa/Coupang)
2. For EACH brand, identify the specific product being shown
3. Preserve EXACT Korean product names (do NOT translate or paraphrase)
4. Extract model numbers, colors, and key details EXACTLY as shown

🚨 CRITICAL: Instagram fashion brand accounts ARE VALID BRANDS!
- Format: @brandname with season codes (23S/S, 24F/W, 25F/W, etc.)
- Korean context words: 입어봤어요 (wore it), 샀어요 (bought), 구매 (purchase)
- Example: "@coyseio 25F/W 입어봤어요" = coyseio is a fashion brand!
- Remove @ symbol from brand name in output

Return JSON:
{
  "products": [
    {
      "brand": "BRAND_NAME (without @ symbol)",
      "exact_ocr_text": "exact product name/description from OCR",
      "product_type": "tops/bottoms/bag/shoes/accessory",
      "model_number": "if visible",
      "confidence": "high/medium/low"
    }
  ]
}

CRITICAL RULES:
- Preserve EXACT Korean text for product names
- INCLUDE Instagram fashion brands (with @brandname + season code pattern)
- Exclude platform brands (Musinsa, Coupang, Instagram, Ably, Kream, Temu)
- Exclude K-pop artists/groups (ILLIT, IVE, aespa, NewJeans, BLACKPINK, TWICE, Stray Kids, BTS, etc.)
- confidence=high if brand name + season code + context words visible
- If unsure about brand, skip it (quality over quantity)

If NO fashion brands found, return: {"products": []}`
        }
      ],
      max_tokens: 500,
      temperature: 0,
    })
    
    const mappingResult = mappingResponse.choices[0]?.message?.content
    
    if (!mappingResult) {
      console.log('   ⚠️  No mapping result from GPT')
      return NextResponse.json({
        success: false,
        reason: 'Failed to map text to brands'
      })
    }
    
    console.log(`   ✅ GPT mapping:`, mappingResult.substring(0, 200))
    
    // Parse JSON from GPT response
    let parsed
    try {
      const jsonMatch = mappingResult.match(/```json\n([\s\S]*?)\n```/) || mappingResult.match(/```\n([\s\S]*?)\n```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : mappingResult
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      console.error('   ❌ Failed to parse JSON:', e)
      return NextResponse.json({
        success: false,
        reason: 'Failed to parse brand mapping'
      })
    }
    
    let products = parsed.products || []
    
    // FALLBACK: If GPT missed Instagram fashion brands, extract them with regex
    if (products.length === 0 && fullText) {
      console.log('   🔍 No brands found by GPT, checking for Instagram fashion brand patterns...')
      
      // Pattern: @brandname followed by season code (23S/S, 24F/W, 25F/W) and Korean clothing context
      const instagramBrandPattern = /@(\w+)\s+(\d{2}[SF]\/[WS])\s*(입어봤어요|샀어요|구매|착용)/g
      const matches = [...fullText.matchAll(instagramBrandPattern)]
      
      for (const match of matches) {
        const brandName = match[1] // Extract brand without @
        const season = match[2] // e.g., "25F/W"
        const context = match[3] // e.g., "입어봤어요"
        
        console.log(`   ✅ Found Instagram brand pattern: @${brandName} ${season} ${context}`)
        
        products.push({
          brand: brandName,
          exact_ocr_text: `${season} ${context}`,
          product_type: 'tops', // Default, will be refined by search
          model_number: season,
          confidence: 'medium'
        })
      }
      
      if (products.length > 0) {
        console.log(`   ✅ Extracted ${products.length} brand(s) using pattern matching`)
      }
    }
    
    // HARD FILTER: Remove K-pop groups that GPT might have missed
    const kpopGroups = [
      'illit', 'ive', 'aespa', 'newjeans', 'le sserafim', 'lesserafim',
      'blackpink', 'twice', 'red velvet', 'itzy', 'stray kids', 'straykids',
      'bts', 'seventeen', 'enhypen', 'txt', 'tomorrow x together',
      'treasure', 'nct', 'exo', 'got7', 'monsta x', 'monstax',
      'ateez', 'the boyz', 'cravity', 'p1harmony', 'xikers',
      'gidle', '(g)i-dle', 'everglow', 'loona', 'fromis_9', 'fromis9',
      'kep1er', 'kepler', 'wjsn', 'cosmic girls', 'viviz', 'billlie'
    ]
    
    const platformBrands = [
      'musinsa', 'coupang', 'instagram', 'ably', 'kream', 'temu',
      'naver', 'gmarket', '29cm', 'zigzag', 'wconcept', 'balaan'
    ]
    
    products = products.filter((p: any) => {
      const brandLower = p.brand?.toLowerCase().replace(/\s+/g, '') || ''
      
      // Check K-pop groups
      const isKpop = kpopGroups.some(group => {
        const groupNormalized = group.replace(/\s+/g, '')
        return brandLower.includes(groupNormalized) || groupNormalized.includes(brandLower)
      })
      
      if (isKpop) {
        console.log(`   ❌ FILTERED OUT K-pop group: ${p.brand}`)
        return false
      }
      
      // Check platform brands
      const isPlatform = platformBrands.some(platform => brandLower.includes(platform))
      if (isPlatform) {
        console.log(`   ❌ FILTERED OUT platform brand: ${p.brand}`)
        return false
      }
      
      return true
    })
    
    if (products.length === 0) {
      console.log('   ⚠️  No fashion products identified (after filtering K-pop/platforms)')
      return NextResponse.json({
        success: false,
        reason: 'No fashion brands detected (only found K-pop groups or platform names)',
        extracted_text: fullText
      })
    }
    
    console.log(`   ✅ Identified ${products.length} product(s):`)
    products.forEach((p: any, i: number) => {
      console.log(`      ${i + 1}. ${p.brand} - ${p.product_type} (${p.confidence})`)
      if (p.exact_ocr_text) console.log(`         OCR: "${p.exact_ocr_text.substring(0, 50)}..."`)
    })
    
    // Step 3: Search for each product using HYBRID approach (Lens + Text)
    console.log('\n🔎 Step 3: Hybrid search (Lens + Text) for products...')
    
    // Blocked domains for non-fashion results
    const blockedDomains = [
      // Music & Album stores
      'yes24.com', 'www.yes24.com',
      'aladin.co.kr', 'www.aladin.co.kr',
      'kyobobook.co.kr', 'www.kyobobook.co.kr',
      'musicplant.com', 'ktown4u.com', 'catchopcd.com',
      'apple.com/music', 'music.apple.com',
      'spotify.com', 'www.spotify.com',
      'melon.com', 'www.melon.com',
      'bugs.co.kr', 'www.bugs.co.kr',
      'genie.co.kr', 'www.genie.co.kr',
      'flo.co.kr', 'www.flo.co.kr',
      // Social media & editorial
      'instagram.com', 'tiktok.com', 'youtube.com', 'pinterest.com',
      'facebook.com', 'twitter.com', 'x.com', 'threads.net',
      'elle.co.kr', 'vogue.com', 'harpersbazaar.com',
    ]
    
    // Keywords that indicate non-fashion products
    const excludedKeywords = [
      'album', '앨범', 'single', '싱글', 'ep', 'cd', 'dvd',
      'music', '음악', 'song', '노래', 'track', '화보집',
      'photobook', 'photo book', 'photo card', 'photocard',
      'poster', '포스터', 'merchandise', '굿즈'
    ]
    
    const searchResults = await Promise.all(
      products.map(async (product: any) => {
        // Use exact OCR text if available for more accurate search
        const searchTerm = product.exact_ocr_text || product.product_type
        const query = `${product.brand} ${searchTerm} buy online shop`
        console.log(`   Searching: ${query.substring(0, 80)}...`)
        
        try {
          // Use images API to get thumbnails (not organic search)
          const serperResponse = await fetch('https://google.serper.dev/images', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: query,
              gl: 'kr',
              hl: 'ko',
              num: 20, // Get more to filter out
            }),
          })
          
          const serperData = await serperResponse.json()
          const imageResults = serperData.images || []
          
          console.log(`   Found ${imageResults.length} results for ${product.brand}`)
          
          // Filter out blocked domains and non-fashion results
          const filteredResults = imageResults.filter((r: any) => {
            const link = r.link?.toLowerCase() || ''
            const title = r.title?.toLowerCase() || ''
            
            // Check blocked domains
            const isBlockedDomain = blockedDomains.some(domain => link.includes(domain))
            if (isBlockedDomain) {
              console.log(`   ❌ Blocked domain: ${link.substring(0, 50)}`)
              return false
            }
            
            // Check excluded keywords
            const hasExcludedKeyword = excludedKeywords.some(keyword => 
              title.includes(keyword.toLowerCase())
            )
            if (hasExcludedKeyword) {
              console.log(`   ❌ Excluded keyword in title: ${title.substring(0, 50)}`)
              return false
            }
            
            return true
          })
          
          console.log(`   ✅ Filtered to ${filteredResults.length} fashion results`)
          
          return {
            brand: product.brand,
            product_type: product.product_type,
            exact_ocr_text: product.exact_ocr_text || '',
            model_number: product.model_number || '',
            confidence: product.confidence || 'medium',
            results: filteredResults.slice(0, 5).map((r: any) => ({
              title: r.title || 'Product',
              link: r.link,
              thumbnail: r.thumbnailUrl || r.imageUrl || null,
              snippet: r.source || ''
            }))
          }
        } catch (error) {
          console.error(`   ❌ Search failed for ${product.brand}:`, error)
          return {
            brand: product.brand,
            product_type: product.product_type,
            exact_ocr_text: product.exact_ocr_text || '',
            model_number: product.model_number || '',
            confidence: product.confidence || 'medium',
            results: []
          }
        }
      })
    )
    
    // Filter out products with no results
    const successfulSearches = searchResults.filter(s => s.results.length > 0)
    
    if (successfulSearches.length === 0) {
      console.log('   ⚠️  No search results found')
      return NextResponse.json({
        success: false,
        reason: 'No products found in search'
      })
    }
    
    // Step 4: COLOR FILTERING (Detect color for EACH item and filter)
    console.log('\n🎨 Step 4: Per-item color detection and filtering...')
    
    let finalResults = await Promise.all(
      successfulSearches.map(async (productResult: any) => {
        // Detect color of THIS SPECIFIC ITEM in the image
        const itemColor = await detectItemColor(
          imageUrl,
          productResult.product_type,
          productResult.exact_ocr_text || productResult.brand
        )
        
        if (!itemColor) {
          console.log(`   ⚠️  Could not detect color for ${productResult.brand}, skipping color filter`)
          return {
            ...productResult,
            detected_color: null
          }
        }
        
        console.log(`   🔍 Filtering ${productResult.brand} results to match ${itemColor} color...`)
        
        // Filter this product's results by its detected color
        const colorFilteredResults = await filterResultsByColor(
          imageUrl,
          productResult.results,
          itemColor
        )
        
        return {
          ...productResult,
          results: colorFilteredResults,
          detected_color: itemColor  // Include detected color for this item
        }
      })
    )
    
    // Remove products with no color-matching results
    finalResults = finalResults.filter(p => p.results.length > 0)
    
    if (finalResults.length === 0) {
      console.log('   ⚠️  No color-matching results found')
      return NextResponse.json({
        success: false,
        reason: 'No color-matching products found'
      })
    }
    
    console.log(`\n✅ OCR Search Complete: ${finalResults.length} products with color-filtered results`)
    
    return NextResponse.json({
      success: true,
      product_results: finalResults,
      extracted_text: fullText
    })
    
  } catch (error) {
    console.error('❌ OCR search error:', error)
    console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('   Error type:', typeof error)
    console.error('   Error details:', JSON.stringify(error, null, 2))
    
    return NextResponse.json(
      { 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error',
        error_details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    )
  }
}
