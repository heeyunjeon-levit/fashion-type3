import { createClient } from '@supabase/supabase-js'

// Singleton Supabase client for frontend use
// This prevents multiple GoTrueClient instances warning
let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey)
  }
  
  return supabaseClient
}

