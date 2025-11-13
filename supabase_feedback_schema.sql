-- User Feedback Table for Result Pages
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    satisfaction TEXT NOT NULL CHECK (satisfaction IN ('만족', '불만족')), -- '만족' or '불만족'
    comment TEXT, -- Optional user comment
    result_page_url TEXT, -- Which result page they gave feedback on
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Additional context
    user_agent TEXT, -- Browser/device info
    page_load_time INTEGER -- Seconds before feedback submitted
);

-- Index for querying
CREATE INDEX IF NOT EXISTS idx_feedback_phone ON user_feedback(phone_number);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_satisfaction ON user_feedback(satisfaction);

-- Enable Row Level Security
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy (allow service role full access)
DROP POLICY IF EXISTS "Allow service role full access to user_feedback" ON user_feedback;
CREATE POLICY "Allow service role full access to user_feedback" ON user_feedback
    FOR ALL USING (true);

-- View for analytics
CREATE OR REPLACE VIEW feedback_analytics AS
SELECT 
    satisfaction,
    COUNT(*) as total_responses,
    COUNT(comment) FILTER (WHERE comment IS NOT NULL AND comment != '') as responses_with_comments,
    ROUND(AVG(page_load_time), 1) as avg_time_to_feedback_seconds
FROM user_feedback
GROUP BY satisfaction;

COMMENT ON TABLE user_feedback IS 'Stores user satisfaction feedback from result pages';

