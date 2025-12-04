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

    // Category-specific prompt templates
    const getCategoryPrompt = (cat: string) => {
      const isClothing = ['shirt', 'sweater', 'hoodie', 'sweatshirt', 'jacket', 'coat', 'dress', 'pants', 'jeans', 'shorts', 'skirt', 'top', 'bottom'].includes(cat)
      const isShoes = cat === 'shoes' || cat === 'sneakers' || cat === 'boots'
      const isAccessory = ['sunglasses', 'glasses', 'bag', 'handbag', 'backpack', 'watch', 'hat', 'scarf', 'belt'].includes(cat)
      
      if (isClothing) {
        return {
          system: `Generate a product title for clothing in e-commerce format.

FORMAT:
- With graphic/character: "[CHARACTER] [color] [features] [demographic] [type]"
- No graphic: "[color] [features] [demographic] [type]"

CRITICAL:
- NO explanations, NO sentences, ONLY the product title
- If there's a character/graphic → START with it
- If no character → just start with color
- NEVER say "No character or graphic" in the output

EXAMPLES (copy this format exactly):
"Donald Duck mint green crew neck fleece kids' sweatshirt"
"Mickey Mouse ivory white cotton kids' t-shirt"
"Emerald green tie-neck puff sleeve silk-satin women's blouse"
"Black cable knit oversized women's sweater"
"Charcoal gray off-shoulder long sleeve ruched women's mini dress"

WRONG (never do this):
❌ "No character or graphic. Charcoal gray..."
❌ "This is a black sweater with..."

Return ONLY the product title.`,
          user: `Generate product title for this ${cat}.`
        }
      } else       if (isShoes) {
        return {
          system: `Generate a product title for footwear in e-commerce format.

FORMAT: "[color] [material] [features] [shoe type] [demographic]"
If brand visible: "[Brand] [color] [features] [shoe type] [demographic]"

CRITICAL:
- NO explanations, NO sentences, ONLY the product title
- If you can't see the brand → skip it, don't say "I cannot determine"
- If color is unclear → use best guess (white, black, brown, etc.)

EXAMPLES (copy this format exactly):
"Nike white low-top leather sneakers women's"
"Black chunky platform ankle boots women's"
"Light brown suede lace-up sneakers unisex"
"Navy blue canvas slip-on sneakers men's"

WRONG (never do this):
❌ "The shoes are light brown... The brand is not visible..."
❌ "I cannot determine the brand..."

Return ONLY the product title.`,
          user: `Generate product title for these ${cat}.`
        }
      } else if (isAccessory) {
        return {
          system: `Generate a product title for accessories in e-commerce format.

FORMAT: "[color] [material] [frame shape] [accessory type] [demographic]"
If brand visible: "[Brand] [color] [frame shape] [accessory type] [demographic]"

CRITICAL:
- NO explanations, NO sentences, ONLY the product title
- If you can't see the brand → skip it, don't say "I cannot determine"
- For sunglasses: describe frame color, shape (aviator, cat-eye, rectangular, round, oversized)

EXAMPLES (copy this format exactly):
"Ray-Ban black aviator sunglasses unisex"
"Gold metal rectangular frame sunglasses women's"
"Tortoiseshell oversized cat-eye sunglasses women's"
"Black quilted leather crossbody bag women's"

WRONG (never do this):
❌ "I cannot determine the brand... The sunglasses appear to be..."
❌ "The frame is gold metal..."

Return ONLY the product title.`,
          user: `Generate product title for this ${cat}.`
        }
      } else {
        // Fallback for unknown categories
        return {
          system: `Generate a product title in e-commerce format.

FORMAT: "[color] [key features] [item type]"

CRITICAL:
- NO explanations, NO sentences, ONLY the product title
- Use specific colors and 2-3 key features

EXAMPLES:
"Black leather quilted crossbody bag"
"Navy blue striped cotton scarf"

Return ONLY the product title.`,
          user: `Generate product title for this ${cat}.`
        }
      }
    }
    
    const promptConfig = getCategoryPrompt(category)
    
    // Generate search-optimized description - using category-specific prompts
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', // Latest mini model with better instruction following
      messages: [
        {
          role: 'system',
          content: promptConfig.system
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
              text: promptConfig.user
            }
          ]
        }
      ],
      max_tokens: 80,
      temperature: 0.0 // Zero temperature for maximum determinism
    })

    const description = response.choices[0]?.message?.content?.trim() || `${category} item`

    console.log(`✅ GPT-4o-mini Description: "${description}"`)
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

