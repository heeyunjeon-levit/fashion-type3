/**
 * Simple in-memory job queue for background search processing
 * For production, consider Redis or a database-backed queue
 */

export interface SearchJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  createdAt: number
  updatedAt: number
  
  // Input data
  categories: string[]
  croppedImages: Record<string, string>
  descriptions?: Record<string, string>
  originalImageUrl?: string
  useOCRSearch?: boolean
  
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
  croppedImages: Record<string, string>
  descriptions?: Record<string, string>
  originalImageUrl?: string
  useOCRSearch?: boolean
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
  console.log(`✅ Created job ${id}`)
  
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

export function completeJob(id: string, results: any, meta?: any): void {
  const job = jobs.get(id)
  if (job) {
    job.status = 'completed'
    job.progress = 100
    job.results = results
    job.meta = meta
    job.updatedAt = Date.now()
    jobs.set(id, job)
    console.log(`✅ Job ${id} completed`)
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

// Debug: Log job count periodically
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    if (jobs.size > 0) {
      console.log(`💼 Active jobs: ${jobs.size}`)
    }
  }, 30000)
}

