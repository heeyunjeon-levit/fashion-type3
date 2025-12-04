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

    // Generate search-optimized description (keyword-dense for e-commerce matching)
    const prompt = `You are analyzing a ${category} image for product search. Describe it EXACTLY as it appears, using e-commerce terminology.

🎯 FORMAT (keyword-dense like product titles):
"[Specific Color] [Material] [Demographic] [Item Type] - [Key Design Features], [Fit/Silhouette]"

CRITICAL RULES:
1. 🎨 COLOR FIRST - Be specific: "emerald green" not just "green", "dusty rose" not "pink", "cream" not "white"
2. 👥 DEMOGRAPHIC - women's, men's, kids', or baby (look at cut, sizing, styling cues)
3. 🔍 USE INDUSTRY TERMS - pussy bow, bishop sleeves, keyhole back, ribbed cuffs, flared leg, etc.
4. ✨ DESIGN FEATURES - List 2-4 distinctive elements (tie-neck, puff sleeves, rhinestone details, etc.)
5. 📏 FIT/SILHOUETTE - oversized, fitted, relaxed, tailored, flared, wide-leg, etc.

EXAMPLES (study the format):
1. Gucci blouse → "Emerald green silk-satin women's blouse - pussy bow tie-neck, dramatic puff sleeves, keyhole back with button, gathered details, oversized fit"

2. Pink Disney sweatshirt → "Bubblegum pink fleece women's sweatshirt - Winnie the Pooh graphic print, crew neck, dropped shoulders, ribbed cuffs, oversized relaxed fit"

3. Blue wide-leg jeans → "Medium wash denim women's jeans - high-waisted, wide flared leg, vintage style, button fly, classic 5-pocket"

4. Navy knit sweater → "Navy blue wool-blend men's jumper - cable knit texture, crew neck, ribbed cuffs and hem, fitted silhouette"

5. Yellow kids tee → "Bright yellow cotton kids' t-shirt - Mickey Mouse graphic, crew neck, short sleeves, sized 3-12 years, regular fit"

WHAT TO AVOID:
❌ Generic words: "nice", "beautiful", "sophisticated", "versatile"
❌ Vague colors: "dark", "light" (be specific!)
❌ Editorial language: "finds the sweet spot", "exudes elegance"
❌ Unnecessary details: fabric care, occasion suggestions

WHAT TO INCLUDE:
✅ Exact color shade (kelly green, dusty rose, cream, charcoal)
✅ Material if visible (silk, cotton, denim, fleece, wool, leather)
✅ Specific design terms (pussy bow, keyhole, puff sleeve, ribbed, flared)
✅ Prints/graphics (Mickey Mouse, floral, striped, polka dot)
✅ Fit descriptor (oversized, fitted, wide-leg, relaxed, tailored)

Return ONE line in the format shown above. Be specific and keyword-rich.`

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

