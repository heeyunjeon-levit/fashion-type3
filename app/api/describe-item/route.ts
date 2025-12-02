import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, category } = await request.json()

    if (!imageUrl || !category) {
      return NextResponse.json(
        { error: 'imageUrl and category are required' },
        { status: 400 }
      )
    }

    console.log(`🤖 Getting GPT-4o description for ${category}...`)

    // Generate detailed description using GPT-4o
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a fashion expert. Describe this ${category} item in 15-25 words. Focus on:
- Style and design (e.g., "oversized", "fitted", "vintage-inspired")
- Key features (e.g., "button-down", "crew neck", "distressed")
- Color and pattern
- Material if visible

Be specific and detailed. Use fashion terminology.`
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'low' // Faster and cheaper
              }
            }
          ]
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    })

    const description = response.choices[0]?.message?.content?.trim() || `${category} item`

    console.log(`✅ Description: ${description.substring(0, 60)}...`)

    return NextResponse.json({
      description,
      category,
      usage: response.usage
    })

  } catch (error: any) {
    console.error('❌ GPT-4o description error:', error)
    return NextResponse.json(
      { error: error.message || 'Description failed' },
      { status: 500 }
    )
  }
}

