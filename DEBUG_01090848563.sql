-- ============================================================================
-- DEBUG: Find 01090848563 across ALL tables and formats
-- ============================================================================

-- 1. USERS table (We know this works - 57 searches!)
-- ============================================================================
SELECT 'USERS TABLE' as table_name, phone_number, total_searches, created_at
FROM users
WHERE phone_number = '01090848563';


-- 2. SESSIONS table - Try ALL formats
-- ============================================================================
SELECT 'SESSIONS - Format 1' as table_name, phone_number, COUNT(*) as count
FROM sessions
WHERE phone_number = '01090848563'
GROUP BY phone_number

UNION ALL

SELECT 'SESSIONS - Format 2', phone_number, COUNT(*)
FROM sessions
WHERE phone_number = '1090848563'
GROUP BY phone_number

UNION ALL

SELECT 'SESSIONS - Format 3', phone_number, COUNT(*)
FROM sessions
WHERE phone_number = '821090848563'
GROUP BY phone_number

UNION ALL

SELECT 'SESSIONS - LIKE search', phone_number, COUNT(*)
FROM sessions
WHERE phone_number LIKE '%090848563'
GROUP BY phone_number;


-- 3. Show ALL unique phone formats in sessions
-- ============================================================================
SELECT DISTINCT
    'All phone formats in SESSIONS' as info,
    phone_number,
    LENGTH(phone_number) as length
FROM sessions
WHERE phone_number IS NOT NULL
ORDER BY phone_number
LIMIT 20;


-- 4. Check if sessions exist WITHOUT phone number
-- ============================================================================
SELECT 
    'Sessions WITHOUT phone' as info,
    COUNT(*) as total,
    COUNT(DISTINCT session_id) as unique_sessions
FROM sessions
WHERE phone_number IS NULL OR phone_number = '';


-- 5. RESULT_PAGE_VISITS - Try all formats
-- ============================================================================
SELECT 'RESULT_PAGE_VISITS - Format 1' as check_name, COUNT(*) as count
FROM result_page_visits
WHERE phone_number = '01090848563'

UNION ALL

SELECT 'RESULT_PAGE_VISITS - Format 2', COUNT(*)
FROM result_page_visits
WHERE phone_number = '1090848563'

UNION ALL

SELECT 'RESULT_PAGE_VISITS - LIKE', COUNT(*)
FROM result_page_visits
WHERE phone_number LIKE '%090848563';


-- 6. USER_FEEDBACK - Try all formats
-- ============================================================================
SELECT 'USER_FEEDBACK - Format 1' as check_name, COUNT(*) as count
FROM user_feedback
WHERE phone_number = '01090848563'

UNION ALL

SELECT 'USER_FEEDBACK - Format 2', COUNT(*)
FROM user_feedback
WHERE phone_number = '1090848563'

UNION ALL

SELECT 'USER_FEEDBACK - LIKE', COUNT(*)
FROM user_feedback
WHERE phone_number LIKE '%090848563';


-- 7. Show sample sessions to understand the structure
-- ============================================================================
SELECT 
    session_id,
    phone_number,
    created_at,
    status,
    phone_collected_at
FROM sessions
ORDER BY created_at DESC
LIMIT 10;







