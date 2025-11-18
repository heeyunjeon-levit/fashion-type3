-- ============================================================================
-- YOUR REAL USER BREAKDOWN
-- 3 Groups: Batch SMS Only, Batch Converts, Colleagues
-- ============================================================================

-- 1. THE 3 USER GROUPS
-- ============================================================================
SELECT 
    '📦 Batch SMS Only (Visited batch page, didn''t convert)' as user_group,
    COUNT(DISTINCT phone_number) as count,
    'In result_page_visits only' as identification
FROM result_page_visits
WHERE phone_number NOT IN (SELECT phone_number FROM users WHERE phone_number IS NOT NULL)

UNION ALL

SELECT 
    '✅ Batch SMS Converts (Clicked "다른 이미지도 찾아보기")',
    COUNT(DISTINCT u.id),
    'In BOTH result_page_visits AND users'
FROM users u
WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)

UNION ALL

SELECT 
    '💼 Colleagues (~7 including you)',
    COUNT(DISTINCT u.id),
    'In users only, NOT in result_page_visits'
FROM users u
WHERE u.phone_number NOT IN (SELECT phone_number FROM result_page_visits WHERE phone_number IS NOT NULL)

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


-- 2. CONVERSION RATE: Batch SMS → Main App
-- ============================================================================
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
FROM users u
WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)

UNION ALL

SELECT 
    '4. Now Clicking Products in Main App',
    COUNT(DISTINCT lc.user_id)::text,
    ROUND(COUNT(DISTINCT lc.user_id) * 100.0 / NULLIF(
        (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)), 
        0), 1)::text || '% of converts'
FROM link_clicks lc
JOIN users u ON lc.user_id::text = u.id::text
WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits);


-- 3. PRODUCT CLICKS: Batch Converts vs. Colleagues
-- ============================================================================
SELECT 
    '✅ Batch SMS Converts' as user_group,
    COUNT(lc.id) as product_clicks,
    COUNT(DISTINCT lc.user_id) as active_users,
    ROUND(COUNT(lc.id)::numeric / NULLIF(COUNT(DISTINCT lc.user_id), 0), 1) as avg_clicks_per_user
FROM link_clicks lc
JOIN users u ON lc.user_id::text = u.id::text
WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)

UNION ALL

SELECT 
    '💼 Colleagues',
    COUNT(lc.id),
    COUNT(DISTINCT lc.user_id),
    ROUND(COUNT(lc.id)::numeric / NULLIF(COUNT(DISTINCT lc.user_id), 0), 1)
FROM link_clicks lc
JOIN users u ON lc.user_id::text = u.id::text
WHERE u.phone_number NOT IN (SELECT phone_number FROM result_page_visits WHERE phone_number IS NOT NULL);


-- 4. DETAILED LIST: Batch Converts
-- ============================================================================
SELECT 
    '✅ Batch SMS Converts' as group_name,
    u.phone_number,
    u.total_searches,
    COALESCE(rpv.visits, 0) as batch_visits,
    COALESCE(rpv.total_time, 0) as time_on_batch,
    COALESCE(lc.clicks, 0) as product_clicks_in_main_app,
    CASE WHEN COALESCE(lc.clicks, 0) > 0 THEN '✅' ELSE '❌' END as is_active
FROM users u
LEFT JOIN (
    SELECT phone_number, COUNT(*) as visits, SUM(time_on_page_seconds) as total_time
    FROM result_page_visits 
    GROUP BY phone_number
) rpv ON u.phone_number = rpv.phone_number
LEFT JOIN (
    SELECT user_id, COUNT(*) as clicks
    FROM link_clicks
    GROUP BY user_id
) lc ON u.id::text = lc.user_id::text
WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)
ORDER BY COALESCE(lc.clicks, 0) DESC;


-- 5. DETAILED LIST: Colleagues
-- ============================================================================
SELECT 
    '💼 Colleagues' as group_name,
    u.phone_number,
    u.total_searches,
    COALESCE(lc.clicks, 0) as product_clicks,
    CASE WHEN COALESCE(lc.clicks, 0) > 0 THEN '✅' ELSE '❌' END as is_active
FROM users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as clicks
    FROM link_clicks
    GROUP BY user_id
) lc ON u.id::text = lc.user_id::text
WHERE u.phone_number NOT IN (SELECT phone_number FROM result_page_visits WHERE phone_number IS NOT NULL)
ORDER BY COALESCE(lc.clicks, 0) DESC;


-- 6. KEY INSIGHTS SUMMARY
-- ============================================================================
WITH stats AS (
    SELECT 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits) as batch_sent,
        (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)) as batch_converts,
        (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.phone_number NOT IN (SELECT phone_number FROM result_page_visits WHERE phone_number IS NOT NULL)) as colleagues,
        (SELECT COUNT(*) FROM user_feedback WHERE phone_number IN (SELECT phone_number FROM result_page_visits)) as batch_feedback,
        (SELECT COUNT(lc.id) FROM link_clicks lc JOIN users u ON lc.user_id::text = u.id::text WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)) as batch_convert_clicks,
        (SELECT COUNT(DISTINCT lc.user_id) FROM link_clicks lc JOIN users u ON lc.user_id::text = u.id::text WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)) as batch_convert_active,
        (SELECT COUNT(lc.id) FROM link_clicks lc JOIN users u ON lc.user_id::text = u.id::text WHERE u.phone_number NOT IN (SELECT phone_number FROM result_page_visits WHERE phone_number IS NOT NULL)) as colleague_clicks,
        (SELECT COUNT(DISTINCT lc.user_id) FROM link_clicks lc JOIN users u ON lc.user_id::text = u.id::text WHERE u.phone_number NOT IN (SELECT phone_number FROM result_page_visits WHERE phone_number IS NOT NULL)) as colleague_active
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


