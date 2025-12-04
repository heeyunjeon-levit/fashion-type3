import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, category } = await request.json()

    if (!imageUrl || !category) {
      console.error('❌ Missing required fields:', { imageUrl: !!imageUrl, category: !!category })
      return NextResponse.json(
        { error: 'imageUrl and category are required' },
        { status: 400 }
      )
    }

    console.log(`🤖 Getting GPT-4o-mini description for ${category}...`)
    console.log(`   Image type: ${imageUrl.startsWith('data:') ? 'data URL' : 'HTTP URL'}`)
    console.log(`   Image size: ${Math.round(imageUrl.length / 1024)}KB`)
    
    // Validate data URL format
    if (imageUrl.startsWith('data:')) {
      // Log first 100 chars to debug
      console.log(`   Data URL start: ${imageUrl.substring(0, 100)}`)
      
      const mimeMatch = imageUrl.match(/^data:([^;]+);base64,/)
      if (!mimeMatch) {
        console.error('❌ Invalid data URL format - missing MIME type or base64 prefix')
        console.error(`   Received format: ${imageUrl.substring(0, 200)}`)
        return NextResponse.json(
          { error: 'Invalid data URL format' },
          { status: 400 }
        )
      }
      const mimeType = mimeMatch[1]
      if (!mimeType.startsWith('image/')) {
        console.error(`❌ Invalid MIME type: ${mimeType} (expected image/*)`)
        return NextResponse.json(
          { error: `Invalid MIME type: ${mimeType}` },
          { status: 400 }
        )
      }
      // Check if data URL has actual content
      const base64Part = imageUrl.split(',')[1]
      if (!base64Part || base64Part.length < 100) {
        console.error(`❌ Data URL appears empty or too small: ${base64Part?.length || 0} chars`)
        return NextResponse.json(
          { error: 'Data URL appears empty - cropping may have failed due to CORS' },
          { status: 400 }
        )
      }
      console.log(`   ✅ Valid data URL: ${mimeType}, ${Math.round(base64Part.length / 1024)}KB base64`)
    }

    // Generate search-optimized description matching Net-A-Porter/luxury e-commerce format
    const prompt = `You are analyzing a ${category} image. Describe it EXACTLY like a product title on Net-A-Porter, Nordstrom, or Zara.

🎯 EXACT FORMAT TO MATCH:
"[Key Features] [Material] [Item Type]"

REAL EXAMPLES from shopping sites:
- Net-A-Porter: "Tie-neck draped gathered silk satin-twill blouse"
- Zara: "Puff sleeve ribbed knit sweater" 
- Musinsa: "Oversized Mickey graphic fleece sweatshirt"
- Nordstrom: "High-waist wide leg denim jeans"

YOUR OUTPUT MUST MATCH THIS STYLE:
✅ Start with KEY DESIGN FEATURES (tie-neck, puff sleeve, oversized, high-waist, etc.)
✅ Add MATERIAL if visible (silk, cotton, denim, fleece, wool, ribbed knit, etc.)
✅ End with ITEM TYPE (blouse, sweater, jeans, dress, etc.)
✅ Add DEMOGRAPHIC as prefix if clear (women's/men's/kids'/baby)
✅ Include SPECIFIC COLOR as prefix (emerald green, dusty rose, navy blue, etc.)

CRITICAL RULES:
1. 🎨 SPECIFIC COLOR - "emerald green" not "green", "dusty rose" not "pink", "ivory" not "white"
2. 🔍 INDUSTRY TERMS ONLY:
   - Necklines: tie-neck, pussy bow, keyhole, crew neck, V-neck, turtleneck
   - Sleeves: puff sleeve, bishop sleeve, bell sleeve, cap sleeve, raglan
   - Details: gathered, draped, pleated, ruched, ribbed, cable knit
   - Fit: oversized, fitted, relaxed, tailored, wide-leg, flared, slim-fit
   - Closures: tie-neck, button-front, zip-up, snap-button
3. 👥 DEMOGRAPHIC if obvious (baby has onesies/snaps, kids 3-12, women's/men's based on cut)
4. ✨ 2-4 KEY FEATURES max - don't overload
5. 📦 ONE LINE - no paragraphs, no flowery language

EXAMPLES:
Green Gucci blouse → "Emerald green tie-neck draped puff sleeve silk-satin women's blouse"
Pink Disney sweatshirt → "Bubblegum pink Winnie the Pooh graphic oversized fleece sweatshirt"  
Navy sweater → "Navy blue cable knit crew neck ribbed men's sweater"
Kids tee → "Bright yellow Mickey Mouse graphic cotton kids' t-shirt"
Baby onesie → "White teddy bear appliqué snap-closure cotton baby onesie"

❌ AVOID: "sophisticated", "versatile", "finds sweet spot", "exudes", "perfect for", "occasions"
✅ USE: Concrete, searchable keywords that match product listings

Return ONE concise line matching e-commerce product title format.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Same as Modal
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl // Accepts both HTTP URLs and data URLs
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      max_tokens: 80, // One keyword-dense line (not paragraphs)
      temperature: 0.1 // Very low for consistent, accurate descriptions
    })

    const description = response.choices[0]?.message?.content?.trim() || `${category} item`

    console.log(`✅ Description: ${description.substring(0, 60)}...`)

    return NextResponse.json({
      description,
      category,
      usage: response.usage
    })

  } catch (error: any) {
    console.error('❌ GPT-4o-mini description error:', error)
    console.error('   Error type:', error.constructor.name)
    console.error('   Error message:', error.message)
    console.error('   Stack:', error.stack?.substring(0, 300))
    return NextResponse.json(
      { 
        error: error.message || 'Description failed',
        errorType: error.constructor.name
      },
      { status: 500 }
    )
  }
}

