import { NextRequest, NextResponse } from 'next/server'
import { getJobWithFallback } from '@/lib/jobQueue'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/search-job/[id]
 * Check the status of a search job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 13+
    const { id: jobId } = await params
    
    console.log(`🔍 Checking status for job: ${jobId}`)
    // Try memory first, then database (for shareable links)
    const job = await getJobWithFallback(jobId)
    
    if (!job) {
      console.log(`❌ Job not found: ${jobId}`)
      return NextResponse.json(
        { error: 'Job not found', jobId },
        { status: 404 }
      )
    }
    
    console.log(`✅ Job found: ${jobId}, status: ${job.status}, progress: ${job.progress}%`)
    
    // Debug: Log results structure
    if (job.status === 'completed') {
      console.log(`📦 Job ${jobId} results keys:`, job.results ? Object.keys(job.results) : 'null')
      console.log(`📦 Job ${jobId} results preview:`, JSON.stringify(job.results).substring(0, 200))
    }
    
    // Return job status
    const response = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      // Include results if completed
      ...(job.status === 'completed' && {
        results: job.results,
        meta: job.meta,
        originalImageUrl: job.originalImageUrl,
        croppedImages: job.croppedImages
      }),
      // Include error if failed
      ...(job.status === 'failed' && {
        error: job.error
      })
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

