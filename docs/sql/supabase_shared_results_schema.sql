-- Create table for shared search results
CREATE TABLE IF NOT EXISTS shared_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Original search data
  original_image_url TEXT,
  selected_items JSONB,
  
  -- Search results (key-value pairs of category and product links)
  results JSONB NOT NULL,
  
  -- Metadata
  session_id TEXT,
  user_phone TEXT,
  search_mode TEXT, -- 'interactive', 'ocr', 'fallback'
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_shared_results_created_at ON shared_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_results_session_id ON shared_results(session_id);

-- Enable Row Level Security
ALTER TABLE shared_results ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read shared results (they're meant to be shared!)
CREATE POLICY "Anyone can read shared results" ON shared_results
  FOR SELECT
  USING (deleted_at IS NULL);

-- Policy: Anyone can insert (no auth required for now)
CREATE POLICY "Anyone can create shared results" ON shared_results
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only system can update (for view counts)
CREATE POLICY "Service role can update" ON shared_results
  FOR UPDATE
  USING (true);

-- Comments
COMMENT ON TABLE shared_results IS 'Stores shareable search results that can be accessed via unique link';
COMMENT ON COLUMN shared_results.results IS 'JSON object with category keys and array of product links as values';
COMMENT ON COLUMN shared_results.selected_items IS 'Array of detected items with descriptions and cropped images';

