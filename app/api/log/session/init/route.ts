import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Use service role key for backend operations
  )
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, phoneNumber } = await request.json()

    const supabase = getSupabaseClient()

    // Check if session already exists
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single()

    if (existingSession) {
      return NextResponse.json({ success: true, exists: true })
    }

    // Create new session
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        session_id: sessionId,
        user_id: userId,
        phone_number: phoneNumber,
        status: 'in_progress',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create session:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, session: data })
  } catch (error) {
    console.error('Session init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize session' },
      { status: 500 }
    )
  }
}

