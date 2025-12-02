import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    console.log('\n🔍 OCR SEARCH REQUEST (Next.js Direct)')
    
    const { imageUrl } = await request.json()
    
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, reason: 'No image URL provided' },
        { status: 400 }
      )
    }
    
    console.log(`   Image URL: ${imageUrl.substring(0, 80)}...`)
    
    // Step 1: Use GPT-4o Vision to extract text AND identify products
    console.log('\n📖 Step 1: Extracting text with GPT-4o Vision...')
    
    const ocrResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and extract ALL visible text (brand names, product names, labels, tags, etc.).

Then, identify what fashion products are shown and which brands they belong to.

Return a JSON object with this structure:
{
  "extracted_text": "all visible text here...",
  "products": [
    {
      "brand": "Brand Name",
      "product_type": "coat/dress/shoes/etc",
      "description": "brief description of the item",
      "confidence": "high/medium/low"
    }
  ]
}

IMPORTANT: Only include products where you can clearly see the brand name or logo in the image.`
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    })
    
    const ocrResult = ocrResponse.choices[0]?.message?.content
    
    if (!ocrResult) {
      console.log('   ⚠️  No OCR result from GPT')
      return NextResponse.json({
        success: false,
        reason: 'Failed to extract text from image'
      })
    }
    
    console.log(`   ✅ GPT-4o response:`, ocrResult.substring(0, 200))
    
    // Parse JSON from GPT response
    let parsed
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = ocrResult.match(/```json\n([\s\S]*?)\n```/) || ocrResult.match(/```\n([\s\S]*?)\n```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : ocrResult
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      console.error('   ❌ Failed to parse JSON:', e)
      return NextResponse.json({
        success: false,
        reason: 'Failed to parse OCR results'
      })
    }
    
    const products = parsed.products || []
    
    if (products.length === 0) {
      console.log('   ⚠️  No products identified')
      return NextResponse.json({
        success: false,
        reason: 'No products identified in image',
        extracted_text: parsed.extracted_text
      })
    }
    
    console.log(`   ✅ Identified ${products.length} product(s):`, products.map((p: any) => `${p.brand} ${p.product_type}`).join(', '))
    
    // Step 2: Search for each product using Serper
    console.log('\n🔎 Step 2: Searching for products...')
    
    const searchResults = await Promise.all(
      products.map(async (product: any) => {
        const query = `${product.brand} ${product.product_type} buy online`
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
              num: 10,
            }),
          })
          
          const serperData = await serperResponse.json()
          const organicResults = serperData.organic || []
          
          console.log(`   Found ${organicResults.length} results for ${product.brand}`)
          
          return {
            brand: product.brand,
            product_type: product.product_type,
            description: product.description,
            results: organicResults.slice(0, 5).map((r: any) => ({
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
            description: product.description,
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
      extracted_text: parsed.extracted_text
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

