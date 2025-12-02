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
    if (!visionApiKey) {
      return NextResponse.json({
        success: false,
        reason: 'Google Cloud Vision API key not configured'
      }, { status: 500 })
    }
    
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [{ type: 'TEXT_DETECTION', maxResults: 50 }]
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
          role: "user",
          content: `OCR extracted text from a fashion image:
"${fullText}"

Analyze this text and identify FASHION brands and products ONLY.

🚨 CRITICAL FILTERS - DO NOT INCLUDE:
- K-pop groups/artists: ILLIT, IVE, aespa, NewJeans, BLACKPINK, TWICE, etc.
- Music: song titles, artist names, album names
- Social media: usernames, handles, captions, hashtags
- General text: random words that aren't brand names

✅ ONLY INCLUDE:
- Real fashion brand names (Zara, Gucci, Nike, Uniqlo, H&M, etc.)
- Only if confident the text refers to a clothing/fashion brand

Return JSON:
{
  "products": [
    {
      "brand": "BrandName",
      "product_type": "coat/dress/shoes/bag/etc",
      "confidence": "high/medium/low"
    }
  ]
}

If NO fashion brands found, return empty products array: {"products": []}`
        }
      ],
      max_tokens: 500,
      temperature: 0.2,
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
    
    const products = parsed.products || []
    
    if (products.length === 0) {
      console.log('   ⚠️  No fashion products identified')
      return NextResponse.json({
        success: false,
        reason: 'No fashion brands detected in extracted text',
        extracted_text: fullText
      })
    }
    
    console.log(`   ✅ Identified ${products.length} product(s):`, products.map((p: any) => `${p.brand} ${p.product_type}`).join(', '))
    
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
        const query = `${product.brand} ${product.product_type} buy online shop`
        console.log(`   Searching: ${query}`)
        
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
            description: product.description || '',
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
            description: product.description || '',
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
    return NextResponse.json(
      { 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
