import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '../../../../../lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, phoneNumber } = await request.json()
    
    console.log('Session init request:', { sessionId, userId: userId ? 'present' : 'null', phoneNumber: phoneNumber ? 'present' : 'null' })

    const supabase = getSupabaseServerClient()

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
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { 
        error: 'Failed to initialize session',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

