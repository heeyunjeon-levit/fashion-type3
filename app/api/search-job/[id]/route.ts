import { NextRequest, NextResponse } from 'next/server'
import { getJobWithFallback, getJob } from '@/lib/jobQueue'

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
    console.log(`   Instance: ${process.env.VERCEL_REGION || 'local'}-${Date.now()}`)
    
    // Check memory first (synchronous check)
    const memoryJob = await getJob(jobId)
    console.log(`   Memory check: ${memoryJob ? `Found (${memoryJob.status})` : 'Not found'}`)
    
    // Try memory first, then database (for shareable links)
    const job = await getJobWithFallback(jobId)
    
    if (!job) {
      console.log(`❌ Job not found: ${jobId}`)
      console.log(`   Not in memory AND not in database`)
      return NextResponse.json(
        { error: 'Job not found', jobId },
        { status: 404 }
      )
    }
    
    const jobSource = memoryJob ? 'memory' : 'database'
    console.log(`✅ Job found: ${jobId}`)
    console.log(`   Status: ${job.status}`)
    console.log(`   Progress: ${job.progress}%`)
    console.log(`   Source: ${jobSource}`)
    console.log(`   Updated: ${new Date(job.updatedAt).toISOString()}`)
    
    if (jobSource === 'database') {
      console.log(`   ⚠️  Job was loaded from DATABASE (not in memory on this instance)`)
      console.log(`   This suggests job was processed by a different serverless instance`)
    }
    
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
    
    console.log(`📤 Returning to frontend:`)
    console.log(`   Status: ${response.status}`)
    console.log(`   Progress: ${response.progress}%`)
    console.log(`   Has results: ${!!response.results}`)
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

