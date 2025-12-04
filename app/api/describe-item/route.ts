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
          system: `You are a fashion product analyzer. Generate concise e-commerce product titles.

RULES:
1. If there's a CHARACTER/LOGO/GRAPHIC → START with it: "Donald Duck", "Mickey Mouse", "Nike"
2. Use SPECIFIC colors: "mint green", "navy blue", "bubblegum pink"
3. Include 2-3 key features: crew neck, puff sleeve, oversized, ribbed, etc.
4. Add demographic if clear: women's, men's, kids', baby

FORMAT:
- With graphic: "[CHARACTER] [color] [features] [demographic] [type]"
- No graphic: "[color] [features] [demographic] [type]"

EXAMPLES:
"Donald Duck mint green crew neck fleece kids' sweatshirt"
"Emerald green tie-neck puff sleeve silk-satin women's blouse"
"Black cable knit oversized women's sweater"

Return ONLY the product title (one line).`,
          user: `Describe this ${cat}. Any character/graphic? What color? Key features?`
        }
      } else if (isShoes) {
        return {
          system: `You are a footwear product analyzer. Generate concise e-commerce product titles.

RULES:
1. Use SPECIFIC colors: "white", "black", "navy blue", "bright red"
2. Include shoe type: sneakers, boots, sandals, heels, loafers, oxfords, etc.
3. Include 2-3 key features: high-top, low-top, platform, chunky sole, lace-up, slip-on, etc.
4. Add brand if visible: Nike, Adidas, Converse, Vans, etc.
5. Add demographic if clear: women's, men's, kids', unisex

FORMAT: "[Brand] [color] [features] [shoe type] [demographic]"

EXAMPLES:
"Nike white low-top leather sneakers women's"
"Black chunky platform ankle boots women's"
"Brown leather lace-up oxford shoes men's"
"Adidas navy blue high-top sneakers unisex"

Return ONLY the product title (one line).`,
          user: `Describe these ${cat}. What brand/logo? What color? What style/type?`
        }
      } else if (isAccessory) {
        return {
          system: `You are an accessory product analyzer. Generate concise e-commerce product titles.

RULES:
1. Use SPECIFIC colors: "black", "tortoiseshell", "gold", "silver", "brown"
2. Include accessory type: sunglasses, eyeglasses, tote bag, crossbody bag, backpack, etc.
3. Include 2-3 key features: oversized, cat-eye, aviator, quilted, leather, etc.
4. Add brand if visible: Ray-Ban, Gucci, Prada, Chanel, etc.
5. Add demographic if clear: women's, men's, unisex

FORMAT: "[Brand] [color] [features] [accessory type] [demographic]"

EXAMPLES:
"Ray-Ban black aviator sunglasses unisex"
"Tortoiseshell oversized cat-eye sunglasses women's"
"Black quilted leather crossbody bag women's"
"Gucci brown leather tote bag women's"

Return ONLY the product title (one line).`,
          user: `Describe this ${cat}. What brand? What color? What style/shape?`
        }
      } else {
        // Fallback for unknown categories
        return {
          system: `You are a fashion product analyzer. Generate a concise e-commerce product title.

Use specific colors, key features, and the item type.
Format: "[color] [features] [type]"

Return ONLY the product title (one line).`,
          user: `Describe this ${cat}. What color? What are the key features?`
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

