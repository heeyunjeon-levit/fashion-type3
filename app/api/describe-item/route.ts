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

    // Generate search-optimized description - using system+user message for better accuracy
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Superior vision for character/graphic recognition
      messages: [
        {
          role: 'system',
          content: `You are a fashion product analyzer. Generate concise e-commerce product titles.

CRITICAL RULES:
1. If there's a CHARACTER/LOGO/GRAPHIC visible → START with it first
   Examples: "Donald Duck", "Mickey Mouse", "Winnie the Pooh", "Hello Kitty"
2. Use SPECIFIC color shades: "mint green", "bubblegum pink", "navy blue", "ivory white"
3. Include 2-3 key features: crew neck, puff sleeve, oversized, ribbed, etc.
4. Add demographic if clear: women's, men's, kids', baby

FORMAT:
- With graphic: "[CHARACTER] [color] [features] [demographic] [type]"
- No graphic: "[color] [features] [demographic] [type]"

EXAMPLES:
"Donald Duck mint green crew neck fleece kids' sweatshirt"
"Mickey Mouse ivory white cotton kids' t-shirt"
"Winnie the Pooh bright yellow oversized fleece kids' sweatshirt"
"Emerald green tie-neck puff sleeve silk-satin women's blouse"

Return ONLY the product title (one line).`
        },
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
              text: `Look carefully at this ${category} image. What character/graphic do you see? What is the exact color? Generate the product title following the format.`
            }
          ]
        }
      ],
      max_tokens: 80,
      temperature: 0.0 // Zero temperature for maximum determinism
    })

    const description = response.choices[0]?.message?.content?.trim() || `${category} item`

    console.log(`✅ GPT-4o Description: "${description}"`)
    console.log(`   Prompt tokens: ${response.usage?.prompt_tokens}, Completion tokens: ${response.usage?.completion_tokens}`)

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

