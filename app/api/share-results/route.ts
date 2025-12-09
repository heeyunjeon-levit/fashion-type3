import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabaseServer'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { 
      results, 
      originalImageUrl, 
      selectedItems, 
      sessionId,
      userPhone,
      searchMode 
    } = await request.json()

    if (!results || Object.keys(results).length === 0) {
      return NextResponse.json(
        { error: 'Results are required' },
        { status: 400 }
      )
    }

    console.log('💾 Saving shared results...')
    console.log(`   Categories: ${Object.keys(results).length}`)
    console.log(`   Total products: ${Object.values(results).reduce((acc: number, arr: any) => acc + arr.length, 0)}`)

    const supabase = getSupabaseServerClient()
    
    // Insert the shared results
    const { data, error } = await supabase
      .from('shared_results')
      .insert({
        results,
        original_image_url: originalImageUrl,
        selected_items: selectedItems,
        session_id: sessionId,
        user_phone: userPhone,
        search_mode: searchMode || 'unknown'
      })
      .select('id')
      .single()

    if (error) {
      console.error('❌ Error saving shared results:', error)
      console.error('❌ Error details:', JSON.stringify(error, null, 2))
      console.error('❌ Error message:', error.message)
      console.error('❌ Error code:', error.code)
      return NextResponse.json(
        { error: 'Failed to save results', details: error.message },
        { status: 500 }
      )
    }

    const shareId = data.id
    
    // Determine base URL - use http for localhost, https for production
    let baseUrl: string
    const host = request.headers.get('host')
    
    if (process.env.NEXT_PUBLIC_APP_URL) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (host) {
      // Use http:// for localhost, https:// for everything else
      const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
      baseUrl = `${protocol}://${host}`
    } else {
      baseUrl = 'http://localhost:3000'
    }
    
    const shareUrl = `${baseUrl}/results/${shareId}`

    console.log('✅ Shared results saved:', shareId)
    console.log(`   Share URL: ${shareUrl}`)

    return NextResponse.json({
      success: true,
      shareId,
      shareUrl
    })

  } catch (error: any) {
    console.error('❌ Error in share-results:', error)
    console.error('❌ Full error:', JSON.stringify(error, null, 2))
    console.error('❌ Error message:', error?.message)
    console.error('❌ Error stack:', error?.stack)
    return NextResponse.json(
      { error: 'Failed to create share link', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve shared results
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Share ID is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Fetching shared results: ${id}`)

    const supabase = getSupabaseServerClient()
    
    // Get the shared results with a timeout
    const { data, error } = await Promise.race([
      supabase
        .from('shared_results')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single(),
      new Promise<{ data: null; error: any }>((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
      )
    ]) as any

    if (error || !data) {
      console.error('❌ Error fetching shared results:', error)
      console.error('❌ Error details:', JSON.stringify(error, null, 2))
      
      // Check if it's a table not found error
      if (error?.code === '42P01' || error?.message?.includes('relation') || error?.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Database table not found. Please run the SQL schema in Supabase.',
            details: 'Run supabase_shared_results_schema.sql in your Supabase SQL Editor'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: 'Results not found', details: error?.message || 'Unknown error' },
        { status: 404 }
      )
    }

    // Increment view count (non-blocking, fire and forget)
    supabase
      .from('shared_results')
      .update({ 
        view_count: (data.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .then((result) => {
        if (result.error) {
          console.error('⚠️  Failed to update view count:', result.error)
        } else {
          console.log(`👁️  View count updated: ${id}`)
        }
      })

    const elapsed = Date.now() - startTime
    console.log(`✅ Shared results retrieved in ${elapsed}ms: ${id} (views: ${data.view_count + 1})`)

    return NextResponse.json({
      success: true,
      results: data.results,
      originalImageUrl: data.original_image_url,
      selectedItems: data.selected_items,
      searchMode: data.search_mode,
      createdAt: data.created_at
    })

  } catch (error: any) {
    console.error('❌ Error in GET share-results:', error)
    console.error('❌ Error message:', error?.message)
    return NextResponse.json(
      { error: 'Failed to fetch results', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

