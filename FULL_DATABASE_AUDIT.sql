-- ============================================================================
-- COMPLETE DATABASE AUDIT - Understand ALL tracking tables
-- ============================================================================

-- 1. USERS TABLE - Structure and sample data
-- ============================================================================
SELECT 'USERS TABLE STRUCTURE' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Sample users
SELECT 
    id,
    phone_number,
    country_code,
    total_searches,
    created_at,
    last_active_at
FROM users
ORDER BY total_searches DESC
LIMIT 5;


-- 2. SESSIONS TABLE - Structure and sample data
-- ============================================================================
SELECT 'SESSIONS TABLE STRUCTURE' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sessions'
ORDER BY ordinal_position;

-- Sample sessions with analysis
SELECT 
    session_id,
    user_id,
    phone_number,
    created_at,
    status,
    phone_collected_at,
    uploaded_image_url,
    selected_items,
    searched_at
FROM sessions
ORDER BY created_at DESC
LIMIT 10;

-- Sessions stats
SELECT 
    'Total sessions' as metric,
    COUNT(*) as count
FROM sessions

UNION ALL

SELECT 
    'Sessions with user_id',
    COUNT(*)
FROM sessions
WHERE user_id IS NOT NULL

UNION ALL

SELECT 
    'Sessions with phone_number',
    COUNT(*)
FROM sessions
WHERE phone_number IS NOT NULL;


-- 3. LINK_CLICKS TABLE - Structure and sample data
-- ============================================================================
SELECT 'LINK_CLICKS TABLE STRUCTURE' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'link_clicks'
ORDER BY ordinal_position;

-- Sample clicks
SELECT 
    id,
    user_id,
    session_id,
    item_category,
    product_title,
    clicked_at
FROM link_clicks
ORDER BY clicked_at DESC
LIMIT 10;

-- Link clicks stats
SELECT 
    'Total clicks' as metric,
    COUNT(*) as count
FROM link_clicks

UNION ALL

SELECT 
    'Clicks with user_id',
    COUNT(*)
FROM link_clicks
WHERE user_id IS NOT NULL

UNION ALL

SELECT 
    'Clicks with session_id',
    COUNT(*)
FROM link_clicks
WHERE session_id IS NOT NULL;


-- 4. RESULT_PAGE_VISITS TABLE - Structure and sample
-- ============================================================================
SELECT 'RESULT_PAGE_VISITS TABLE STRUCTURE' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'result_page_visits'
ORDER BY ordinal_position;

SELECT 
    phone_number,
    visit_timestamp,
    result_page_url,
    time_on_page_seconds,
    clicked_products
FROM result_page_visits
ORDER BY visit_timestamp DESC
LIMIT 10;


-- 5. USER_FEEDBACK TABLE - Structure and sample
-- ============================================================================
SELECT 'USER_FEEDBACK TABLE STRUCTURE' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_feedback'
ORDER BY ordinal_position;

SELECT 
    phone_number,
    satisfaction,
    comment,
    created_at
FROM user_feedback
ORDER BY created_at DESC
LIMIT 10;


-- 6. APP_PAGE_VISITS TABLE - Structure and sample
-- ============================================================================
SELECT 'APP_PAGE_VISITS TABLE STRUCTURE' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'app_page_visits'
ORDER BY ordinal_position;

SELECT 
    session_id,
    device_id,
    page_path,
    visit_timestamp,
    time_on_page_seconds,
    referrer
FROM app_page_visits
ORDER BY visit_timestamp DESC
LIMIT 10;


-- 7. ALL TRACKING TABLES SUMMARY
-- ============================================================================
SELECT 
    'users' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT phone_number) as unique_phones,
    COUNT(DISTINCT id) as unique_ids
FROM users

UNION ALL

SELECT 
    'sessions',
    COUNT(*),
    COUNT(DISTINCT phone_number),
    COUNT(DISTINCT user_id)
FROM sessions

UNION ALL

SELECT 
    'link_clicks',
    COUNT(*),
    0 as unique_phones,
    COUNT(DISTINCT user_id)
FROM link_clicks

UNION ALL

SELECT 
    'result_page_visits',
    COUNT(*),
    COUNT(DISTINCT phone_number),
    0
FROM result_page_visits

UNION ALL

SELECT 
    'user_feedback',
    COUNT(*),
    COUNT(DISTINCT phone_number),
    0
FROM user_feedback

UNION ALL

SELECT 
    'app_page_visits',
    COUNT(*),
    0,
    COUNT(DISTINCT session_id)
FROM app_page_visits;


