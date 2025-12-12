/**
 * Job queue for background search processing
 * - In-memory storage for active jobs (fast access during processing)
 * - Supabase persistence for completed jobs (shareable via SMS links)
 */

import { getSupabaseServerClient } from './supabaseServer'

export interface SearchJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  createdAt: number
  updatedAt: number
  
  // Input data
  categories: string[]
  croppedImages: Record<string, string | { imageUrl: string; description?: string; isSingleItemMode?: boolean }>
  descriptions?: Record<string, string>
  originalImageUrl?: string
  useOCRSearch?: boolean
  phoneNumber?: string  // Added for SMS notifications
  countryCode?: string  // Added for phone number formatting
  
  // Output data (when completed)
  results?: any
  meta?: any
  error?: string
}

// In-memory storage (will persist during server lifetime)
// Use globalThis to ensure singleton across module instances in dev mode
declare global {
  var __job_queue__: Map<string, SearchJob> | undefined
}

if (!globalThis.__job_queue__) {
  globalThis.__job_queue__ = new Map<string, SearchJob>()
}
const jobs = globalThis.__job_queue__

// Cleanup old jobs after 1 hour
const JOB_EXPIRY_MS = 60 * 60 * 1000

export async function createJob(input: {
  categories: string[]
  croppedImages: Record<string, string | { imageUrl: string; description?: string; isSingleItemMode?: boolean }>
  descriptions?: Record<string, string>
  originalImageUrl?: string
  useOCRSearch?: boolean
  phoneNumber?: string
  countryCode?: string
}): Promise<SearchJob> {
  const id = generateJobId()
  const job: SearchJob = {
    id,
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...input
  }
  
  // Store in memory for fast access
  jobs.set(id, job)
  console.log(`✅ Created job ${id}${job.phoneNumber ? ` with phone number ${job.phoneNumber}` : ''}`)
  console.log(`   Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log(`   Has Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'yes' : 'NO'}`)
  
  // CRITICAL: Save to database immediately so job persists across server restarts
  const saved = await saveJobToDatabase(job)
  if (!saved) {
    console.error(`⚠️  WARNING: Job ${id} was NOT saved to database! It will only exist in memory.`)
  }
  
  // Schedule cleanup from memory only (DB entries cleaned up separately)
  setTimeout(() => {
    if (jobs.has(id)) {
      console.log(`🗑️  Cleaning up expired job ${id} from memory`)
      jobs.delete(id)
    }
  }, JOB_EXPIRY_MS)
  
  return job
}

export async function getJob(id: string): Promise<SearchJob | undefined> {
  // Check memory first (fast path)
  let job = jobs.get(id)
  
  // If not in memory, check database (for cross-instance persistence)
  if (!job) {
    console.log(`⚠️  Job ${id} not in memory. Checking database...`)
    const dbJob = await loadJobFromDatabase(id)
    job = dbJob ?? undefined  // Convert null to undefined for consistent typing
    
    if (job) {
      // Cache in memory for future access
      jobs.set(id, job)
      console.log(`✅ Loaded job ${id} from database (phone: ${job.phoneNumber ? '✓' : '✗'})`)
    } else {
      console.log(`❌ Job ${id} not found in database. Available jobs in memory: [${Array.from(jobs.keys()).join(', ')}]`)
    }
  }
  
  return job
}

export function updateJob(id: string, updates: Partial<SearchJob>): void {
  const job = jobs.get(id)
  if (job) {
    Object.assign(job, { ...updates, updatedAt: Date.now() })
    jobs.set(id, job)
  }
}

export async function updateJobProgress(id: string, progress: number, status?: SearchJob['status']): Promise<void> {
  const job = jobs.get(id)
  if (job) {
    job.progress = progress
    job.updatedAt = Date.now()
    if (status) {
      job.status = status
    }
    jobs.set(id, job)
    console.log(`📊 Job ${id} progress: ${progress}% (${job.status})`)
    
    // Persist to database so progress survives server restarts
    const saved = await saveJobToDatabase(job)
    if (!saved) {
      console.error(`⚠️ Failed to persist progress for job ${id} to database`)
      // Non-critical - progress updates can fail without breaking the job
    }
  }
}

export async function completeJob(id: string, results: any, meta?: any): Promise<void> {
  const job = jobs.get(id)
  if (job) {
    job.status = 'completed'
    job.progress = 100
    job.results = results
    job.meta = meta
    job.updatedAt = Date.now()
    jobs.set(id, job)
    console.log(`✅ Job ${id} completed`)
    
    // CRITICAL: MUST save to database for persistence (await it!)
    const saved = await saveJobToDatabase(job)
    if (!saved) {
      console.error(`⚠️ CRITICAL: Failed to save completed job ${id} to database!`)
      console.error(`   Job will appear completed in memory but stuck in 'processing' in database`)
      // Don't throw - job is still completed in memory for immediate access
    } else {
      console.log(`💾 Job ${id} completion saved to database successfully`)
    }
  }
}

export async function failJob(id: string, error: string): Promise<void> {
  const job = jobs.get(id)
  if (job) {
    job.status = 'failed'
    job.error = error
    job.updatedAt = Date.now()
    jobs.set(id, job)
    console.log(`❌ Job ${id} failed: ${error}`)
    
    // Persist failure to database
    await saveJobToDatabase(job).catch(err => {
      console.error(`Failed to persist failure for job ${id}:`, err)
    })
  }
}

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Save completed job to Supabase for persistence
 * Allows jobs to be accessed via shareable links even after server restart
 */
export async function saveJobToDatabase(job: SearchJob): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient()
    
    // Minimal save - only use columns we're certain exist
    // Try to save, and if it fails, log but don't crash (jobs work in-memory)
    const payload: any = {
      job_id: job.id,
      status: job.status,
      progress: job.progress || 0,
      created_at: new Date(job.createdAt).toISOString(),
      updated_at: new Date(job.updatedAt).toISOString(),
    }
    
    // Add optional fields only if they exist
    if (job.phoneNumber) payload.phone_number = job.phoneNumber
    if (job.countryCode) payload.country_code = job.countryCode
    if (job.originalImageUrl) payload.original_image_url = job.originalImageUrl
    if (job.results) payload.results = job.results
    if (job.meta) payload.meta = job.meta
    if (job.error) payload.error = job.error
    
    // Try to store full job data as JSON if column exists
    try {
      payload.job_data = {
        categories: job.categories,
        croppedImages: job.croppedImages,
        descriptions: job.descriptions,
        originalImageUrl: job.originalImageUrl,
        useOCRSearch: job.useOCRSearch,
        phoneNumber: job.phoneNumber,
        countryCode: job.countryCode
      }
    } catch {
      // If job_data column doesn't exist, that's ok
    }
    
    const { error } = await supabase
      .from('search_jobs')
      .upsert(payload, {
        onConflict: 'job_id',  // Use job_id as unique key for updates
        ignoreDuplicates: false // Always update if exists
      })
    
    if (error) {
      console.error(`❌ Failed to save job ${job.id} to database:`, error)
      console.error(`   Error code: ${error.code}`)
      console.error(`   Error message: ${error.message}`)
      console.error(`   Error details: ${JSON.stringify(error.details)}`)
      console.error(`   Payload attempted:`, JSON.stringify(payload, null, 2))
      return false
    }
    
    console.log(`💾 Saved job ${job.id} to database successfully`)
    console.log(`   Status saved: ${job.status}`)
    console.log(`   Progress saved: ${job.progress}%`)
    
    // Small delay to ensure database transaction commits (Supabase async replication)
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Verify the save by reading it back with fresh query
    const { data: verifyData } = await supabase
      .from('search_jobs')
      .select('status, progress, updated_at')
      .eq('job_id', job.id)
      .single()
    
    if (verifyData) {
      console.log(`   ✅ Verified in DB: status=${verifyData.status}, progress=${verifyData.progress}`)
      if (verifyData.status !== job.status) {
        console.error(`   ⚠️  DATABASE MISMATCH! Saved ${job.status} but DB shows ${verifyData.status}`)
        console.error(`   This indicates the upsert is not updating existing rows!`)
        return false // Treat as failure
      }
    } else {
      console.error(`   ⚠️  Could not verify save - job not found in DB immediately after save!`)
      return false // Treat as failure
    }
    
    return true
  } catch (error) {
    console.error(`❌ Error saving job to database:`, error)
    return false
  }
}

/**
 * Load job from Supabase (for shareable links)
 */
export async function loadJobFromDatabase(jobId: string): Promise<SearchJob | null> {
  try {
    const supabase = getSupabaseServerClient()
    
    console.log(`🔍 Querying database for job ${jobId}...`)
    
    // Add cache-busting header to force fresh data from Supabase
    const { data, error } = await supabase
      .from('search_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single()
      .abortSignal(AbortSignal.timeout(5000)) // 5s timeout
    
    if (error) {
      // If table doesn't exist, that's OK - we work in-memory only
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.log(`⚠️  Database table not setup - working in-memory only`)
        return null
      }
      console.log(`⚠️  Job ${jobId} not found in database:`, error.message)
      return null
    }
    
    if (!data) {
      console.log(`⚠️  Job ${jobId} not found in database (no data)`)
      return null
    }
    
    console.log(`📂 Found ${jobId} in database:`)
    console.log(`   Status in DB: ${data.status}`)
    console.log(`   Progress in DB: ${data.progress}%`)
    console.log(`   Updated in DB: ${data.updated_at}`)
    
    // Convert database row back to SearchJob format
    // Reconstruct from job_data JSON field if available
    const jobData = data.job_data || {}
    
    const job: SearchJob = {
      id: data.job_id,
      status: data.status,
      progress: data.progress,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      categories: jobData.categories || data.categories || [],
      croppedImages: jobData.croppedImages || {},
      descriptions: jobData.descriptions || {},
      originalImageUrl: jobData.originalImageUrl || data.original_image_url,
      useOCRSearch: jobData.useOCRSearch || false,
      phoneNumber: jobData.phoneNumber || data.phone_number,
      countryCode: jobData.countryCode || data.country_code,
      results: data.results,
      meta: data.meta,
      error: data.error,
    }
    
    console.log(`📂 Loaded job ${jobId} from database`)
    return job
  } catch (error) {
    console.error(`❌ Error loading job from database:`, error)
    return null
  }
}

/**
 * Get job from memory or database
 * First checks in-memory cache, then falls back to database
 * If found in DB but not in memory, populates memory cache
 */
export async function getJobWithFallback(jobId: string): Promise<SearchJob | undefined> {
  // Try memory first (faster), then database
  const memoryJob = await getJob(jobId)
  if (memoryJob) {
    return memoryJob
  }
  
  // Fall back to database (for shareable links or cross-instance jobs)
  console.log(`🔄 Job ${jobId} not in memory, loading from database...`)
  const dbJob = await loadJobFromDatabase(jobId)
  
  if (dbJob) {
    // Populate memory cache for faster subsequent access
    jobs.set(jobId, dbJob)
    console.log(`✅ Loaded job ${jobId} from database into memory cache`)
    return dbJob
  }
  
  return undefined
}

// Debug: Log job count periodically
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    if (jobs.size > 0) {
      console.log(`💼 Active jobs: ${jobs.size}`)
    }
  }, 30000)
}

