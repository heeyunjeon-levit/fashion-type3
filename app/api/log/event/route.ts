import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '../../../../lib/supabaseServer'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, eventType, eventData } = await request.json()

    const supabase = getSupabaseServerClient()

    // Get session UUID from session_id
    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single()

    if (!session) {
      console.warn('Session not found for event logging:', sessionId)
      // Still log the event without session reference
    }

    const { error } = await supabase
      .from('events')
      .insert({
        session_id: session?.id,
        user_id: userId,
        event_type: eventType,
        event_data: eventData,
      })

    if (error) {
      console.error('Failed to log event:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Event logging error:', error)
    return NextResponse.json(
      { error: 'Failed to log event' },
      { status: 500 }
    )
  }
}

