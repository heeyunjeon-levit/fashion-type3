-- ============================================================================
-- FIND YOUR PHONE NUMBER IN THE DATABASE
-- This will show you how your phone is actually stored
-- ============================================================================

-- 1. Check users table (you said 57 searches, so you're definitely in here!)
-- ============================================================================
SELECT 
    'FOUND IN USERS TABLE' as location,
    phone_number as how_its_stored,
    total_searches,
    created_at as first_visit,
    last_active_at as last_active
FROM users
WHERE phone_number LIKE '%90848563%'
   OR phone_number LIKE '%1090848563%'
   OR phone_number LIKE '%821090848563%'
   OR phone_number = '01090848563'
ORDER BY total_searches DESC;


-- 2. Check sessions table
-- ============================================================================
SELECT 
    'FOUND IN SESSIONS TABLE' as location,
    phone_number as how_its_stored,
    COUNT(*) as session_count,
    MIN(created_at) as first_session,
    MAX(created_at) as last_session
FROM sessions
WHERE phone_number LIKE '%90848563%'
   OR phone_number LIKE '%1090848563%'
   OR phone_number LIKE '%821090848563%'
   OR phone_number = '01090848563'
GROUP BY phone_number;


-- 3. Show all formats that exist for numbers ending in 90848563
-- ============================================================================
SELECT DISTINCT
    'All formats in database' as info,
    phone_number as format
FROM users
WHERE phone_number LIKE '%90848563%'
UNION
SELECT DISTINCT
    'All formats in database',
    phone_number
FROM sessions
WHERE phone_number LIKE '%90848563%';


-- 4. Quick search in ALL tables
-- ============================================================================
SELECT 
    'Users' as table_name,
    COUNT(*) as found
FROM users
WHERE phone_number LIKE '%90848563%'

UNION ALL

SELECT 
    'Sessions',
    COUNT(*)
FROM sessions
WHERE phone_number LIKE '%90848563%'

UNION ALL

SELECT 
    'Result Page Visits',
    COUNT(*)
FROM result_page_visits
WHERE phone_number LIKE '%90848563%'

UNION ALL

SELECT 
    'User Feedback',
    COUNT(*)
FROM user_feedback
WHERE phone_number LIKE '%90848563%';


