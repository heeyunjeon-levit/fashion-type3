import { NextResponse } from 'next/server'

// Manual trigger for testing - just redirects to the cron endpoint
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Get the base URL
  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`
  
  console.log('🔧 Manual cron trigger - calling process-jobs endpoint...')
  
  try {
    // Call the cron endpoint
    const cronUrl = `${baseUrl}/api/cron/process-jobs`
    console.log(`📞 Calling: ${cronUrl}`)
    
    const response = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'x-vercel-cron': '1' // Simulate Vercel Cron
      }
    })
    
    const data = await response.json()
    
    return NextResponse.json({
      message: 'Manual trigger complete',
      cronResponse: data,
      status: response.status
    })
    
  } catch (error) {
    console.error('❌ Manual trigger failed:', error)
    return NextResponse.json({
      error: 'Manual trigger failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

