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

ANALYSIS (internal reasoning only, do NOT output this):
1. Identify exact color: navy blue vs black, ivory vs white, charcoal vs black
2. Look for decorative details: brooches/pins/ornaments, embellishments, ruffles, pleats
3. Note construction: neckline, sleeves, fit, button style

FORMAT (output this ONLY):
- With graphic/character: "[CHARACTER] [color] [features] [demographic] [type]"
- No graphic: "[color] [features] [demographic] [type]"

KEY DETAILS TO INCLUDE:
- Color (precise shade)
- Decorative elements: brooches, pins, ornaments, rhinestones, pearls, sequins
- Texture details: ruffles, pleats (horizontal/vertical), draping, ruching
- Construction: button style, neckline, sleeves, fit
- Trim: feather, lace, fur, fringe

EXAMPLES (output format - copy this):
"Donald Duck mint green crew neck fleece kids' sweatshirt"
"Navy blue single button brooch detail ruffle lapel women's blazer"
"Emerald green tie-neck puff sleeve draped silk-satin women's blouse"
"Black horizontal pleated high-waist women's midi skirt"
"Ivory white lace trim puff sleeve women's blouse"

CRITICAL:
❌ DO NOT output "Step 1", "Step 2", or thinking process
❌ DO NOT output "Product title:"
✅ Output ONLY the product title (one line)

Return ONLY the product title.`,
          user: `Analyze this ${cat} and generate the product title.`
        }
      } else       if (isShoes) {
        return {
          system: `Generate a product title for footwear in e-commerce format.

ANALYSIS (internal only, do NOT output):
1. Identify exact color: navy vs black, beige vs tan vs camel, white vs cream vs ivory
2. Check for brand/logo visibility
3. Identify material: leather, suede, canvas, mesh, etc.
4. Note features: chunky sole, platform, lace-up, slip-on, high-top, low-top

FORMAT (output this ONLY):
"[color] [material] [features] [shoe type] [demographic]"
If brand visible: "[Brand] [color] [features] [shoe type] [demographic]"

EXAMPLES (copy this format):
"Nike white low-top leather sneakers women's"
"Navy blue suede chunky sole sneakers women's"
"Light brown suede lace-up sneakers unisex"
"Beige canvas slip-on sneakers men's"

CRITICAL:
❌ NO "Step 1", "Step 2", or thinking process in output
❌ NO "I cannot determine..." or explanations
✅ Output ONLY the product title (one line)

Return ONLY the product title.`,
          user: `Analyze these ${cat} and generate the product title.`
        }
      } else if (isAccessory) {
        return {
          system: `Generate a product title for accessories in e-commerce format.

ANALYSIS (internal only, do NOT output):
1. Identify exact color: navy vs black, gold vs rose gold vs silver, tortoiseshell vs brown
2. Check for brand/logo visibility
3. For sunglasses: note frame shape (aviator, cat-eye, rectangular, round, oversized)
4. For bags: note style (crossbody, tote, clutch, backpack) and features (quilted, chain strap)

FORMAT (output this ONLY):
"[color] [material] [frame shape/style] [accessory type] [demographic]"
If brand visible: "[Brand] [color] [frame shape/style] [accessory type] [demographic]"

EXAMPLES (copy this format):
"Ray-Ban black aviator sunglasses unisex"
"Gold metal rectangular frame sunglasses women's"
"Tortoiseshell oversized cat-eye sunglasses women's"
"Navy blue quilted leather crossbody bag women's"

CRITICAL:
❌ NO "Step 1", "Step 2", or thinking process in output
❌ NO "I cannot determine..." or explanations
✅ Output ONLY the product title (one line)

Return ONLY the product title.`,
          user: `Analyze this ${cat} and generate the product title.`
        }
      } else {
        // Fallback for unknown categories
        return {
          system: `Generate a product title in e-commerce format.

ANALYSIS (internal only, do NOT output):
1. Identify exact color and shade
2. Note key features and materials
3. Identify item type

FORMAT (output this ONLY):
"[color] [key features] [item type]"

EXAMPLES (copy this format):
"Black leather quilted crossbody bag"
"Navy blue striped cotton scarf"

CRITICAL:
❌ NO "Step 1", "Step 2", or thinking process in output
❌ NO explanations or sentences
✅ Output ONLY the product title (one line)

Return ONLY the product title.`,
          user: `Analyze this ${cat} and generate the product title.`
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

