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

    // Generate search-optimized description - using GPT-4o for superior vision + instruction following
    const prompt = `Analyze this ${category} image and generate ONE concise product title.

CRITICAL: Look carefully at what's actually in the image. Describe ONLY what you see.

🚨 RULE #1: If there's a CHARACTER, LOGO, or GRAPHIC → START WITH IT!
Examples: "Donald Duck", "Mickey Mouse", "Winnie the Pooh", "Hello Kitty", "Nike", "Adidas"

🎨 RULE #2: Use SPECIFIC color shades
"mint green" not "green", "bubblegum pink" not "pink", "navy blue" not "blue"

FORMAT:
- With graphic: "[CHARACTER] [specific color] [2-3 features] [demographic] [type]"
- No graphic: "[specific color] [2-3 features] [demographic] [type]"

EXAMPLES:
"Donald Duck mint green crew neck fleece kids' sweatshirt"
"Winnie the Pooh bubblegum pink oversized fleece women's sweatshirt"
"Mickey Mouse bright yellow cotton kids' t-shirt"
"Minnie Mouse baby pink crew neck cotton kids' sweatshirt"
"Emerald green tie-neck puff sleeve silk-satin women's blouse"
"Chocolate brown balaclava hood quilted down women's jacket"

Return ONLY the product title (one line, no explanations, no section headers).`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Upgraded from gpt-4o-mini for much better vision + instruction following
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

