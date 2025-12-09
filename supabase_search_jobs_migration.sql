-- Create search_jobs table for persistent storage of search results
-- This allows SMS links to work even after server restart

CREATE TABLE IF NOT EXISTS public.search_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  phone_number TEXT,
  country_code TEXT,
  categories TEXT[] DEFAULT '{}',
  original_image_url TEXT,
  results JSONB,
  meta JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  CONSTRAINT search_jobs_progress_check CHECK (progress >= 0 AND progress <= 100)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_search_jobs_job_id ON public.search_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_search_jobs_phone_number ON public.search_jobs(phone_number);
CREATE INDEX IF NOT EXISTS idx_search_jobs_created_at ON public.search_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_jobs_status ON public.search_jobs(status);

-- Add RLS (Row Level Security) policies if needed
-- For now, allow public read access to completed jobs (for SMS links)
ALTER TABLE public.search_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to completed jobs"
  ON public.search_jobs
  FOR SELECT
  USING (status = 'completed');

CREATE POLICY "Allow service role full access"
  ON public.search_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Optional: Add cleanup function to delete old jobs
CREATE OR REPLACE FUNCTION cleanup_old_search_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.search_jobs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule cleanup to run daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-jobs', '0 0 * * *', 'SELECT cleanup_old_search_jobs()');

COMMENT ON TABLE public.search_jobs IS 'Stores completed search jobs for SMS link sharing';
COMMENT ON COLUMN public.search_jobs.job_id IS 'Unique job identifier used in URLs';
COMMENT ON COLUMN public.search_jobs.phone_number IS 'Phone number for SMS notification';
COMMENT ON COLUMN public.search_jobs.results IS 'Search results data in JSON format';

