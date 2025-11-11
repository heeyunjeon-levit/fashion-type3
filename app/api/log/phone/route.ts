import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '../../../../lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, phoneNumber, countryCode } = await request.json()

    const supabase = getSupabaseServerClient()

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single()

    let userId: string

    if (existingUser) {
      // Returning user
      userId = existingUser.id
      
      // Update last active time and increment search count
      await supabase.rpc('update_user_activity', { p_user_id: userId })
    } else {
      // New user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          phone_number: phoneNumber,
          country_code: countryCode,
          total_searches: 1,
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create user:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      userId = newUser.id
    }

    // Update session with user info
    await supabase
      .from('sessions')
      .update({
        user_id: userId,
        phone_number: phoneNumber,
        phone_collected_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)

    return NextResponse.json({
      success: true,
      userId,
      isReturningUser: !!existingUser,
      totalSearches: existingUser ? existingUser.total_searches + 1 : 1,
    })
  } catch (error) {
    console.error('Phone logging error:', error)
    return NextResponse.json(
      { error: 'Failed to log phone number' },
      { status: 500 }
    )
  }
}

