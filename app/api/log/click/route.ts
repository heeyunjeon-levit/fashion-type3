import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      userId,
      itemCategory,
      itemDescription,
      productLink,
      productTitle,
      productThumbnail,
      linkPosition,
    } = await request.json()

    const supabase = getSupabaseClient()

    // Get session UUID
    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single()

    const { error } = await supabase
      .from('link_clicks')
      .insert({
        session_id: session?.id,
        user_id: userId,
        item_category: itemCategory,
        item_description: itemDescription,
        product_link: productLink,
        product_title: productTitle,
        product_thumbnail: productThumbnail,
        link_position: linkPosition,
      })

    if (error) {
      console.error('Failed to log click:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Click logging error:', error)
    return NextResponse.json(
      { error: 'Failed to log click' },
      { status: 500 }
    )
  }
}

