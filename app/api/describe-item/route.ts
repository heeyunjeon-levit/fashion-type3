import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for AI description (Gemini can be slow)

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

    // Category-specific prompt templates (NOW unified JSON schema)
    const getCategoryPrompt = (cat: string) => {
      const isClothing = ['shirt', 'sweater', 'hoodie', 'sweatshirt', 'jacket', 'coat', 'dress', 'pants', 'jeans', 'shorts', 'skirt', 'top', 'bottom'].includes(cat)
      const isShoes = cat === 'shoes' || cat === 'sneakers' || cat === 'boots'
      const isAccessory = ['sunglasses', 'glasses', 'bag', 'handbag', 'backpack', 'watch', 'hat', 'scarf', 'belt'].includes(cat)

      const unifiedSchemaPrompt = `
You are a fashion attribute extractor for e-commerce search.

Given a single product image and its rough category, output a SINGLE LINE of valid JSON with these fields:

{
  "product_group": "...",      // "clothing", "shoes", "accessory", or "other"
  "category": "...",           // e.g. "shirt", "sweater", "hoodie", "jeans", "dress", "sneakers", "boots", "bag", "sunglasses", "hat"
  "gender": "...",             // "womens", "mens", "kids", "unisex", or "unknown",

  "primary_color": "...",      // one of: black, white, ivory, beige, grey, navy, blue, brown, green, red, pink, yellow, purple, other
  "secondary_color": "...",    // same list or "none",

  "has_text_or_logo": true,
  "text_readable": true,
  "text_content": "...",       // exact text if readable, else ""
  "text_position": "...",      // "chest", "shoulder", "sleeve", "front", "back", "none",

  "material_family": "...",    // broad bucket: "cotton", "denim", "knit", "wool", "leather", "suede", "canvas", "mesh", "polyester", "metal", "plastic", "unknown",

  "silhouette": ["..."],       // clothing: ["cropped", "oversized", "slim", "wide-leg", "mini", "midi", "maxi"]
                               // shoes: ["chunky", "platform", "pointed-toe", "round-toe", "high-top", "low-top"]
                               // accessories: ["oversized", "thin", "wide-brim"], etc.

  "key_details": ["..."],      // e.g. ["crew neck", "double-breasted", "puff sleeves", "ruffle hem", "quilted", "chain strap", "pearl buttons", "horn buttons", "gold buttons"], [] if none,

  "formality": "...",          // "casual", "smart casual", "formal", "sportswear", "unknown",

  "shoe_specific": {
    "type": "...",             // e.g. "sneakers", "boots", "heels", "loafers", or "none"
    "heel_height": "...",      // "flat", "low", "mid", "high", "unknown"
    "closure": "..."           // "lace-up", "slip-on", "strap", "zip", "unknown"
  },

  "accessory_specific": {
    "type": "...",             // e.g. "sunglasses", "bag", "hat", "belt", "scarf", or "none"
    "frame_shape": "...",      // for glasses: "aviator", "cat-eye", "round", "rectangular", "square", "oval", "unknown"
    "bag_style": "...",        // for bags: "crossbody", "tote", "backpack", "clutch", "shoulder", "mini bag", "unknown"
    "metal_color": "..."       // "gold", "silver", "rose gold", "none", "unknown"
  },

  "ecom_title": "..."          // final product title in ecommerce format
}

Rules:
- If you are NOT reasonably sure about a field, use "unknown", "none", false, or [] instead of guessing.
- Prefer broad, safe "material_family" over specific blends. Do NOT invent things like "wool-silk blend" unless obvious.
- "ecom_title" should be a natural product title that includes:
  - color
  - material_family (if not "unknown")
  - 1–3 key details (neckline, button style/material, sole/heel type, frame shape, strap type, etc.)
  - gender (if clear)
  - category.
- CRITICAL: Include distinctive button details in title when visible (e.g., "pearl button", "horn button", "gold button").
- If you detect any printed text or logo, put the exact text in "text_content" AND also reflect it in "ecom_title" in quotes.

Output:
- Return ONLY valid JSON (single-line or multi-line is fine)
- NO extra text before or after the JSON
- NO markdown code blocks
`.trim()

      if (isClothing) {
        return {
          system: `
${unifiedSchemaPrompt}

ADDITIONAL CLOTHING ANALYSIS (internal only, do NOT output):
🔴 **BUTTON DETAILS - TOP PRIORITY**:
Look at buttons carefully. Identify material (pearl/shell, horn, metal, plastic) and count them.
Add to key_details: e.g., "6 pearl buttons", "horn buttons", "metal buttons"
Quick ID guide: pearl=iridescent sheen, horn=matte brown, metal=shiny gold/silver

Then:
- neckline (crew neck, v-neck, turtleneck, shirt collar, etc.)
  - sleeve length (short, long, sleeveless)
  - length (cropped, regular, longline, mini/midi/maxi for dresses/skirts)
- fit (oversized, relaxed, slim)
- Look for printed text or logos (chest, shoulder, sleeves)
- If fabric is ambiguous, use "unknown" instead of guessing

For clothing, set:
- "product_group": "clothing"
- "category": one of: "shirt", "sweater", "hoodie", "sweatshirt", "jacket", "coat", "dress", "pants", "jeans", "shorts", "skirt", "top", "bottom".
`.trim(),
          user: `Analyze this ${cat} image and return the JSON object with all fields populated. Output only valid JSON.`
        }
      } else if (isShoes) {
        return {
          system: `
${unifiedSchemaPrompt}

ADDITIONAL SHOES ANALYSIS (internal only, do NOT output):
- Identify shoe type: sneakers, boots, heels, loafers, sandals, etc.
- Look at:
  - overall height (high-top vs low-top, ankle boot vs knee boot)
  - heel height (flat / low / mid / high)
  - closure type (lace-up, slip-on, strap, zip).
- Pay attention to "material_family": leather, suede, canvas, mesh, knit, etc.

For shoes, set:
- "product_group": "shoes"
- "shoe_specific.type": the shoe type
- "category": same as the main type, e.g. "sneakers", "boots", "heels".
`.trim(),
          user: `Analyze this ${cat} image and return the JSON object with all fields populated. Output only valid JSON.`
        }
      } else if (isAccessory) {
        return {
          system: `
${unifiedSchemaPrompt}

ADDITIONAL ACCESSORY ANALYSIS (internal only, do NOT output):
- If sunglasses/glasses:
  - frame_shape: aviator, cat-eye, rectangular, round, oversized, etc.
- If bag:
  - bag_style: crossbody, tote, backpack, clutch, shoulder, mini bag, etc.
  - note quilted surfaces, chain straps, top-handle vs long strap.
- If belt/hat/scarf/watch:
  - focus on width/shape, metal color, pattern, etc.

For accessories, set:
- "product_group": "accessory"
- "accessory_specific.type": e.g. "sunglasses", "bag", "hat", "belt", "scarf".
- "category": same as that type (e.g. "bag", "sunglasses").
`.trim(),
          user: `Analyze this ${cat} image and return the JSON object with all fields populated. Output only valid JSON.`
        }
      } else {
        // Fallback for unknown categories
        return {
          system: `
${unifiedSchemaPrompt}

For unknown categories:
- "product_group": "other"
- "category": "${cat}"
`.trim(),
          user: `Analyze this ${cat} image and return the JSON object with all fields populated. Output only valid JSON.`
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
    const ocrInstruction = `CRITICAL: First, perform OCR (Optical Character Recognition) on this image. Look for ANY text, letters, words, numbers, or small prints ANYWHERE on the item - especially on shoulders, neckline, chest, sleeves, hem, straps, or logos. If you find ANY text, you MUST include the exact text in the "text_content" field AND reflect it in "ecom_title" in quotes.\n\n`
    const fullPrompt = `${ocrInstruction}${promptConfig.system}\n\n${promptConfig.user}`

    // Use Gemini 3 Pro Preview for best quality descriptions
    console.log(`   Using Gemini 3 Pro Preview with HIGH thinking mode for improved accuracy`)
    
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
        maxOutputTokens: 16384,  // Maximum for Gemini 2.0 - ensure we never hit token limit
        temperature: 0.3,  // More deterministic for color accuracy
        responseMimeType: 'application/json'  // Force JSON output
      }
    })

    // NEW SDK returns text directly
    const rawJson = result.text?.trim() || `${category} item`
    const usageMetadata = result.usageMetadata as any
    const finishReason = result.candidates?.[0]?.finishReason || 'unknown'
    
    // Parse JSON and extract ecom_title for clean description
    let description = `${category} item` // fallback
    let parsedData: any = null
    
    try {
      parsedData = JSON.parse(rawJson)
      description = parsedData.ecom_title || `${category} item`
      console.log(`✅ Parsed JSON and extracted ecom_title: "${description}"`)
    } catch (parseError) {
      console.error(`❌ Failed to parse JSON response, using raw text as description`)
      description = rawJson
    }
    
    // Log response for debugging
    console.log('🔍 NEW SDK Response:')
    console.log(`   Raw JSON length: ${rawJson.length} chars`)
    console.log(`   Extracted description: "${description}"`)
    console.log(`   FinishReason: ${finishReason}`)
    console.log(`   Thinking tokens: ${usageMetadata?.thoughtsTokenCount || 0}`)
    console.log(`   Prompt tokens: ${usageMetadata?.promptTokenCount || 0}`)
    console.log(`   Completion tokens: ${usageMetadata?.candidatesTokenCount || 0}`)
    console.log(`   Total tokens: ${usageMetadata?.totalTokenCount || 0}`)
    
    // Check if we need to retry (detect failures BEFORE they cause issues)
    const needsRetry = (
      finishReason === 'MAX_TOKENS' ||  // Hit token limit (most reliable signal)
      description === `${category} item` ||  // Got fallback value (API returned nothing useful)
      (!usageMetadata?.candidatesTokenCount || usageMetadata.candidatesTokenCount === 0) ||  // No completion tokens
      description.length < 20  // Response too short to be valid
    )
    
    if (needsRetry) {
      console.error('❌ RETRY TRIGGERED:')
      console.error(`   - FinishReason: ${finishReason}`)
      console.error(`   - Completion tokens: ${usageMetadata?.candidatesTokenCount || 0}`)
      console.error(`   - Description length: ${description.length} chars`)
      console.error(`   - Is fallback: ${description === `${category} item`}`)
      
      if (finishReason === 'MAX_TOKENS') {
        console.error('   ⚠️ MAX_TOKENS hit - thinking tokens consumed all output budget!')
      }
      if (!usageMetadata?.candidatesTokenCount || usageMetadata.candidatesTokenCount === 0) {
        console.error('   ⚠️ Zero completion tokens - API returned empty response!')
      }
      
      // RETRY with ultra-minimal prompt (no thinking mode encouragement)
      console.log('🔄 Retry attempt with minimal prompt...')
      const retryResult = await client.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                  }
                },
                {
                  text: `Return ONLY valid JSON (no markdown, no explanation). Use this schema:
{"product_group":"clothing/shoes/accessory/other","category":"${category}","gender":"womens/mens/unisex","primary_color":"black/white/beige/navy/etc","secondary_color":"...","has_text_or_logo":false,"text_readable":false,"text_content":"","text_position":"none","material_family":"cotton/leather/knit/etc","silhouette":[],"key_details":[],"formality":"casual","shoe_specific":{"type":"none","heel_height":"unknown","closure":"unknown"},"accessory_specific":{"type":"none","frame_shape":"unknown","bag_style":"unknown","metal_color":"unknown"},"ecom_title":"brief product title"}`
                }
              ]
            }
          ],
          config: {
            maxOutputTokens: 2048,  // Much smaller - just enough for the JSON
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
      })
      
      const retryRawJson = retryResult.text?.trim() || `${category} item`
      const retryUsage = retryResult.usageMetadata as any
      
      // Parse retry JSON and extract ecom_title
      let retryDescription = `${category} item`
      try {
        const retryParsed = JSON.parse(retryRawJson)
        retryDescription = retryParsed.ecom_title || `${category} item`
        console.log(`✅ RETRY SUCCESS: Extracted ecom_title: "${retryDescription}"`)
      } catch (retryParseError) {
        console.error(`❌ Failed to parse retry JSON, using raw text`)
        retryDescription = retryRawJson
      }
      
      console.log(`   Retry tokens: ${retryUsage?.totalTokenCount || 0}`)
      
      // Use retry result
      return NextResponse.json({
        description: retryDescription,
        category,
        usage: {
          prompt_tokens: retryUsage?.promptTokenCount || 0,
          completion_tokens: retryUsage?.candidatesTokenCount || 0,
          total_tokens: retryUsage?.totalTokenCount || 0
        }
      })
    }

    return NextResponse.json({
      description, // now a ONE-LINE JSON string with attributes + ecom_title
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
