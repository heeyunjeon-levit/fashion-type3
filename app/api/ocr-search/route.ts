import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
    
    // Step 1: Use Google Cloud Vision API for accurate OCR
    console.log('\n📖 Step 1: Extracting text with Google Cloud Vision API...')
    
    const visionApiKey = process.env.GCLOUD_API_KEY
    console.log(`   GCLOUD_API_KEY configured: ${visionApiKey ? 'YES' : 'NO'}`)
    console.log(`   OPENAI_API_KEY configured: ${process.env.OPENAI_API_KEY ? 'YES' : 'NO'}`)
    console.log(`   SERPER_API_KEY configured: ${process.env.SERPER_API_KEY ? 'YES' : 'NO'}`)
    
    if (!visionApiKey) {
      console.error('   ❌ GCLOUD_API_KEY not set in environment!')
      return NextResponse.json({
        success: false,
        reason: 'Google Cloud Vision API key not configured in Vercel environment variables'
      }, { status: 500 })
    }
    
    // Download and base64 encode image (same as Modal backend)
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
    console.log(`   ✅ Image downloaded and encoded (${Math.round(base64Image.length / 1024)}KB)`)
    
    // Send to Google Cloud Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: 'TEXT_DETECTION', maxResults: 100 }]
            }
          ]
        })
      }
    )
    
    if (!visionResponse.ok) {
      console.error('   ❌ Vision API error:', visionResponse.status)
      return NextResponse.json({
        success: false,
        reason: 'Google Cloud Vision API request failed'
      }, { status: 500 })
    }
    
    const visionData = await visionResponse.json()
    const textAnnotations = visionData.responses?.[0]?.textAnnotations || []
    
    if (textAnnotations.length === 0) {
      console.log('   ⚠️  No text detected by Google Vision')
      return NextResponse.json({
        success: false,
        reason: 'No text detected in image'
      })
    }
    
    // First annotation is the full text, rest are individual words
    const fullText = textAnnotations[0]?.description || ''
    
    console.log(`   ✅ Extracted text: "${fullText.substring(0, 150)}..."`)
    console.log(`   ✅ Found ${textAnnotations.length} text segments`)
    
    // Step 2: Use GPT-4o to map extracted text to fashion brands/products
    console.log('\n🧠 Step 2: Mapping text to fashion brands with GPT-4o...')
    
    const mappingResponse = await openai.chat.completions.create({
      model: "gpt-4o",
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

Return JSON:
{
  "products": [
    {
      "brand": "BRAND_NAME",
      "exact_ocr_text": "exact product name/description from OCR",
      "product_type": "tops/bottoms/bag/shoes/accessory",
      "model_number": "if visible",
      "confidence": "high/medium/low"
    }
  ]
}

CRITICAL RULES:
- Preserve EXACT Korean text for product names
- Exclude platform brands (Musinsa, Coupang, Instagram, Ably, Kream, Temu)
- Exclude K-pop artists/groups (ILLIT, IVE, aespa, NewJeans, BLACKPINK, TWICE, Stray Kids, BTS, etc.)
- confidence=high if brand name + detailed product info visible
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
    
    // Step 3: Search for each product using Serper
    console.log('\n🔎 Step 3: Searching for products...')
    
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
          const serperResponse = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: query,
              gl: 'us',
              num: 20, // Get more to filter out
            }),
          })
          
          const serperData = await serperResponse.json()
          const organicResults = serperData.organic || []
          
          console.log(`   Found ${organicResults.length} results for ${product.brand}`)
          
          // Filter out blocked domains and non-fashion results
          const filteredResults = organicResults.filter((r: any) => {
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
              title: r.title,
              link: r.link,
              thumbnail: r.thumbnail || null,
              snippet: r.snippet
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
    
    console.log(`\n✅ OCR Search Complete: ${successfulSearches.length} products with results`)
    
    return NextResponse.json({
      success: true,
      product_results: successfulSearches,
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
