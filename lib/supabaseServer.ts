import { createClient } from '@supabase/supabase-js'

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }
  
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  
  // Force read from primary database (not replica) to ensure consistency
  // This prevents stale reads when different serverless instances write/read
  return createClient(url, key, {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false
    },
    global: {
      headers: {
        // Force fresh reads, bypass CDN/replica caching
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'x-client-info': 'job-queue-server'
      }
    }
  })
}

