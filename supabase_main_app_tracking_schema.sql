-- Main MVP App Visit Tracking
-- Tracks visits to the main application (homepage, upload, analyze)

CREATE TABLE IF NOT EXISTS app_page_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    page_path TEXT NOT NULL, -- e.g., '/', '/upload', '/analyze'
    visit_timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- User identification (if available)
    user_id TEXT, -- For logged-in users (future)
    device_id TEXT, -- Browser fingerprint or localStorage ID
    
    -- Session info
    is_new_session BOOLEAN DEFAULT false,
    referrer TEXT,
    user_agent TEXT,
    
    -- Engagement
    time_on_page_seconds INTEGER,
    scroll_depth_percent INTEGER, -- How far they scrolled (0-100)
    
    -- Actions taken
    uploaded_image BOOLEAN DEFAULT false,
    completed_analysis BOOLEAN DEFAULT false,
    clicked_search BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_visits_session ON app_page_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_app_visits_timestamp ON app_page_visits(visit_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_visits_page ON app_page_visits(page_path);
CREATE INDEX IF NOT EXISTS idx_app_visits_device ON app_page_visits(device_id);

-- Enable RLS
ALTER TABLE app_page_visits ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Allow service role full access to app_page_visits" ON app_page_visits;
CREATE POLICY "Allow service role full access to app_page_visits" ON app_page_visits
    FOR ALL USING (true);

-- Analytics Views

-- View: Page popularity
CREATE OR REPLACE VIEW page_popularity AS
SELECT 
    page_path,
    COUNT(*) as total_visits,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT device_id) as unique_devices,
    AVG(time_on_page_seconds) as avg_time_on_page,
    AVG(scroll_depth_percent) as avg_scroll_depth
FROM app_page_visits
GROUP BY page_path
ORDER BY total_visits DESC;

-- View: User funnel (conversion tracking)
CREATE OR REPLACE VIEW user_funnel AS
SELECT 
    COUNT(DISTINCT CASE WHEN page_path = '/' THEN session_id END) as homepage_visits,
    COUNT(DISTINCT CASE WHEN uploaded_image THEN session_id END) as uploaded_image,
    COUNT(DISTINCT CASE WHEN completed_analysis THEN session_id END) as completed_analysis,
    COUNT(DISTINCT CASE WHEN clicked_search THEN session_id END) as clicked_search,
    ROUND(
        COUNT(DISTINCT CASE WHEN uploaded_image THEN session_id END)::numeric / 
        NULLIF(COUNT(DISTINCT CASE WHEN page_path = '/' THEN session_id END), 0)::numeric * 100,
        1
    ) as upload_rate_percent,
    ROUND(
        COUNT(DISTINCT CASE WHEN completed_analysis THEN session_id END)::numeric / 
        NULLIF(COUNT(DISTINCT CASE WHEN uploaded_image THEN session_id END), 0)::numeric * 100,
        1
    ) as completion_rate_percent
FROM app_page_visits
WHERE visit_timestamp > NOW() - INTERVAL '7 days';

-- View: Session summary
CREATE OR REPLACE VIEW session_summary AS
SELECT 
    session_id,
    MIN(visit_timestamp) as session_start,
    MAX(visit_timestamp) as session_end,
    COUNT(*) as pages_viewed,
    STRING_AGG(DISTINCT page_path, ' → ' ORDER BY visit_timestamp) as user_journey,
    MAX(uploaded_image::int) > 0 as uploaded_image,
    MAX(completed_analysis::int) > 0 as completed_analysis,
    SUM(time_on_page_seconds) as total_time_seconds
FROM app_page_visits
GROUP BY session_id
ORDER BY session_start DESC;

-- View: Daily activity
CREATE OR REPLACE VIEW daily_activity AS
SELECT 
    DATE(visit_timestamp) as date,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(*) as total_page_views,
    COUNT(DISTINCT device_id) as unique_devices,
    AVG(time_on_page_seconds) as avg_time_per_page,
    SUM(CASE WHEN uploaded_image THEN 1 ELSE 0 END) as uploads,
    SUM(CASE WHEN completed_analysis THEN 1 ELSE 0 END) as analyses
FROM app_page_visits
GROUP BY DATE(visit_timestamp)
ORDER BY date DESC;

COMMENT ON TABLE app_page_visits IS 'Tracks visits to main MVP application pages';
COMMENT ON VIEW page_popularity IS 'Shows most popular pages in the app';
COMMENT ON VIEW user_funnel IS 'Conversion funnel from homepage to completion';
COMMENT ON VIEW session_summary IS 'Summary of each user session with journey path';

