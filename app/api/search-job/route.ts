import { NextRequest, NextResponse } from 'next/server'
import { createJob, updateJobProgress, completeJob, failJob, getJob } from '@/lib/jobQueue'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Allow up to 5 minutes for search processing (Vercel Pro plan)
export const maxDuration = 300

/**
 * POST /api/search-job
 * Create a new search job and start processing in the background
 * Returns job ID immediately for polling
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { categories, croppedImages, descriptions, originalImageUrl, useOCRSearch, phoneNumber, countryCode } = body
    
    // Create job (now async - saves to DB immediately)
    const job = await createJob({
      categories,
      croppedImages,
      descriptions,
      originalImageUrl,
      useOCRSearch,
      phoneNumber,
      countryCode
    })
    
    console.log(`🚀 Created search job ${job.id}${phoneNumber ? ' with SMS notification' : ''}`)
    
    // ✅ BACKGROUND MODE: Job will be processed by cron worker
    // Return immediately so user can lock phone/close browser
    console.log(`📤 Job ${job.id} queued for background processing`)
    console.log(`   Cron worker will process this job within 1 minute`)
    console.log(`   ${phoneNumber ? `SMS will be sent to ${countryCode}${phoneNumber} when complete` : 'No SMS (phone number not provided)'}`)
      
      return NextResponse.json({
        jobId: job.id,
      status: 'pending',
        message: phoneNumber 
        ? 'Search started! We\'ll text you when it\'s ready. Feel free to lock your phone or close the browser.' 
        : 'Search started in background. Job will be processed by cron worker.',
      estimatedTime: '1-2 minutes'
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
 * EXPORTED so cron worker can call it
 */
export async function processSearchJob(jobId: string, body: any) {
  try {
    console.log(`⚙️ Processing job ${jobId}...`)
    await updateJobProgress(jobId, 5, 'processing')
    
    // Update progress periodically during the search
    const progressInterval = setInterval(async () => {
      const job = await getJob(jobId)
      if (job && job.status === 'processing' && job.progress < 90) {
        // Gradually increment progress - realistic pacing for typical 1-2 min searches
        // 3% every 4 seconds = ~2 minutes to reach 90%
        await updateJobProgress(jobId, Math.min(90, job.progress + 3))
      }
    }, 4000) // Update every 4 seconds
    
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
      const job = await getJob(jobId)
      console.log(`🔍 Checking SMS eligibility for job ${jobId}:`, {
        hasJob: !!job,
        hasPhoneNumber: !!job?.phoneNumber,
        phoneNumber: job?.phoneNumber
      })
      
      if (job?.phoneNumber) {
        console.log(`📱 Creating shareable result for SMS notification...`)
        
        try {
          // Create a shareable result directly in Supabase to get a permanent UUID link
          console.log(`   📦 Importing supabaseServer...`)
          const { getSupabaseServerClient } = await import('@/lib/supabaseServer')
          const supabase = getSupabaseServerClient()
          console.log(`   ✅ Supabase client created`)
          
          console.log(`   📝 Inserting shareable result to database...`)
          const { data: shareData, error: shareError } = await supabase
            .from('shared_results')
            .insert({
              results: results.results,
              original_image_url: job.originalImageUrl,
              selected_items: job.categories.map((cat: string) => ({
                category: cat,
                description: job.descriptions?.[cat] || '',
                croppedImageUrl: ''
              })),
              session_id: jobId,
              user_phone: job.phoneNumber,
              search_mode: job.useOCRSearch ? 'ocr' : 'interactive'
            })
            .select('id')
            .single()
          
          console.log(`   📊 Supabase response:`, { 
            hasData: !!shareData, 
            hasError: !!shareError,
            error: shareError 
          })
          
          if (shareError || !shareData) {
            console.error(`❌ Failed to create shareable result:`, shareError)
            throw shareError
          }
          
          const shareId = shareData.id
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const shareUrl = `${baseUrl}/results/${shareId}`
          
          console.log(`✅ Created shareable result: ${shareId}`)
          console.log(`📱 Sending SMS with shareable link: ${shareUrl}`)
          
          // Send SMS with the shareable UUID link
          const { sendSMS } = await import('@/lib/sms')
          const message = `요청하신 상품 검색이 완료되었습니다! 링크를 통해 결과를 확인하세요: ${shareUrl}`
          const smsSent = await sendSMS({
            to: job.phoneNumber,
            message
          })
          
          if (smsSent) {
            console.log(`✅ SMS notification sent successfully for job ${jobId}`)
          } else {
            console.error(`❌ Failed to send SMS notification for job ${jobId}`)
          }
        } catch (error) {
          console.error(`❌ Error creating shareable result or sending SMS:`, error)
        }
      }
      
    } catch (searchError: any) {
      clearInterval(progressInterval)
      console.error(`❌ Search handler error for job ${jobId}:`, searchError)
      throw searchError
    }
    
  } catch (error: any) {
    console.error(`❌ Job ${jobId} processing error:`, error)
    await failJob(jobId, error.message || 'Unknown error')
  }
}

