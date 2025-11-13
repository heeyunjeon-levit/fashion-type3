-- Result Page Visit Tracking
-- Tracks every time a user revisits their result page

CREATE TABLE IF NOT EXISTS result_page_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    result_page_url TEXT NOT NULL,
    visit_timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Session tracking (to identify unique visits vs page refreshes)
    session_id TEXT NOT NULL, -- Generated in browser, persists for session
    
    -- Browser/device info
    user_agent TEXT,
    referrer TEXT, -- Where they came from (SMS, direct link, etc)
    
    -- Engagement metrics
    time_on_page_seconds INTEGER, -- How long they stayed (tracked on next visit or page unload)
    clicked_products BOOLEAN DEFAULT false, -- Did they click any product?
    clicked_toggle_button BOOLEAN DEFAULT false, -- Did they view original image?
    opened_feedback BOOLEAN DEFAULT false -- Did they open feedback modal/tab?
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_visits_phone ON result_page_visits(phone_number);
CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON result_page_visits(visit_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_visits_session ON result_page_visits(session_id);

-- Enable Row Level Security
ALTER TABLE result_page_visits ENABLE ROW LEVEL SECURITY;

-- RLS Policy (allow service role full access)
DROP POLICY IF EXISTS "Allow service role full access to result_page_visits" ON result_page_visits;
CREATE POLICY "Allow service role full access to result_page_visits" ON result_page_visits
    FOR ALL USING (true);

-- Analytics Views

-- View: User revisit summary
CREATE OR REPLACE VIEW user_revisit_summary AS
SELECT 
    phone_number,
    COUNT(DISTINCT session_id) as total_visits,
    COUNT(DISTINCT DATE(visit_timestamp)) as days_visited,
    MIN(visit_timestamp) as first_visit,
    MAX(visit_timestamp) as last_visit,
    AVG(time_on_page_seconds) as avg_time_on_page,
    SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END) as visits_with_clicks,
    SUM(CASE WHEN opened_feedback THEN 1 ELSE 0 END) as visits_with_feedback,
    ROUND(
        SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END)::numeric / 
        COUNT(*)::numeric * 100, 
        1
    ) as click_rate_percent
FROM result_page_visits
GROUP BY phone_number
ORDER BY total_visits DESC;

-- View: Most engaged users (multiple revisits)
CREATE OR REPLACE VIEW most_engaged_users AS
SELECT 
    phone_number,
    COUNT(DISTINCT session_id) as visit_count,
    MAX(visit_timestamp) as last_visit,
    EXTRACT(EPOCH FROM (MAX(visit_timestamp) - MIN(visit_timestamp)))/3600 as engagement_span_hours
FROM result_page_visits
GROUP BY phone_number
HAVING COUNT(DISTINCT session_id) > 1
ORDER BY visit_count DESC, last_visit DESC;

-- View: Recent activity (last 24 hours)
CREATE OR REPLACE VIEW recent_visits AS
SELECT 
    phone_number,
    visit_timestamp,
    time_on_page_seconds,
    clicked_products,
    opened_feedback
FROM result_page_visits
WHERE visit_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY visit_timestamp DESC;

COMMENT ON TABLE result_page_visits IS 'Tracks every visit to result pages to identify engaged users';
COMMENT ON VIEW user_revisit_summary IS 'Summary of user revisit behavior';
COMMENT ON VIEW most_engaged_users IS 'Users who have visited multiple times (highest engagement)';

