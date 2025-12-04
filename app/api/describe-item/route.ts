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

    // Generate search-optimized description matching international + Korean e-commerce formats
    const prompt = `You are analyzing a ${category} image. Describe it like product titles on Net-A-Porter, Nordstrom, Musinsa, 11번가.

🚨 **RULE #1: GRAPHIC/CHARACTER/LOGO ALWAYS COMES FIRST** 🚨
If the item has ANY visible graphic, character, logo, text print, or brand name:
→ START with the graphic/character name (e.g., "Mickey Mouse", "Donald Duck", "Winnie the Pooh", "Nike Swoosh", "Hello Kitty")
→ This is MORE IMPORTANT than color, material, or any other feature!

🎯 OUTPUT FORMAT (keyword-dense for search matching):

FOR GRAPHIC ITEMS:
"[CHARACTER/GRAPHIC] [Color] [Key Features] [Material] [Demographic] [Item Type]"
Example: "Donald Duck mint green crew neck fleece kids' sweatshirt"

FOR SOLID/NON-GRAPHIC ITEMS:
"[Color] [Key Design Features] [Material] [Demographic] [Item Type]"
Example: "Emerald green tie-neck draped puff sleeve silk-satin women's blouse"

REAL PRODUCT TITLE EXAMPLES:
International (Net-A-Porter, Zara, Nordstrom):
- "Tie-neck draped gathered silk satin-twill blouse"
- "Puff sleeve ribbed knit sweater"
- "High-waist wide leg denim jeans"

Korean (Musinsa, 11번가, Zigzag):
- "테나야 레이크 바라클라바 다운 자켓 브라운" (Tenaya Lake balaclava down jacket brown)
- "오버핏 미키 그래픽 플리스 맨투맨" (Oversized Mickey graphic fleece sweatshirt)
- "와이드 스트레이트 데님 팬츠 블루" (Wide straight denim pants blue)

YOUR OUTPUT STRUCTURE:
1. **GRAPHIC/CHARACTER FIRST** (if present): "Mickey Mouse", "Donald Duck", "Winnie the Pooh", "Hello Kitty", "Nike", "Adidas", etc.
2. COLOR: "emerald green", "dusty rose", "navy blue", "ivory white", "mint green", "bubblegum pink"
3. KEY FEATURES (2-4 distinctive elements):
   - Necklines: tie-neck, pussy bow, crew neck, V-neck, turtleneck, keyhole
   - Sleeves: puff sleeve, bishop sleeve, bell sleeve, balloon sleeve, raglan, bishop
   - Silhouette: oversized, fitted, relaxed, wide-leg, flared, A-line, bodycon
   - Details: draped, gathered, pleated, ruched, ribbed, cable knit, quilted
   - Embellishments: rhinestone, sequin, embroidered, appliqué, beaded
4. MATERIAL if visible: silk-satin, cotton, denim, fleece, wool, ribbed knit, leather
5. DEMOGRAPHIC if clear: women's, men's, kids', baby
6. ITEM TYPE: blouse, sweater, jeans, jacket, dress, t-shirt, etc.

CRITICAL RULES:
1. 🚨 **GRAPHIC/CHARACTER FIRST** - If you see ANY character, logo, text, or graphic print, IT MUST BE THE FIRST WORD
   - ✅ "Donald Duck mint green crew neck sweatshirt"
   - ❌ "Mint green crew neck sweatshirt with Donald Duck graphic"
2. 🎨 SPECIFIC COLOR - "emerald green" not "green", "dusty rose" not "pink", "mint green" not "green"
3. 🔍 INDUSTRY TERMS ONLY:
   - Necklines: tie-neck, pussy bow, keyhole, crew neck, V-neck, turtleneck
   - Sleeves: puff sleeve, bishop sleeve, bell sleeve, cap sleeve, raglan
   - Details: gathered, draped, pleated, ruched, ribbed, cable knit
   - Fit: oversized, fitted, relaxed, tailored, wide-leg, flared, slim-fit
   - Closures: tie-neck, button-front, zip-up, snap-button
4. 👥 DEMOGRAPHIC if obvious (baby has onesies/snaps, kids 3-12, women's/men's based on cut)
5. ✨ 2-4 KEY FEATURES max - don't overload
6. 📦 ONE LINE - no paragraphs, no flowery language

EXAMPLES (match this keyword-dense format):

**GRAPHIC ITEMS (CHARACTER/LOGO FIRST):**
1. Mint green Donald Duck shirt → "Donald Duck mint green crew neck fleece kids' sweatshirt"
2. Pink Disney sweatshirt → "Winnie the Pooh bubblegum pink oversized fleece women's sweatshirt"
3. Yellow Mickey tee → "Mickey Mouse bright yellow cotton kids' t-shirt"
4. White Minnie sweatshirt → "Minnie Mouse ivory white crew neck fleece kids' sweatshirt"
5. Purple Hello Kitty hoodie → "Hello Kitty lavender purple zip-up fleece women's hoodie"
6. Navy Nike jacket → "Nike navy blue zip-up windbreaker men's jacket"

**SOLID ITEMS (NO GRAPHIC - COLOR FIRST):**
7. Green Gucci blouse → "Emerald green tie-neck draped gathered puff sleeve silk-satin women's blouse"
8. Brown down jacket → "Chocolate brown balaclava hood quilted down women's jacket"
9. Blue jeans → "Medium wash high-waist wide leg denim women's jeans"
10. Navy sweater → "Navy blue cable knit crew neck ribbed men's sweater"
11. White baby onesie → "Ivory white teddy bear appliqué snap-closure cotton baby onesie"

CHARACTER/GRAPHIC IDENTIFICATION (MOST IMPORTANT):
Look for these and PUT THEM FIRST:
- Disney characters: Mickey Mouse, Minnie Mouse, Donald Duck, Daisy Duck, Winnie the Pooh, Dumbo, Bambi, etc.
- Cartoon characters: Snoopy, Hello Kitty, Pikachu, SpongeBob, etc.
- Brand logos: Nike, Adidas, Supreme, Gucci, Louis Vuitton, Champion, etc.
- Text prints: Brand names, slogans, words (describe what the text says)
- Abstract graphics: Floral print, geometric print, striped, polka dot, tie-dye, etc.

COLOR SPECIFICITY (CRITICAL for search):
❌ "green" → ✅ "emerald green", "kelly green", "sage green", "olive green", "mint green"
❌ "pink" → ✅ "bubblegum pink", "dusty rose", "hot pink", "blush pink"
❌ "blue" → ✅ "navy blue", "royal blue", "sky blue", "cobalt blue"
❌ "brown" → ✅ "chocolate brown", "camel", "tan", "cognac"
❌ "white" → ✅ "ivory white", "cream", "pure white", "off-white"

KOREAN KEYWORDS (Musinsa, 11번가 style):
- Characters: 미키 (Mickey), 곰돌이 (Pooh), 미니 (Minnie)
- Fit: 오버핏 (oversized), 루즈핏 (loose), 슬림핏 (slim)
- Features: 후드 (hood), 지퍼 (zipper), 포켓 (pocket), 프린트 (print), 그래픽 (graphic)
- Materials: 니트 (knit), 플리스 (fleece), 데님 (denim), 코튼 (cotton)

❌ AVOID: Editorial language, vague terms, styling suggestions
✅ USE: Concrete searchable keywords matching product titles

Return ONE keyword-dense line. Match the examples exactly.`

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

