import { NextRequest, NextResponse } from 'next/server'
import { createJob, updateJobProgress, completeJob, failJob, getJob } from '@/lib/jobQueue'
import { sendSearchResultsNotification } from '@/lib/sms'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * POST /api/search-job
 * Create a new search job and start processing in the background
 * Returns job ID immediately for polling
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { categories, croppedImages, descriptions, originalImageUrl, useOCRSearch, phoneNumber, countryCode } = body
    
    // Create job
    const job = createJob({
      categories,
      croppedImages,
      descriptions,
      originalImageUrl,
      useOCRSearch,
      phoneNumber,
      countryCode
    })
    
    console.log(`🚀 Created search job ${job.id}${phoneNumber ? ' with SMS notification' : ''}`)
    
    // Start background processing (don't await - let it run in background)
    processSearchJob(job.id, body).catch(error => {
      console.error(`❌ Job ${job.id} failed during processing:`, error)
      // Make sure job is marked as failed
      try {
        failJob(job.id, error.message || 'Unknown error')
      } catch (e) {
        console.error('Failed to mark job as failed:', e)
      }
    })
    
    // Return job ID immediately
    return NextResponse.json({
      jobId: job.id,
      status: 'processing',
      message: phoneNumber 
        ? 'Search started. You will receive an SMS when results are ready.'
        : 'Search started. Poll /api/search-job/[id] for status.'
    })
    
  } catch (error) {
    console.error('Error creating search job:', error)
    return NextResponse.json(
      { error: 'Failed to create search job' },
      { status: 500 }
    )
  }
}

/**
 * Process the search job in the background
 * This calls the existing /api/search logic DIRECTLY (not via HTTP)
 */
async function processSearchJob(jobId: string, body: any) {
  try {
    console.log(`⚙️ Processing job ${jobId}...`)
    updateJobProgress(jobId, 5, 'processing')
    
    // Update progress periodically during the search
    const progressInterval = setInterval(() => {
      const job = getJob(jobId)
      if (job && job.status === 'processing' && job.progress < 90) {
        // Gradually increment progress (simulated)
        updateJobProgress(jobId, Math.min(90, job.progress + 5))
      }
    }, 3000) // Update every 3 seconds
    
    try {
      console.log(`🔗 Calling search handler directly for job ${jobId}`)
      
      // Import and call the search POST handler directly (avoids HTTP fetch issues)
      const { POST: searchHandler } = await import('../search/route')
      
      // Create a mock request object
      const mockRequest = {
        json: async () => body,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-Job-Id': jobId
        })
      } as NextRequest
      
      const searchResponse = await searchHandler(mockRequest)
      
      clearInterval(progressInterval)
      
      console.log(`📡 Search handler response status: ${searchResponse.status}`)
      
      if (!searchResponse.ok) {
        const errorText = await searchResponse.text()
        console.error(`❌ Search handler error response:`, errorText)
        throw new Error(`Search handler returned ${searchResponse.status}: ${errorText}`)
      }
      
      const results = await searchResponse.json()
      console.log(`✅ Search handler returned results for job ${jobId}`)
      
      // Complete the job with results
      await completeJob(jobId, results.results, results.meta)
      console.log(`✅ Job ${jobId} marked as completed`)
      
      // Send SMS notification if phone number was provided
      const job = getJob(jobId)
      if (job?.phoneNumber) {
        console.log(`📱 Sending SMS notification to ${job.phoneNumber}`)
        const smsSent = await sendSearchResultsNotification(job.phoneNumber, jobId)
        if (smsSent) {
          console.log(`✅ SMS notification sent successfully for job ${jobId}`)
        } else {
          console.error(`❌ Failed to send SMS notification for job ${jobId}`)
        }
      }
      
    } catch (searchError: any) {
      clearInterval(progressInterval)
      console.error(`❌ Search handler error for job ${jobId}:`, searchError)
      throw searchError
    }
    
  } catch (error: any) {
    console.error(`❌ Job ${jobId} processing error:`, error)
    failJob(jobId, error.message || 'Unknown error')
  }
}

