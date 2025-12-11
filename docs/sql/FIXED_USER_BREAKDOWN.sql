-- ============================================================================
-- YOUR REAL USER BREAKDOWN (PHONE FORMAT FIXED)
-- 3 Groups: Batch SMS Only, Batch Converts, Colleagues
-- ============================================================================
-- ISSUE FOUND: Phone number format mismatch!
-- - users table: 01048545690 (Korean format)
-- - result_page_visits: 821048545690 (international format)
-- SOLUTION: Normalize all phone comparisons
-- ============================================================================

-- Helper: Normalize phone number function
-- Converts 821048545690 → 01048545690
-- Converts 01048545690 → 01048545690
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT) RETURNS TEXT AS $$
BEGIN
    IF phone LIKE '82%' THEN
        RETURN '0' || SUBSTRING(phone FROM 3);
    ELSE
        RETURN phone;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- 1. THE 3 USER GROUPS (WITH PHONE NORMALIZATION)
-- ============================================================================
WITH normalized_batch AS (
    SELECT 
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        time_on_page_seconds
    FROM result_page_visits
),
normalized_users AS (
    SELECT 
        id,
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        total_searches
    FROM users
    WHERE phone_number IS NOT NULL
)
SELECT 
    '📦 Batch SMS Only (Visited batch page, didn''t convert)' as user_group,
    COUNT(DISTINCT nb.phone_number) as count,
    'In result_page_visits only' as identification
FROM normalized_batch nb
WHERE nb.norm_phone NOT IN (SELECT norm_phone FROM normalized_users)

UNION ALL

SELECT 
    '✅ Batch SMS Converts (Clicked "다른 이미지도 찾아보기")',
    COUNT(DISTINCT u.id),
    'In BOTH result_page_visits AND users'
FROM normalized_users u
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)

UNION ALL

SELECT 
    '💼 Colleagues (~7 including you)',
    COUNT(DISTINCT u.id),
    'In users only, NOT in result_page_visits'
FROM normalized_users u
WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)

UNION ALL

SELECT 
    '═══ TOTAL BATCH SMS SENT ═══',
    COUNT(DISTINCT phone_number),
    '116 users from 3 batches'
FROM result_page_visits

UNION ALL

SELECT 
    '═══ TOTAL MAIN APP USERS ═══',
    COUNT(DISTINCT id),
    '~7 colleagues + batch converts'
FROM users;


-- 2. CONVERSION RATE: Batch SMS → Main App (FIXED)
-- ============================================================================
WITH normalized_batch AS (
    SELECT 
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        time_on_page_seconds
    FROM result_page_visits
),
normalized_users AS (
    SELECT 
        id,
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        total_searches
    FROM users
    WHERE phone_number IS NOT NULL
)
SELECT 
    'Conversion Funnel' as stage,
    NULL as count,
    NULL as rate

UNION ALL

SELECT 
    '1. Batch SMS Sent (unique phones)',
    COUNT(DISTINCT phone_number)::text,
    '100%'
FROM result_page_visits

UNION ALL

SELECT 
    '2. Visited Batch Page',
    COUNT(DISTINCT phone_number)::text,
    '100%'
FROM result_page_visits
WHERE time_on_page_seconds > 0

UNION ALL

SELECT 
    '3. Clicked "다른 이미지도 찾아보기" & Joined Main App',
    COUNT(DISTINCT u.id)::text,
    ROUND(COUNT(DISTINCT u.id) * 100.0 / 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits), 1)::text || '% ✅ CONVERSION RATE'
FROM normalized_users u
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)

UNION ALL

SELECT 
    '4. Now Clicking Products in Main App',
    COUNT(DISTINCT lc.user_id)::text,
    ROUND(COUNT(DISTINCT lc.user_id) * 100.0 / NULLIF(
        (SELECT COUNT(DISTINCT u.id) FROM normalized_users u WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)), 
        0), 1)::text || '% of converts'
FROM link_clicks lc
JOIN normalized_users u ON lc.user_id::text = u.id::text
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch);


-- 3. PRODUCT CLICKS: Batch Converts vs. Colleagues (FIXED)
-- ============================================================================
WITH normalized_batch AS (
    SELECT 
        phone_number,
        normalize_phone(phone_number) as norm_phone
    FROM result_page_visits
),
normalized_users AS (
    SELECT 
        id,
        phone_number,
        normalize_phone(phone_number) as norm_phone
    FROM users
    WHERE phone_number IS NOT NULL
)
SELECT 
    '✅ Batch SMS Converts' as user_group,
    COUNT(lc.id) as product_clicks,
    COUNT(DISTINCT lc.user_id) as active_users,
    ROUND(COUNT(lc.id)::numeric / NULLIF(COUNT(DISTINCT lc.user_id), 0), 1) as avg_clicks_per_user
FROM link_clicks lc
JOIN normalized_users u ON lc.user_id::text = u.id::text
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)

UNION ALL

SELECT 
    '💼 Colleagues',
    COUNT(lc.id),
    COUNT(DISTINCT lc.user_id),
    ROUND(COUNT(lc.id)::numeric / NULLIF(COUNT(DISTINCT lc.user_id), 0), 1)
FROM link_clicks lc
JOIN normalized_users u ON lc.user_id::text = u.id::text
WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch);


