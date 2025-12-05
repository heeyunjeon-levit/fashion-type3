import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, ThinkingLevel } from '@google/genai'

// Use dedicated Gemini API key (project-specific, not gcloud)
const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GCLOUD_API_KEY || ''
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

    console.log(`🤖 Getting Gemini 3 Pro Preview description for ${category}...`)
    console.log(`   Model: gemini-3-pro-preview (most intelligent model!)`)
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
1. Check for TEXT/WRITING/LOGOS first (CRITICAL):
   - Look carefully for any text, letters, words, or logos printed/embroidered on the garment
   - Check shoulders, chest, sleeves, neckline, hem areas
   - If text is readable → include the actual text in quotes: "with 'PARIS' print near shoulder"
   - If text is NOT readable → just mention it: "with text print near shoulder"
   - Note the location: near shoulder, on chest, near neckline, on sleeve, at hem
2. Identify exact color: navy blue vs black, ivory vs white, charcoal vs black
3. Identify fabric/material (CRITICAL):
   - Blazers/jackets: wool, wool-silk blend, worsted wool, tweed, cashmere, polyester-blend
   - Blouses/shirts: silk, cotton, linen, satin, chiffon, silk-satin
   - Knitwear: cashmere, wool, cotton, merino, cable knit
   - Dresses/skirts: silk, satin, crepe, wool, cotton
4. Look for decorative details: brooches/pins/ornaments, embellishments, ruffles, pleats
5. Note construction: neckline, sleeves, fit, button style

FORMAT (output this ONLY):
- With text/logo: "[color] [material] [features] [demographic] [type] with '[text]' print [location]"
  (If text is readable → include the actual text. Location: near shoulder/chest/neckline/hem)
- With character graphic: "[CHARACTER] [color] [material] [features] [demographic] [type]"
- Formal items: "[color] [fabric/material] [features] [demographic] [type]"
- Casual items: "[color] [material] [features] [demographic] [type]"

KEY DETAILS TO INCLUDE (in order of priority):
1. Text/writing/logos printed or embroidered on the garment (FIRST)
2. Color (precise shade)
3. Fabric/material (wool, silk, cotton, cashmere, etc.) - ESPECIALLY for blazers, blouses, dresses
4. Decorative elements: brooches, pins, ornaments, rhinestones, pearls
5. Texture: ruffles, pleats (horizontal/vertical), draping, ruching
6. Construction: button style (single-button, double-breasted), neckline, sleeves

EXAMPLES (notice text location details):
"Charcoal grey cotton off-shoulder long sleeve ruched women's mini dress with text print near shoulder"
"Black cotton crew neck women's t-shirt with 'PARIS' print on chest"
"Donald Duck mint green cotton crew neck fleece kids' sweatshirt"
"Navy blue wool-silk blend single-button brooch detail ruffle lapel women's blazer"
"Emerald green silk-satin tie-neck puff sleeve draped women's blouse"
"Black wool crepe horizontal pleated high-waist women's midi skirt"

CRITICAL - OUTPUT FORMAT:
❌ DO NOT write "There is no visible text..."
❌ DO NOT write "The fabric appears to be..."
❌ DO NOT output any reasoning, explanations, or thinking process
❌ DO NOT output "Step 1", "Step 2", or "Product title:"
❌ DO NOT skip text/writing/logos visible on the garment
❌ DO NOT skip fabric/material for formal items

✅ OUTPUT ONLY THE PRODUCT TITLE
✅ Just one line
✅ No preamble, no explanation, no reasoning

YOUR ENTIRE RESPONSE SHOULD BE EXACTLY ONE LINE - THE PRODUCT TITLE.

Return ONLY the product title.`,
          user: `Look VERY carefully at this ${cat} for any text, letters, words, or small prints (check shoulders, neckline, chest, sleeves carefully). Then generate ONLY the product title. No explanations, just the title.`
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
    
    // Prepare image data for new SDK
    if (!imageUrl.startsWith('data:')) {
      throw new Error('HTTP URLs not yet supported with Gemini - please use data URLs')
    }
    
    // Data URL - extract base64 and MIME type
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      throw new Error('Invalid data URL format')
    }
    
    const mimeType = match[1]
    const base64Data = match[2]

    // Combine system + user prompts for Gemini (no separate system message)
    // Add explicit OCR instruction
    const ocrInstruction = `CRITICAL: First, perform OCR (Optical Character Recognition) on this image. Look for ANY text, letters, words, numbers, or small prints ANYWHERE on the garment - especially on shoulders, neckline, chest, sleeves, hem. If you find ANY text, you MUST include it in the product title.\n\n`
    const fullPrompt = `${ocrInstruction}${promptConfig.system}\n\n${promptConfig.user}`

    // Use NEW SDK with proper thinking control
    console.log(`   Using NEW @google/genai SDK with thinkingLevel: "low"`)
    
    const result = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: fullPrompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      config: {
        maxOutputTokens: 200,
        temperature: 1.0,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW // CRITICAL: Prevents spending all tokens on thinking
        }
      }
    })

    // NEW SDK returns text directly
    const description = result.text?.trim() || `${category} item`
    const usageMetadata = result.usageMetadata as any
    const finishReason = result.candidates?.[0]?.finishReason || 'unknown'
    
    // Log response for debugging
    console.log('🔍 NEW SDK Response:')
    console.log(`   Text: "${description}"`)
    console.log(`   FinishReason: ${finishReason}`)
    console.log(`   Thinking tokens: ${usageMetadata?.thoughtsTokenCount || 0}`)
    
    console.log(`✅ Gemini 3 Pro Preview Description: "${description}"`)
    console.log(`   Prompt tokens: ${usageMetadata?.promptTokenCount || 0}`)
    console.log(`   Completion tokens: ${usageMetadata?.candidatesTokenCount || 0}`)
    console.log(`   Thoughts tokens: ${(usageMetadata as any)?.thoughtsTokenCount || 0}`)
    console.log(`   Total tokens: ${usageMetadata?.totalTokenCount || 0}`)
    
    // Warn if no completion tokens (API timeout or error)
    if (!usageMetadata?.candidatesTokenCount || usageMetadata.candidatesTokenCount === 0) {
      console.warn('⚠️ No completion tokens generated - possible causes:')
      console.warn('   1. Model using cached response')
      console.warn('   2. Token counting not implemented for this model')
      console.warn('   3. API returned empty response (using fallback)')
      console.warn(`   4. Description length: ${description.length} chars`)
      
      // Check if description is just the fallback
      if (description === `${category} item`) {
        console.error('❌ Description is fallback value - API returned empty!')
      }
    }

    return NextResponse.json({
      description,
      category,
      usage: {
        prompt_tokens: usageMetadata?.promptTokenCount || 0,
        completion_tokens: usageMetadata?.candidatesTokenCount || 0,
        total_tokens: usageMetadata?.totalTokenCount || 0
      }
    })

  } catch (error: any) {
    console.error('❌ Gemini 3 Pro Preview description error:', error)
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

