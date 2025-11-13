import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { 
      sessionId,
      pagePath,
      deviceId,
      isNewSession,
      timeOnPage,
      scrollDepth,
      uploadedImage,
      completedAnalysis,
      clickedSearch,
      referrer
    } = await request.json()

    // Validate required fields
    if (!sessionId || !pagePath) {
      return NextResponse.json(
        { error: 'Session ID and page path are required' },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user agent from request headers
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Insert page visit record
    const { data, error } = await supabase
      .from('app_page_visits')
      .insert({
        session_id: sessionId,
        page_path: pagePath,
        device_id: deviceId || null,
        is_new_session: isNewSession || false,
        user_agent: userAgent,
        referrer: referrer || null,
        time_on_page_seconds: timeOnPage || null,
        scroll_depth_percent: scrollDepth || null,
        uploaded_image: uploadedImage || false,
        completed_analysis: completedAnalysis || false,
        clicked_search: clickedSearch || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error logging page visit:', error)
      return NextResponse.json(
        { error: 'Failed to log page visit' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Page visit logged successfully',
      data: data
    })

  } catch (error: any) {
    console.error('Track page API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