-- 4. DETAILED LIST: Batch Converts (FIXED)
-- ============================================================================
WITH normalized_batch AS (
    SELECT 
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        COUNT(*) as visits,
        SUM(time_on_page_seconds) as total_time
    FROM result_page_visits
    GROUP BY phone_number, normalize_phone(phone_number)
),
normalized_users AS (
    SELECT 
        id,
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        total_searches
    FROM users
    WHERE phone_number IS NOT NULL
)
SELECT 
    '✅ Batch SMS Converts' as group_name,
    u.phone_number,
    u.total_searches,
    COALESCE(nb.visits, 0) as batch_visits,
    COALESCE(nb.total_time, 0) as time_on_batch,
    COALESCE(lc.clicks, 0) as product_clicks_in_main_app,
    CASE WHEN COALESCE(lc.clicks, 0) > 0 THEN '✅' ELSE '❌' END as is_active
FROM normalized_users u
LEFT JOIN normalized_batch nb ON u.norm_phone = nb.norm_phone
LEFT JOIN (
    SELECT user_id, COUNT(*) as clicks
    FROM link_clicks
    GROUP BY user_id
) lc ON u.id::text = lc.user_id::text
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)
ORDER BY COALESCE(lc.clicks, 0) DESC;


-- 5. DETAILED LIST: Colleagues (UNCHANGED)
-- ============================================================================
WITH normalized_batch AS (
    SELECT normalize_phone(phone_number) as norm_phone
    FROM result_page_visits
),
normalized_users AS (
    SELECT 
        id,
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        total_searches
    FROM users
    WHERE phone_number IS NOT NULL
)
SELECT 
    '💼 Colleagues' as group_name,
    u.phone_number,
    u.total_searches,
    COALESCE(lc.clicks, 0) as product_clicks,
    CASE WHEN COALESCE(lc.clicks, 0) > 0 THEN '✅' ELSE '❌' END as is_active
FROM normalized_users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as clicks
    FROM link_clicks
    GROUP BY user_id
) lc ON u.id::text = lc.user_id::text
WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)
ORDER BY COALESCE(lc.clicks, 0) DESC;


-- 6. KEY INSIGHTS SUMMARY (FIXED)
-- ============================================================================
WITH normalized_batch AS (
    SELECT 
        phone_number,
        normalize_phone(phone_number) as norm_phone
    FROM result_page_visits
),
normalized_users AS (
    SELECT 
        id,
        phone_number,
        normalize_phone(phone_number) as norm_phone
    FROM users
    WHERE phone_number IS NOT NULL
),
stats AS (
    SELECT 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits) as batch_sent,
        (SELECT COUNT(DISTINCT u.id) FROM normalized_users u WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)) as batch_converts,
        (SELECT COUNT(DISTINCT u.id) FROM normalized_users u WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)) as colleagues,
        (SELECT COUNT(*) FROM user_feedback uf WHERE normalize_phone(uf.phone_number) IN (SELECT norm_phone FROM normalized_batch)) as batch_feedback,
        (SELECT COUNT(lc.id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)) as batch_convert_clicks,
        (SELECT COUNT(DISTINCT lc.user_id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)) as batch_convert_active,
        (SELECT COUNT(lc.id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)) as colleague_clicks,
        (SELECT COUNT(DISTINCT lc.user_id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)) as colleague_active
)
SELECT 
    '🎯 KEY INSIGHTS' as metric,
    NULL as value

UNION ALL

SELECT 
    'Batch SMS Sent',
    batch_sent::text || ' unique phones'
FROM stats

UNION ALL

SELECT 
    'Conversion Rate (SMS → Main App)',
    ROUND(batch_converts * 100.0 / batch_sent, 1)::text || '% (' || batch_converts || '/' || batch_sent || ')'
FROM stats

UNION ALL

SELECT 
    'Batch Feedback Rate',
    ROUND(batch_feedback * 100.0 / batch_sent, 1)::text || '% (' || batch_feedback || '/' || batch_sent || ')'
FROM stats

UNION ALL

SELECT 
    'Batch Converts: Click Rate',
    ROUND(batch_convert_active * 100.0 / NULLIF(batch_converts, 0), 1)::text || '% active (' || batch_convert_clicks || ' clicks from ' || batch_convert_active || ' users)'
FROM stats

UNION ALL

SELECT 
    'Colleagues: Click Rate',
    ROUND(colleague_active * 100.0 / NULLIF(colleagues, 0), 1)::text || '% active (' || colleague_clicks || ' clicks from ' || colleague_active || ' users)'
FROM stats

UNION ALL

SELECT 
    'Winner: Engagement',
    CASE 
        WHEN batch_convert_active::numeric / NULLIF(batch_converts, 0) > colleague_active::numeric / NULLIF(colleagues, 0) 
        THEN '✅ Batch Converts engage more!'
        ELSE '✅ Colleagues engage more!'
    END
FROM stats;


-- 7. VERIFICATION: Show Phone Format Issue
-- ============================================================================
WITH sample_match AS (
    SELECT 
        u.phone_number as user_phone,
        rpv.phone_number as batch_phone
    FROM users u
    CROSS JOIN result_page_visits rpv
    WHERE u.phone_number LIKE '%48545690%' 
      AND rpv.phone_number LIKE '%48545690%'
    LIMIT 1
)
SELECT 
    '🔍 PHONE FORMAT VERIFICATION' as check_type,
    NULL::text as users_format,
    NULL::text as batch_format,
    NULL::text as match

UNION ALL

SELECT 
    'Sample user 01048545690',
    user_phone,
    batch_phone,
    CASE WHEN user_phone = batch_phone THEN '✅' ELSE '❌ MISMATCH!' END
FROM sample_match

UNION ALL

SELECT 
    'After normalization',
    normalize_phone(user_phone),
    normalize_phone(batch_phone),
    CASE WHEN normalize_phone(user_phone) = normalize_phone(batch_phone) THEN '✅ FIXED!' ELSE '❌' END
FROM sample_match;

