-- Supabase Schema for User Logging & Analytics
-- Run this SQL in your Supabase SQL Editor

-- 1. Users table (stores phone numbers and basic info)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT UNIQUE NOT NULL,
    country_code TEXT DEFAULT '+82', -- Korean country code
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    total_searches INTEGER DEFAULT 0,
    notes TEXT -- For user interview notes
);

-- 2. Sessions table (tracks each user session)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Nullable until phone number provided
    session_id TEXT UNIQUE NOT NULL, -- Client-generated session ID
    phone_number TEXT, -- Denormalized for easy querying
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'in_progress', -- in_progress, completed, abandoned
    
    -- Session data
    uploaded_image_url TEXT,
    uploaded_at TIMESTAMPTZ,
    
    gpt_analysis JSONB, -- Store full GPT analysis result
    analyzed_at TIMESTAMPTZ,
    
    cropped_images JSONB, -- Array of {category, url, description}
    cropped_at TIMESTAMPTZ,
    
    selected_items JSONB, -- Array of items user selected
    selected_at TIMESTAMPTZ,
    
    search_results JSONB, -- Full search results
    searched_at TIMESTAMPTZ,
    
    gpt_selection_reasoning JSONB, -- Store GPT prompts and responses for each item
    
    phone_collected_at TIMESTAMPTZ -- When user provided phone number
);

-- 3. Events table (detailed event log for user actions)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'image_upload', 'gpt_analysis', 'item_cropped', 'item_selected', 'search_started', 'link_clicked', 'phone_provided'
    event_data JSONB, -- Flexible data storage
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Link clicks table (track which product links users click)
CREATE TABLE IF NOT EXISTS link_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    item_category TEXT NOT NULL, -- 'tops', 'bottoms', etc.
    item_description TEXT, -- 'gray shirt', 'black pants'
    
    product_link TEXT NOT NULL,
    product_title TEXT,
    product_thumbnail TEXT,
    
    link_position INTEGER, -- 1, 2, or 3 (which of the 3 links)
    
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_clicks_session_id ON link_clicks(session_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_user_id ON link_clicks(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow service role to do everything)
-- Drop existing policies first to make script idempotent
DROP POLICY IF EXISTS "Allow service role full access to users" ON users;
DROP POLICY IF EXISTS "Allow service role full access to sessions" ON sessions;
DROP POLICY IF EXISTS "Allow service role full access to events" ON events;
DROP POLICY IF EXISTS "Allow service role full access to link_clicks" ON link_clicks;

CREATE POLICY "Allow service role full access to users" ON users
    FOR ALL USING (true);

CREATE POLICY "Allow service role full access to sessions" ON sessions
    FOR ALL USING (true);

CREATE POLICY "Allow service role full access to events" ON events
    FOR ALL USING (true);

CREATE POLICY "Allow service role full access to link_clicks" ON link_clicks
    FOR ALL USING (true);

-- View for analytics: Sessions with user info
CREATE OR REPLACE VIEW session_analytics AS
SELECT 
    s.*,
    u.phone_number as user_phone,
    u.total_searches as user_total_searches,
    u.created_at as user_first_seen,
    (SELECT COUNT(*) FROM link_clicks WHERE session_id = s.id) as total_clicks
FROM sessions s
LEFT JOIN users u ON s.user_id = u.id
ORDER BY s.created_at DESC;

-- Function to update user's last active time and search count
CREATE OR REPLACE FUNCTION update_user_activity(p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users 
    SET 
        last_active_at = NOW(),
        total_searches = total_searches + 1
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores unique users identified by phone number';
COMMENT ON TABLE sessions IS 'Tracks each complete user journey from upload to results';
COMMENT ON TABLE events IS 'Detailed event log for all user actions';
COMMENT ON TABLE link_clicks IS 'Tracks which product links users clicked';

