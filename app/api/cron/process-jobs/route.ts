import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabaseServer'

// This endpoint is called by Vercel Cron every 30 seconds
// It processes pending jobs in the background
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

export async function GET(request: Request) {
  // Verify request is from Vercel Cron (not external attacker)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // Check if request has valid authorization OR is from Vercel Cron
  const isAuthorized = authHeader === `Bearer ${cronSecret}` || 
                      request.headers.get('x-vercel-cron') === '1' ||
                      !cronSecret // Allow if no secret set (for testing)
  
  if (!isAuthorized) {
    console.error('❌ Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔄 Cron job started - checking for pending jobs...')
  console.log(`   Environment: ${process.env.VERCEL_ENV || 'unknown'}`)
  console.log(`   Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set'}`)
  console.log(`   Has Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'yes' : 'NO'}`)
  
  const cronStartTime = Date.now()
  const MAX_CRON_DURATION_MS = 280000 // 4 min 40 sec (leave 20s buffer before 5 min timeout)

  try {
    const supabase = getSupabaseServerClient()

    // Find all pending jobs OR stale processing jobs (oldest first)
    // Stale = jobs that have been "processing" for more than 10 minutes (likely crashed)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    const { data: pendingJobs, error } = await supabase
      .from('search_jobs')
      .select('*')
      .or(`status.eq.pending,and(status.eq.processing,updated_at.lt.${tenMinutesAgo})`)
      .order('created_at', { ascending: true })
      .limit(2) // Process up to 2 jobs per cron run (reduced from 5 to avoid timeout)

    if (error) {
      console.error('❌ Error fetching pending jobs:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    console.log(`📊 Found ${pendingJobs?.length || 0} job(s) to process (pending or stale)`)
    
    // CLEANUP: Mark very old processing jobs as failed (stuck for > 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: veryStaleJobs } = await supabase
      .from('search_jobs')
      .select('job_id, updated_at')
      .eq('status', 'processing')
      .lt('updated_at', oneHourAgo)
    
    if (veryStaleJobs && veryStaleJobs.length > 0) {
      console.log(`   🧹 Cleaning up ${veryStaleJobs.length} very stale job(s) (stuck > 1 hour)`)
      for (const staleJob of veryStaleJobs) {
        await supabase
          .from('search_jobs')
          .update({ 
            status: 'failed', 
            error: 'Job timed out - stuck in processing for over 1 hour',
            updated_at: new Date().toISOString()
          })
          .eq('job_id', staleJob.job_id)
        console.log(`      ❌ Marked ${staleJob.job_id} as failed (stuck since ${new Date(staleJob.updated_at).toLocaleString()})`)
      }
    }
    
    // DEBUG: Show ALL jobs in database (first 5) to diagnose issue
    const { data: allJobs } = await supabase
      .from('search_jobs')
      .select('job_id, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (allJobs && allJobs.length > 0) {
      console.log(`   🔍 Recent jobs in DB (total: ${allJobs.length}):`)
      allJobs.forEach(j => {
        const age = Math.floor((Date.now() - new Date(j.updated_at).getTime()) / 60000)
        const isStale = j.status === 'processing' && age > 10
        console.log(`      - ${j.job_id}: ${j.status} ${isStale ? '⚠️ STALE!' : ''} (updated ${age}m ago)`)
      })
    } else {
      console.log(`   ⚠️  Database appears EMPTY - no jobs found at all!`)
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
         const isRetry = job.status === 'processing'
         console.log(`${isRetry ? '🔄 RETRYING' : '🚀 Processing'} job ${job.job_id}... (${Math.round(elapsedMs / 1000)}s elapsed)`)
         if (isRetry) {
           const lastUpdated = Math.floor((Date.now() - new Date(job.updated_at).getTime()) / 60000)
           console.log(`   ⚠️ Job was stuck in 'processing' for ${lastUpdated} minutes - retrying now`)
         }
  
         // Mark as processing
         await supabase
           .from('search_jobs')
           .update({ status: 'processing', updated_at: new Date().toISOString() })
           .eq('job_id', job.job_id)

        // Import and run the actual search processing
        const { processSearchJob } = await import('@/app/api/search-job/route')
        
        // Get job data from JSON field (contains all processing parameters)
        const jobData = job.job_data || {
          categories: [],
          croppedImages: {},
          descriptions: {},
          originalImageUrl: job.original_image_url || '',
          useOCRSearch: false,
          phoneNumber: job.phone_number,
          countryCode: job.country_code
        }
        
        console.log(`   Job data:`, {
          categories: jobData.categories,
          hasCroppedImages: Object.keys(jobData.croppedImages || {}).length > 0,
          hasDescriptions: Object.keys(jobData.descriptions || {}).length > 0,
          hasPhone: !!jobData.phoneNumber
        })

        await processSearchJob(job.job_id, jobData)
        
        console.log(`✅ Job ${job.job_id} completed`)
        results.push({ status: 'fulfilled', value: { id: job.job_id, status: 'completed' } })
       } catch (jobError) {
         console.error(`❌ Job ${job.job_id} failed:`, jobError)
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

