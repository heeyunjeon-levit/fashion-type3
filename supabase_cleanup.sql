-- Clean up existing logging schema (run this if you want to start fresh)

-- Drop policies first
DROP POLICY IF EXISTS "Allow service role full access to users" ON users;
DROP POLICY IF EXISTS "Allow service role full access to sessions" ON sessions;
DROP POLICY IF EXISTS "Allow service role full access to events" ON events;
DROP POLICY IF EXISTS "Allow service role full access to link_clicks" ON link_clicks;

-- Drop view
DROP VIEW IF EXISTS session_analytics;

-- Drop function
DROP FUNCTION IF EXISTS update_user_activity(UUID);

-- Drop tables (CASCADE will remove foreign key constraints)
DROP TABLE IF EXISTS link_clicks CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Confirmation message
SELECT 'All logging tables and policies dropped successfully!' as message;

