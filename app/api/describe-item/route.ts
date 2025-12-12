import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const maxDuration = 90 // Allow up to 90 seconds for Gemini 3 Pro (can be slow with complex images)

// Dynamically import sharp (has native bindings, might fail on some platforms)
let sharp: any = null
try {
  sharp = require('sharp')
  console.log('✅ Sharp loaded successfully')
} catch (error) {
  console.warn('⚠️  Sharp failed to load - backend cropping disabled:', error)
}

// Use dedicated Gemini API key (project-specific, not gcloud)
const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GCLOUD_API_KEY || ''
})

// Initialize Supabase client for image storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, category, bbox, imageSize } = await request.json()

    console.log(`🚨 DESCRIBE-ITEM DEBUG: category=${category}, imageUrl type=${typeof imageUrl}, starts with data:${imageUrl?.startsWith('data:')}`)
    console.log(`🚨 imageUrl preview: ${imageUrl?.substring(0, 100)}`)

    if (!imageUrl || !category) {
      console.error('❌ Missing required fields:', { imageUrl: !!imageUrl, category: !!category })
      return NextResponse.json(
        { error: 'imageUrl and category are required' },
        { status: 400 }
      )
    }

    console.log(`🤖 Getting Gemini 3 Pro Preview description for ${category}...`)
    console.log(`   Model: gemini-3-pro-preview (most intelligent model!)`)
    
    // Step 1: BACKEND CROPPING (if bbox provided and sharp available)
    let croppedImageUrl: string | undefined
    let imageToAnalyze = imageUrl // Will be either original or cropped image URL
    
    if (bbox && imageSize && !imageUrl.startsWith('data:')) {
      if (!sharp) {
        console.warn(`⚠️  Backend cropping requested but sharp not available - using full image`)
      } else if (sharp) {
      console.log(`✂️ BACKEND CROPPING with bbox:`, bbox)
      console.log(`   Image size: ${imageSize[0]}x${imageSize[1]}`)
      
      try {
        // Download original image from Supabase
        console.log(`   📥 Downloading original image...`)
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`)
        }
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
        console.log(`   ✅ Downloaded ${Math.round(imageBuffer.length / 1024)}KB`)
        
        // Parse bbox coordinates (assuming normalized 0-1 or pixel coordinates)
        const [x1, y1, x2, y2] = bbox
        const isNormalized = Math.max(x1, y1, x2, y2) <= 1
        
        // Calculate pixel coordinates
        const left = isNormalized ? Math.round(x1 * imageSize[0]) : x1
        const top = isNormalized ? Math.round(y1 * imageSize[1]) : y1
        const width = (isNormalized ? Math.round(x2 * imageSize[0]) : x2) - left
        const height = (isNormalized ? Math.round(y2 * imageSize[1]) : y2) - top
        
        console.log(`   📐 Crop region: left=${left}, top=${top}, width=${width}, height=${height}`)
        
        // Crop using sharp (FAST!)
        const croppedBuffer = await sharp(imageBuffer)
          .extract({ left, top, width, height })
          .jpeg({ quality: 90 })
          .toBuffer()
        
        console.log(`   ✅ Cropped to ${Math.round(croppedBuffer.length / 1024)}KB`)
        
        // Upload cropped image to Supabase
        const timestamp = Date.now()
        const filename = `cropped_${category}_${timestamp}.jpg`
        console.log(`   📤 Uploading cropped image: ${filename}`)
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('images')
          .upload(filename, croppedBuffer, {
            contentType: 'image/jpeg',
            cacheControl: '3600'
          })
        
        if (uploadError) {
          console.error(`   ❌ Upload failed:`, uploadError)
          throw uploadError
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(filename)
        
        croppedImageUrl = publicUrl
        imageToAnalyze = publicUrl // Analyze the cropped image
        console.log(`   ✅ Uploaded cropped image: ${publicUrl.substring(0, 80)}`)
        
      } catch (error) {
        console.error('❌ Backend cropping failed:', error)
        console.warn('   ⚠️  Falling back to full image')
        // Continue with full image if cropping fails
      }
      } // end of else if (sharp)
    } // end of if (bbox && imageSize...)
    
    // Step 2: Convert image to data URL for Gemini (required by Gemini API)
    let finalImageUrl = imageToAnalyze
    
    if (!imageToAnalyze.startsWith('data:')) {
      console.log(`🔄 Converting to data URL for Gemini...`)
      console.log(`   Source: ${imageToAnalyze.substring(0, 80)}`)
      
      try {
        const imageResponse = await fetch(imageToAnalyze)
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`)
        }
        
        const arrayBuffer = await imageResponse.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
        const base64 = buffer.toString('base64')
        finalImageUrl = `data:${contentType};base64,${base64}`
        
        console.log(`✅ Converted to data URL: ${contentType}, ${Math.round(base64.length / 1024)}KB`)
      } catch (error) {
        console.error('❌ Failed to convert to data URL:', error)
        return NextResponse.json(
          { error: 'Failed to fetch and convert image' },
          { status: 500 }
        )
      }
    }
    
    console.log(`   Image type: ${finalImageUrl.startsWith('data:') ? 'data URL' : 'HTTP URL'}`)
    console.log(`   Image size: ${Math.round(finalImageUrl.length / 1024)}KB`)
    
    // Validate data URL format
    if (finalImageUrl.startsWith('data:')) {
      // Log first 100 chars to debug
      console.log(`   Data URL start: ${finalImageUrl.substring(0, 100)}`)
      
      const mimeMatch = finalImageUrl.match(/^data:([^;]+);base64,/)
      if (!mimeMatch) {
        console.error('❌ Invalid data URL format - missing MIME type or base64 prefix')
        console.error(`   Received format: ${finalImageUrl.substring(0, 200)}`)
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
      const base64Part = finalImageUrl.split(',')[1]
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
    // finalImageUrl is guaranteed to be a data URL after conversion above
    if (!finalImageUrl.startsWith('data:')) {
      console.error(`❌ CRITICAL: finalImageUrl is not a data URL! This should never happen!`)
      console.error(`   finalImageUrl: ${finalImageUrl.substring(0, 100)}`)
      throw new Error('Internal error: Image conversion failed')
    }
    
    // Data URL - extract base64 and MIME type
    const match = finalImageUrl.match(/^data:([^;]+);base64,(.+)$/)
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
      model: 'gemini-3-pro-preview',  // SOTA model - best descriptions
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
        // NOTE: responseMimeType not supported by gemini-3-pro-preview - rely on prompt instead
      }
    })

    // NEW SDK returns text directly (but structure varies by model)
    let rawJson = result.text?.trim()
    
    // Fallback: Try accessing response from candidates structure
    if (!rawJson) {
      const candidate = result.candidates?.[0]
      const parts = candidate?.content?.parts
      if (parts && parts.length > 0) {
        rawJson = parts[0]?.text?.trim()
        console.log(`   ℹ️ Extracted text from candidates structure`)
      }
    }
    
    // Log response status for debugging
    console.log(`   📦 Gemini response length: ${rawJson?.length || 0} chars`)
    console.log(`   📦 Gemini response preview: ${rawJson?.substring(0, 100) || 'EMPTY'}`)
    
    // Final fallback if still empty
    if (!rawJson) {
      console.error(`   ❌ Gemini 3 Pro returned EMPTY response!`)
      console.error(`   ℹ️ Response structure:`, JSON.stringify(result).substring(0, 300))
      rawJson = `${category} item`
    }
    
    const usageMetadata = result.usageMetadata as any
    const finishReason = result.candidates?.[0]?.finishReason || 'unknown'
    
    // CRITICAL: Strip markdown code fences if present (Gemini sometimes adds them)
    if (rawJson.startsWith('```json')) {
      rawJson = rawJson.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      console.log(`🧹 Cleaned markdown code fences from response`)
    } else if (rawJson.startsWith('```')) {
      rawJson = rawJson.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
      console.log(`🧹 Cleaned generic code fences from response`)
    }
    
    // Parse JSON and build DETAILED description for search
    let description = `${category} item` // fallback
    let parsedData: any = null
    
    try {
      parsedData = JSON.parse(rawJson)
      
      // CRITICAL: Use ecom_title directly (clean, concise, perfect for GPT-4.1-mini vision)
      // Building from parts is too verbose and confuses the vision model
      description = parsedData.ecom_title || `${category} item`
      console.log(`✅ Extracted clean ecom_title: "${description}"`)
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
      console.log('🔄 Retry attempt with gemini-2.0-flash-exp (supports JSON mode)...')
      const retryResult = await client.models.generateContent({
          model: 'gemini-2.0-flash-exp',  // This model DOES support JSON mode
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
            responseMimeType: 'application/json'  // OK for gemini-2.0-flash-exp
          }
      })
      
      let retryRawJson = retryResult.text?.trim()
      
      // Fallback: Try accessing from candidates structure
      if (!retryRawJson) {
        const candidate = retryResult.candidates?.[0]
        const parts = candidate?.content?.parts
        if (parts && parts.length > 0) {
          retryRawJson = parts[0]?.text?.trim()
          console.log(`   ℹ️ Retry: Extracted text from candidates structure`)
        }
      }
      
      console.log(`   📦 Retry response length: ${retryRawJson?.length || 0} chars`)
      
      if (!retryRawJson) {
        console.error(`   ❌ Retry (gemini-2.0-flash-exp) returned EMPTY response!`)
        retryRawJson = `${category} item`
      }
      
      const retryUsage = retryResult.usageMetadata as any
      
      // CRITICAL: Strip markdown code fences if present
      if (retryRawJson.startsWith('```json')) {
        retryRawJson = retryRawJson.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        console.log(`🧹 Cleaned markdown code fences from retry response`)
      } else if (retryRawJson.startsWith('```')) {
        retryRawJson = retryRawJson.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
        console.log(`🧹 Cleaned generic code fences from retry response`)
      }
      
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
        croppedImageUrl, // Backend-cropped image URL (if bbox was provided)
        usage: {
          prompt_tokens: retryUsage?.promptTokenCount || 0,
          completion_tokens: retryUsage?.candidatesTokenCount || 0,
          total_tokens: retryUsage?.totalTokenCount || 0
        }
      })
    }

    // 🔍 SMART ROBE DETECTION: Override "sweater" → "robe" if it looks like a robe
    let finalCategory = category
    if (category === 'sweater' || category === 'cardigan' || category === 'jacket') {
      const descLower = description.toLowerCase()
      const keyDetails = (parsedData && Array.isArray(parsedData.key_details)) ? parsedData.key_details : []
      const keyDetailsStr = keyDetails.join(' ').toLowerCase()
      
      // Robe indicators: belt, shawl collar, loungewear, bathrobe, etc.
      const robeIndicators = [
        'robe', 'bathrobe', 'bath robe', 'loungewear', 'lounge wear',
        'shawl collar', 'tie belt', 'wrap style', 'kimono', 'terry',
        'toweling', 'towelling', 'spa', 'dressing gown', 'house coat'
      ]
      
      const hasRobeIndicator = robeIndicators.some(indicator => 
        descLower.includes(indicator) || keyDetailsStr.includes(indicator)
      )
      
      // Also check if it has a belt AND loose fit (strong robe signal)
      const hasBelt = descLower.includes('belt') || keyDetailsStr.includes('belt')
      const isLoose = descLower.includes('oversized') || descLower.includes('loose') || 
                      keyDetailsStr.includes('oversized') || keyDetailsStr.includes('relaxed')
      
      if (hasRobeIndicator || (hasBelt && isLoose)) {
        console.log(`🔄 ROBE OVERRIDE: "${category}" → "robe" (detected robe characteristics)`)
        console.log(`   Indicators: ${robeIndicators.filter(i => descLower.includes(i) || keyDetailsStr.includes(i)).join(', ')}`)
        console.log(`   Has belt: ${hasBelt}, Is loose: ${isLoose}`)
        finalCategory = 'robe'
      }
    }

    return NextResponse.json({
      description, // Clean ecom_title like "Women's Beige Knit Scarf with Eye Pattern"
      category: finalCategory, // May be overridden to "robe"
      croppedImageUrl, // Backend-cropped image URL (if bbox was provided)
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
