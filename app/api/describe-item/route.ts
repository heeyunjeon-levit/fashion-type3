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

    // Generate detailed description using GPT-4o-mini
    const prompt = `You are a fashion expert analyzing a cropped image of a ${category}.

CRITICAL: Look carefully at the ACTUAL item in the image. Describe ONLY what you see.

Describe in 2-3 sentences including:
1. PRIMARY COLOR (be accurate - if it's pink, say pink; if white, say white; if multicolored, say multicolored)
2. Target demographic (women's, men's, kids', or baby - based on style, cut, and design)
   - Baby: 0-2 years (onesies, soft fabrics, snap closures, very small sizes)
   - Kids: 3-12 years (like mini adult clothes, larger sizes than baby)
3. Key visual features (patterns, graphics, text, logos, character prints, etc.)
4. Design details & embellishments:
   - Trim details (feather trim, lace trim, piping, etc.)
   - Embellishments (rhinestones, sequins, beading, embroidery, appliqué)
   - Texture details (ribbed knit, cable knit, quilted, pleated, ruched)
   - Closure details (buttons, zippers, ties, drawstrings)
   - Neckline/collar details (V-neck, crew neck, turtleneck, ruffle collar)
   - Sleeve details (puff sleeves, bell sleeves, cuffed, rolled)
5. Style/type (casual, formal, athletic, oversized, fitted, etc.)

Examples:
- "A pink women's casual sweatshirt featuring a large Winnie the Pooh character graphic on the front. The oversized, relaxed fit design is made from soft fleece material with ribbed cuffs and hem."
- "A navy men's ribbed knit jumper with crew neck and cable knit texture throughout. Features tonal feather trim at cuffs and a fitted silhouette."
- "A yellow kids' t-shirt with colorful cartoon character prints on the front. The short-sleeve crew neck design has contrast stitching and is sized for children aged 3-12."
- "A white baby onesie with soft cotton fabric and snap closures at the crotch. Features a cute teddy bear appliqué and delicate lace trim at the neckline, designed for infants 0-24 months."
- "A black women's evening top with rhinestone flower details across the shoulders. The fitted silhouette features sheer mesh panels and a back zipper closure."

Be concise and accurate. Return ONLY the description text.`

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
      max_tokens: 100, // Shorter, more focused descriptions
      temperature: 0.2 // Lower temperature for more accurate color recognition
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

