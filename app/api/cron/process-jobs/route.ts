import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabaseServer'

// This endpoint is called by Vercel Cron every 30 seconds
// It processes pending jobs in the background
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

export async function GET(request: Request) {
  // Verify cron secret (prevent unauthorized access)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔄 Cron job started - checking for pending jobs...')
  
  const cronStartTime = Date.now()
  const MAX_CRON_DURATION_MS = 280000 // 4 min 40 sec (leave 20s buffer before 5 min timeout)

  try {
    const supabase = getSupabaseServerClient()

    // Find all pending jobs (oldest first)
    const { data: pendingJobs, error } = await supabase
      .from('search_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(2) // Process up to 2 jobs per cron run (reduced from 5 to avoid timeout)

    if (error) {
      console.error('❌ Error fetching pending jobs:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('✅ No pending jobs to process')
      return NextResponse.json({ 
        message: 'No pending jobs',
        processed: 0 
      })
    }

    console.log(`📋 Found ${pendingJobs.length} pending job(s)`)

    // ⚠️ IMPORTANT: Process jobs SEQUENTIALLY to avoid timeout
    // Processing 2 jobs in parallel could take 4-6 minutes (exceeds 5 min limit)
    // Sequential processing: 2 jobs × 2-3 min = 4-6 min (within limit, safer)
    const results = []
    
    for (const job of pendingJobs) {
      // Check if we're approaching timeout (leave at least 30s for current job + cleanup)
      const elapsedMs = Date.now() - cronStartTime
      const remainingMs = MAX_CRON_DURATION_MS - elapsedMs
      
      if (remainingMs < 30000) {
        console.warn(`⏰ Approaching timeout (${Math.round(remainingMs / 1000)}s remaining) - stopping after ${results.length} jobs`)
        console.warn(`   Unprocessed jobs: ${pendingJobs.length - results.length}`)
        break
      }
      
      try {
        console.log(`🚀 Processing job ${job.id}... (${Math.round(elapsedMs / 1000)}s elapsed)`)

        // Mark as processing
        await supabase
          .from('search_jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id)

        // Import and run the actual search processing
        const { processSearchJob } = await import('@/app/api/search-job/route')
        
        const jobData = {
          categories: job.categories,
          croppedImages: job.cropped_images,
          descriptions: job.descriptions,
          originalImageUrl: job.original_image_url,
          useOCRSearch: job.use_ocr_search,
          phoneNumber: job.phone_number,
          countryCode: job.country_code
        }

        await processSearchJob(job.id, jobData)
        
        console.log(`✅ Job ${job.id} completed`)
        results.push({ status: 'fulfilled', value: { id: job.id, status: 'completed' } })
      } catch (jobError) {
        console.error(`❌ Job ${job.id} failed:`, jobError)
        results.push({ status: 'rejected', reason: jobError })
      }
    }

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`✅ Cron job complete: ${successful} succeeded, ${failed} failed`)

    return NextResponse.json({
      message: 'Cron job completed',
      processed: pendingJobs.length,
      successful,
      failed
    })

  } catch (error) {
    console.error('❌ Cron job error:', error)
    return NextResponse.json({ 
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

