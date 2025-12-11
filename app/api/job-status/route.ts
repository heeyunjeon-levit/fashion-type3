import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/jobQueue'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/job-status?jobId=xxx
 * Check the status of a background job
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      )
    }
    
    console.log(`📊 Checking status for job ${jobId}`)
    
    const job = await getJob(jobId)
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    const response: any = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }
    
    if (job.status === 'completed') {
      response.results = job.results
      response.meta = job.meta
    } else if (job.status === 'failed') {
      response.error = job.error
    } else if (job.status === 'pending') {
      response.message = 'Job is waiting to be processed by cron worker (runs every minute)'
    } else if (job.status === 'processing') {
      response.message = 'Job is currently being processed'
    }
    
    return NextResponse.json(response)
    
  } catch (error: any) {
    console.error('Error checking job status:', error)
    return NextResponse.json(
      { error: 'Failed to check job status', details: error.message },
      { status: 500 }
    )
  }
}

