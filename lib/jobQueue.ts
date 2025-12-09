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

export function createJob(input: {
  categories: string[]
  croppedImages: Record<string, string | { imageUrl: string; description?: string; isSingleItemMode?: boolean }>
  descriptions?: Record<string, string>
  originalImageUrl?: string
  useOCRSearch?: boolean
  phoneNumber?: string
  countryCode?: string
}): SearchJob {
  const id = generateJobId()
  const job: SearchJob = {
    id,
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...input
  }
  
  jobs.set(id, job)
  console.log(`✅ Created job ${id}${job.phoneNumber ? ` with phone number ${job.phoneNumber}` : ''}`)
  
  // Schedule cleanup
  setTimeout(() => {
    if (jobs.has(id)) {
      console.log(`🗑️  Cleaning up expired job ${id}`)
      jobs.delete(id)
    }
  }, JOB_EXPIRY_MS)
  
  return job
}

export function getJob(id: string): SearchJob | undefined {
  const job = jobs.get(id)
  if (!job) {
    console.log(`⚠️  Job ${id} not in queue. Available jobs: [${Array.from(jobs.keys()).join(', ')}]`)
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

export function updateJobProgress(id: string, progress: number, status?: SearchJob['status']): void {
  const job = jobs.get(id)
  if (job) {
    job.progress = progress
    job.updatedAt = Date.now()
    if (status) {
      job.status = status
    }
    jobs.set(id, job)
    console.log(`📊 Job ${id} progress: ${progress}% (${job.status})`)
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
    
    // Save to database for persistence (don't await - fire and forget)
    saveJobToDatabase(job).catch(err => {
      console.error(`Failed to save completed job ${id} to database:`, err)
    })
  }
}

export function failJob(id: string, error: string): void {
  const job = jobs.get(id)
  if (job) {
    job.status = 'failed'
    job.error = error
    job.updatedAt = Date.now()
    jobs.set(id, job)
    console.log(`❌ Job ${id} failed: ${error}`)
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
    
    const { error } = await supabase
      .from('search_jobs')
      .upsert({
        job_id: job.id,
        status: job.status,
        progress: job.progress,
        phone_number: job.phoneNumber,
        country_code: job.countryCode,
        categories: job.categories,
        original_image_url: job.originalImageUrl,
        results: job.results,
        meta: job.meta,
        error: job.error,
        created_at: new Date(job.createdAt).toISOString(),
        updated_at: new Date(job.updatedAt).toISOString(),
      })
    
    if (error) {
      console.error(`❌ Failed to save job ${job.id} to database:`, error)
      return false
    }
    
    console.log(`💾 Saved job ${job.id} to database`)
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
    
    const { data, error } = await supabase
      .from('search_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single()
    
    if (error || !data) {
      console.log(`⚠️  Job ${jobId} not found in database`)
      return null
    }
    
    // Convert database row back to SearchJob format
    const job: SearchJob = {
      id: data.job_id,
      status: data.status,
      progress: data.progress,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      categories: data.categories || [],
      croppedImages: {}, // Not stored in DB (temporary data)
      originalImageUrl: data.original_image_url,
      phoneNumber: data.phone_number,
      countryCode: data.country_code,
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
 */
export async function getJobWithFallback(jobId: string): Promise<SearchJob | undefined> {
  // Try memory first (faster)
  const memoryJob = getJob(jobId)
  if (memoryJob) {
    return memoryJob
  }
  
  // Fall back to database (for shareable links)
  const dbJob = await loadJobFromDatabase(jobId)
  return dbJob || undefined
}

// Debug: Log job count periodically
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    if (jobs.size > 0) {
      console.log(`💼 Active jobs: ${jobs.size}`)
    }
  }, 30000)
}

