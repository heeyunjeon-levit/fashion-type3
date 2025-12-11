-- Create search_jobs table for background job processing
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS search_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  phone_number TEXT,
  country_code TEXT,
  original_image_url TEXT,
  job_data JSONB, -- Stores all job parameters (categories, croppedImages, descriptions, etc.)
  results JSONB,
  meta JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster job lookups
CREATE INDEX IF NOT EXISTS idx_search_jobs_job_id ON search_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_search_jobs_status ON search_jobs(status);
CREATE INDEX IF NOT EXISTS idx_search_jobs_created_at ON search_jobs(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE search_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for service role (backend)
CREATE POLICY "Allow all for service role" ON search_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Allow reading your own job results (for shareable links)
CREATE POLICY "Allow reading job results" ON search_jobs
  FOR SELECT
  USING (true); -- Anyone can read completed jobs via shareable link

