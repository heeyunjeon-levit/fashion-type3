-- ============================================================================
-- DEBUG: Why is conversion showing 0%?
-- User 01048545690 should be a convert!
-- ============================================================================

-- 1. Check if user 01048545690 exists in main app
-- ============================================================================
SELECT 
    'User in USERS table?' as check_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ YES - Found in users'
        ELSE '❌ NO - Not in users'
    END as result,
    COALESCE(STRING_AGG(phone_number, ', '), 'N/A') as phone_format
FROM users
WHERE phone_number LIKE '%48545690%';


-- 2. Check if user exists in batch visits
-- ============================================================================
SELECT 
    'User in RESULT_PAGE_VISITS?' as check_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ YES - Got batch SMS'
        ELSE '❌ NO - Didn''t get batch SMS'
    END as result,
    COALESCE(STRING_AGG(phone_number, ', '), 'N/A') as phone_format
FROM result_page_visits
WHERE phone_number LIKE '%48545690%';


-- 3. Find ALL users in main app
-- ============================================================================
SELECT 
    'All users in main app' as info,
    id as user_id,
    phone_number,
    total_searches
FROM users
ORDER BY created_at DESC;


-- 4. Find ALL batch SMS phones
-- ============================================================================
SELECT 
    'All batch SMS phones' as info,
    phone_number,
    COUNT(*) as visits
FROM result_page_visits
GROUP BY phone_number
ORDER BY phone_number
LIMIT 20;


-- 5. Check for phone format mismatches
-- ============================================================================
-- Users with phones starting with 0
SELECT 
    'Users phones starting with 0' as format,
    COUNT(*) as count,
    STRING_AGG(LEFT(phone_number, 5), ', ') as samples
FROM users
WHERE phone_number LIKE '0%';

-- Users phones starting with 82
SELECT 
    'Users phones starting with 82',
    COUNT(*),
    STRING_AGG(LEFT(phone_number, 5), ', ')
FROM users
WHERE phone_number LIKE '82%';

-- Users phones NOT starting with 0 or 82
SELECT 
    'Users phones other format',
    COUNT(*),
    STRING_AGG(LEFT(phone_number, 5), ', ')
FROM users
WHERE phone_number NOT LIKE '0%' AND phone_number NOT LIKE '82%';

-- Batch phones format
SELECT 
    'Batch phones starting with 0',
    COUNT(DISTINCT phone_number),
    STRING_AGG(DISTINCT LEFT(phone_number, 5), ', ')
FROM result_page_visits
WHERE phone_number LIKE '0%';

SELECT 
    'Batch phones starting with 82',
    COUNT(DISTINCT phone_number),
    STRING_AGG(DISTINCT LEFT(phone_number, 5), ', ')
FROM result_page_visits
WHERE phone_number LIKE '82%';


-- 6. Try to find matches with different formats
-- ============================================================================
SELECT 
    'Potential converts (exact match)' as method,
    COUNT(DISTINCT u.id) as count
FROM users u
WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits);

-- Try with LIKE (last 8 digits)
SELECT 
    'Potential converts (last 8 digits match)',
    COUNT(DISTINCT u.id)
FROM users u
WHERE EXISTS (
    SELECT 1 FROM result_page_visits rpv
    WHERE RIGHT(u.phone_number, 8) = RIGHT(rpv.phone_number, 8)
);

-- Try with cleaned numbers (remove all 0 and 82 prefixes)
SELECT 
    'Potential converts (cleaned match)',
    COUNT(DISTINCT u.id)
FROM users u
WHERE EXISTS (
    SELECT 1 FROM result_page_visits rpv
    WHERE REPLACE(REPLACE(u.phone_number, '82', ''), '0', '') = 
          REPLACE(REPLACE(rpv.phone_number, '82', ''), '0', '')
);


-- 7. Show potential converts with details
-- ============================================================================
SELECT 
    u.phone_number as user_phone,
    rpv.phone_number as batch_phone,
    u.total_searches,
    rpv.visit_count,
    'MATCH!' as status
FROM users u
JOIN (
    SELECT phone_number, COUNT(*) as visit_count
    FROM result_page_visits
    GROUP BY phone_number
) rpv ON RIGHT(u.phone_number, 8) = RIGHT(rpv.phone_number, 8)
ORDER BY u.total_searches DESC;


