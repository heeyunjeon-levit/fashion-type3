-- ============================================================================
-- VERIFY PHONE NUMBER MISMATCH
-- Run this FIRST to see the problem clearly
-- ============================================================================

-- 1. Show user 01048545690 in users table
SELECT 
    '👤 User in users table' as source,
    phone_number,
    LEFT(phone_number, 2) as first_2_chars,
    LENGTH(phone_number) as length
FROM users
WHERE phone_number LIKE '%48545690%';


-- 2. Show same user in result_page_visits
SELECT 
    '📲 Same user in result_page_visits' as source,
    phone_number,
    LEFT(phone_number, 2) as first_2_chars,
    LENGTH(phone_number) as length
FROM result_page_visits
WHERE phone_number LIKE '%48545690%'
LIMIT 1;


-- 3. Test if they match (they won't!)
SELECT 
    '🔍 Do they match?' as test,
    u.phone_number as users_phone,
    rpv.phone_number as batch_phone,
    CASE 
        WHEN u.phone_number = rpv.phone_number THEN '✅ MATCH'
        ELSE '❌ NO MATCH - THIS IS THE BUG!'
    END as result
FROM users u
CROSS JOIN result_page_visits rpv
WHERE u.phone_number LIKE '%48545690%'
  AND rpv.phone_number LIKE '%48545690%'
LIMIT 1;


-- 4. Show all phone formats in result_page_visits
SELECT 
    '📊 Phone formats in result_page_visits' as analysis,
    LEFT(phone_number, 2) as format_prefix,
    COUNT(*) as count,
    MIN(LENGTH(phone_number)) as min_length,
    MAX(LENGTH(phone_number)) as max_length,
    (ARRAY_AGG(phone_number ORDER BY phone_number))[1:3] as examples
FROM result_page_visits
GROUP BY LEFT(phone_number, 2)
ORDER BY count DESC;


-- 5. Show all phone formats in users
SELECT 
    '📊 Phone formats in users' as analysis,
    LEFT(phone_number, 2) as format_prefix,
    COUNT(*) as count,
    MIN(LENGTH(phone_number)) as min_length,
    MAX(LENGTH(phone_number)) as max_length,
    (ARRAY_AGG(phone_number ORDER BY phone_number))[1:3] as examples
FROM users
WHERE phone_number IS NOT NULL
GROUP BY LEFT(phone_number, 2)
ORDER BY count DESC;


-- 6. Count how many would match vs. mismatch
SELECT 
    '📈 Overall Mismatch Analysis' as summary,
    NULL as metric,
    NULL as value

UNION ALL

SELECT 
    '',
    'Total users in users table',
    COUNT(*)::text
FROM users
WHERE phone_number IS NOT NULL

UNION ALL

SELECT 
    '',
    'Total visits in result_page_visits',
    COUNT(DISTINCT phone_number)::text
FROM result_page_visits

UNION ALL

SELECT 
    '',
    'Direct matches (same format)',
    COUNT(DISTINCT u.phone_number)::text
FROM users u
WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)

UNION ALL

SELECT 
    '',
    '❌ MISSED MATCHES (format mismatch)',
    COUNT(DISTINCT u.phone_number)::text
FROM users u
WHERE u.phone_number NOT IN (SELECT phone_number FROM result_page_visits)
  AND RIGHT(u.phone_number, 8) IN (
      SELECT RIGHT(phone_number, 8) FROM result_page_visits
  );


-- 7. List all potential missed matches
SELECT 
    '🔴 Missed Conversions Due to Format Mismatch' as issue,
    u.phone_number as user_phone,
    rpv.phone_number as batch_phone,
    u.total_searches,
    'These are REAL converts but queries miss them!' as impact
FROM users u
JOIN result_page_visits rpv ON RIGHT(u.phone_number, 8) = RIGHT(rpv.phone_number, 8)
WHERE u.phone_number != rpv.phone_number
ORDER BY u.total_searches DESC;

