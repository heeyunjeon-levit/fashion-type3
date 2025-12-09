import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { 
      phoneNumber, 
      resultPageUrl, 
      sessionId,
      timeOnPage,
      clickedProducts,
      clickedToggleButton,
      openedFeedback,
      referrer
    } = await request.json()

    // Validate required fields
    if (!phoneNumber || !sessionId) {
      return NextResponse.json(
        { error: 'Phone number and session ID are required' },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user agent and IP from request headers
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] 
                      || request.headers.get('x-real-ip')
                      || 'unknown'

    // Insert visit record
    const { data, error } = await supabase
      .from('result_page_visits')
      .insert({
        phone_number: phoneNumber,
        result_page_url: resultPageUrl || window.location?.href || null,
        session_id: sessionId,
        user_agent: userAgent,
        ip_address: ipAddress,
        referrer: referrer || null,
        time_on_page_seconds: timeOnPage || null,
        clicked_products: clickedProducts || false,
        clicked_toggle_button: clickedToggleButton || false,
        opened_feedback: openedFeedback || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error logging visit:', error)
      return NextResponse.json(
        { error: 'Failed to log visit' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Visit logged successfully',
      data: data
    })

  } catch (error: any) {
    console.error('Track visit API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

