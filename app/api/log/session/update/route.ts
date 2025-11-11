import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '../../../../../lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, ...updateData } = await request.json()

    const supabase = getSupabaseServerClient()
    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('session_id', sessionId)

    if (error) {
      console.error('Failed to update session:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Session update error:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}

