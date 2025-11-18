-- ============================================================================
-- DEBUG: Why do we have clicks but no sessions?
-- ============================================================================

-- 1. Check if link_clicks have session_id that should exist
-- ============================================================================
SELECT 
    'Your Clicks' as info,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT user_id) as unique_users
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e';


-- 2. Show your actual click records with session info
-- ============================================================================
SELECT 
    lc.clicked_at,
    lc.session_id,
    lc.user_id,
    lc.item_category,
    lc.product_title,
    CASE 
        WHEN s.session_id IS NOT NULL THEN '✅ Session exists'
        ELSE '❌ Session missing'
    END as session_status
FROM link_clicks lc
LEFT JOIN sessions s ON lc.session_id::text = s.session_id::text
WHERE lc.user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
ORDER BY lc.clicked_at DESC
LIMIT 20;


-- 3. Check sessions table structure and content
-- ============================================================================
SELECT 
    'Total sessions in database' as info,
    COUNT(*) as count
FROM sessions

UNION ALL

SELECT 
    'Sessions with user_id field',
    COUNT(*)
FROM sessions
WHERE user_id IS NOT NULL

UNION ALL

SELECT 
    'Sessions with your user_id',
    COUNT(*)
FROM sessions
WHERE user_id::text = 'fc878118-43dd-4363-93cf-d31e453df81e';


-- 4. Check if sessions table has different column name
-- ============================================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sessions'
ORDER BY ordinal_position;


-- 5. Show a few random sessions to see structure
-- ============================================================================
SELECT 
    session_id,
    user_id,
    phone_number,
    created_at,
    status
FROM sessions
ORDER BY created_at DESC
LIMIT 10;


-- 6. Find sessions that match your click session_ids
-- ============================================================================
WITH your_click_sessions AS (
    SELECT DISTINCT session_id
    FROM link_clicks
    WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
)
SELECT 
    'Sessions from your clicks' as info,
    COUNT(*) as count
FROM sessions s
WHERE s.session_id IN (SELECT session_id::text FROM your_click_sessions);


-- 7. Check data types
-- ============================================================================
SELECT 
    'link_clicks session_id type' as field,
    pg_typeof(session_id) as type
FROM link_clicks
LIMIT 1

UNION ALL

SELECT 
    'sessions session_id type',
    pg_typeof(session_id)
FROM sessions
LIMIT 1

UNION ALL

SELECT 
    'link_clicks user_id type',
    pg_typeof(user_id)
FROM link_clicks
LIMIT 1

UNION ALL

SELECT 
    'sessions user_id type',
    pg_typeof(user_id)
FROM sessions
WHERE user_id IS NOT NULL
LIMIT 1;


