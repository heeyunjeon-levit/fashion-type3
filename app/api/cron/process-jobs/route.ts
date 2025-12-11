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

  try {
    const supabase = getSupabaseServerClient()

    // Find all pending jobs (oldest first)
    const { data: pendingJobs, error } = await supabase
      .from('search_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5) // Process up to 5 jobs per cron run

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

    // Process each job
    const results = await Promise.allSettled(
      pendingJobs.map(async (job) => {
        console.log(`🚀 Processing job ${job.id}...`)

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
        return { id: job.id, status: 'completed' }
      })
    )

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

