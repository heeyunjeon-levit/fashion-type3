import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, satisfaction, comment, resultPageUrl, pageLoadTime } = await request.json()

    // Validate required fields
    if (!phoneNumber || !satisfaction) {
      return NextResponse.json(
        { error: 'Phone number and satisfaction are required' },
        { status: 400 }
      )
    }

    // Validate satisfaction value
    if (satisfaction !== '만족' && satisfaction !== '불만족') {
      return NextResponse.json(
        { error: 'Invalid satisfaction value' },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user agent from request headers
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Insert feedback into database
    const { data, error } = await supabase
      .from('user_feedback')
      .insert({
        phone_number: phoneNumber,
        satisfaction: satisfaction,
        comment: comment || null,
        result_page_url: resultPageUrl || null,
        user_agent: userAgent,
        page_load_time: pageLoadTime || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving feedback:', error)
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '피드백이 저장되었습니다',
      data: data
    })

  } catch (error) {
    console.error('Feedback API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

