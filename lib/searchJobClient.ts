/**
 * Client-side utility for managing search jobs with polling and notifications
 */

export interface JobStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  results?: any
  meta?: any
  error?: string
}

export interface JobPollOptions {
  onProgress?: (progress: number) => void
  onComplete?: (results: any, meta?: any) => void
  onError?: (error: string) => void
  fastPollInterval?: number  // Poll interval when tab is active (default: 2500ms)
  slowPollInterval?: number  // Poll interval when tab is inactive (default: 5000ms)
  maxAttempts?: number       // Max polling attempts (default: 150 = ~6 minutes)
  enableNotifications?: boolean  // Show browser notification when complete (default: true)
}

/**
 * Start a search job and return job ID
 */
export async function startSearchJob(params: {
  categories: string[]
  croppedImages: Record<string, string>
  descriptions?: Record<string, string>
  originalImageUrl?: string
  useOCRSearch?: boolean
  phoneNumber?: string
  countryCode?: string
}): Promise<string> {
  const response = await fetch('/api/search-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to start search job: ${error}`)
  }
  
  const data = await response.json()
  return data.jobId
}

/**
 * Poll a job until complete with smart frequency based on page visibility
 */
export async function pollJobUntilComplete(
  jobId: string,
  options: JobPollOptions = {}
): Promise<{ results: any; meta?: any }> {
  const {
    onProgress,
    onComplete,
    onError,
    fastPollInterval = 2500, // Slower: 2.5 seconds when tab visible
    slowPollInterval = 5000, // Slower: 5 seconds when tab hidden
    maxAttempts = 150,       // Fewer attempts but longer intervals = ~6 min total
    enableNotifications = true
  } = options
  
  let attempts = 0
  let isPageVisible = !document.hidden
  let consecutiveNotFoundErrors = 0
  
  // Request notification permission early (but don't block)
  // Wrap in try-catch for iOS Safari compatibility (doesn't support Notification API)
  try {
    if (enableNotifications && typeof Notification !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      console.log('🔔 Requesting notification permission...')
      Notification.requestPermission().then(permission => {
        console.log(`🔔 Notification permission: ${permission}`)
      }).catch(err => {
        console.log('Notification permission denied or not supported')
      })
    } else if (enableNotifications && typeof Notification !== 'undefined' && 'Notification' in window) {
      console.log(`🔔 Notification permission status: ${Notification.permission}`)
    }
  } catch (err) {
    console.log('⚠️ Notifications not supported on this browser (iOS Safari)')
  }
  
  // Track page visibility
  const handleVisibilityChange = () => {
    const wasVisible = isPageVisible
    isPageVisible = !document.hidden
    
    if (wasVisible !== isPageVisible) {
      console.log(`👁️ Page visibility changed: ${isPageVisible ? 'VISIBLE' : 'HIDDEN'}`)
    }
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  // LONGER initial delay to let job creation complete (avoid race condition)
  // This is especially important when multiple jobs are created simultaneously
  console.log(`⏳ Waiting 2s before first poll for job ${jobId}...`)
  await sleep(2000)
  
  try {
    while (attempts < maxAttempts) {
      attempts++
      
      // Check job status
      let status
      try {
        status = await checkJobStatus(jobId)
        consecutiveNotFoundErrors = 0 // Reset counter on success
      } catch (error: any) {
        // Handle "Job not found" errors with exponential backoff
        if (error.message?.includes('Job not found')) {
          consecutiveNotFoundErrors++
          
          // Exponential backoff: 2s, 4s, 6s, 8s, 10s
          const retryDelay = Math.min(2000 * consecutiveNotFoundErrors, 10000)
          
          console.log(`⚠️ Job ${jobId} not found yet (attempt ${consecutiveNotFoundErrors}/8) - waiting ${retryDelay}ms...`)
          
          // If we get "not found" more than 8 times, something is wrong
          if (consecutiveNotFoundErrors > 8) {
            throw new Error(`Job ${jobId} not found after ${consecutiveNotFoundErrors} attempts - job may have failed to create`)
          }
          
          // Wait with exponential backoff
          await sleep(retryDelay)
          continue
        }
        throw error // Re-throw other errors
      }
      
      // Update progress
      if (onProgress && status.progress !== undefined) {
        onProgress(status.progress)
      }
      
      // Handle completion
      if (status.status === 'completed') {
        console.log(`✅ Job ${jobId} completed (${attempts} polls)`)
        
        // Show notification if page is hidden (wrap in try-catch for iOS Safari)
        try {
          if (typeof Notification !== 'undefined') {
            console.log(`🔔 Notification check: isPageVisible=${isPageVisible}, enableNotifications=${enableNotifications}, permission=${Notification.permission}`)
            
            if (!isPageVisible && enableNotifications && Notification.permission === 'granted') {
              console.log(`🔔 Showing notification for completed job ${jobId}`)
              showJobCompleteNotification()
            } else if (!isPageVisible && enableNotifications) {
              console.log(`⚠️ Cannot show notification: permission is ${Notification.permission}`)
            } else if (isPageVisible) {
              console.log(`ℹ️ Page is visible, skipping notification (user is watching)`)
            }
          } else {
            console.log(`ℹ️ Notifications not supported on this browser (iOS Safari)`)
          }
        } catch (err) {
          console.log(`⚠️ Notification error (iOS Safari): ${err}`)
        }
        
        if (onComplete) {
          onComplete(status.results, status.meta)
        }
        
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        return { results: status.results, meta: status.meta }
      }
      
      // Handle failure
      if (status.status === 'failed') {
        const errorMsg = status.error || 'Unknown error'
        console.error(`❌ Job ${jobId} failed: ${errorMsg}`)
        
        if (onError) {
          onError(errorMsg)
        }
        
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        throw new Error(errorMsg)
      }
      
      // Wait before next poll (adjust based on visibility)
      const pollInterval = isPageVisible ? fastPollInterval : slowPollInterval
      await sleep(pollInterval)
    }
    
    // Max attempts reached
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    throw new Error('Job polling timeout - max attempts reached')
    
  } catch (error) {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    throw error
  }
}

/**
 * Check the status of a job
 */
export async function checkJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`/api/search-job/${jobId}`)
  
  if (!response.ok) {
    if (response.status === 404) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Job not found: ${jobId}`)
    }
    throw new Error(`Failed to check job status: ${response.status}`)
  }
  
  return await response.json()
}

/**
 * Show a browser notification when search completes
 * iOS Safari doesn't support the Notification API, so this will gracefully fail
 */
function showJobCompleteNotification() {
  try {
    // Extra safety check for iOS Safari
    if (typeof Notification === 'undefined') {
      console.log('⚠️ Notifications not supported on this browser')
      return
    }
    
    console.log('🔔 Creating notification object...')
    
    const notification = new Notification('✨ Your search is ready!', {
      body: 'Click to view your fashion search results',
      // Don't use favicon.ico - it might not exist or cause issues
      tag: 'search-complete',
      requireInteraction: false,
      silent: false
    })
    
    console.log('✅ Notification created successfully!', notification)
    
    // Focus the window when notification is clicked
    notification.onclick = () => {
      console.log('🖱️ Notification clicked!')
      window.focus()
      notification.close()
    }
    
    // Log when notification is shown
    notification.onshow = () => {
      console.log('👀 Notification is now visible to user')
    }
    
    // Log if notification errors
    notification.onerror = (error) => {
      console.error('❌ Notification error:', error)
    }
    
    // Auto-close after 10 seconds
    setTimeout(() => {
      console.log('⏰ Auto-closing notification after 10s')
      notification.close()
    }, 10000)
  } catch (err) {
    console.error('❌ Failed to create notification (likely iOS Safari):', err)
  }
}

/**
 * Utility: Sleep for a duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * High-level function: Start a search job and poll until complete
 */
export async function searchWithJobQueue(
  params: {
    categories: string[]
    croppedImages: Record<string, string>
    descriptions?: Record<string, string>
    originalImageUrl?: string
    useOCRSearch?: boolean
    phoneNumber?: string
    countryCode?: string
  },
  options: JobPollOptions = {}
): Promise<{ results: any; meta?: any }> {
  console.log('🚀 Starting search with job queue...')
  console.log(params.phoneNumber ? `📱 SMS notification enabled for: ${params.phoneNumber}` : '📱 No SMS notification')
  
  // Start the job
  const jobId = await startSearchJob(params)
  console.log(`📋 Job created: ${jobId}`)
  
  // Poll until complete
  return await pollJobUntilComplete(jobId, options)
}

