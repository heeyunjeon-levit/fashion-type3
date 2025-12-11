-- ============================================================================
-- CONVERSION SOURCE INSIGHTS
-- Use this AFTER running ADD_CONVERSION_TRACKING.sql
-- ============================================================================

WITH source_stats AS (
    SELECT 
        conversion_source,
        COUNT(*) as user_count,
        COUNT(DISTINCT lc.id) as total_clicks,
        COUNT(DISTINCT lc.user_id) as active_users
    FROM users u
    LEFT JOIN link_clicks lc ON u.id::text = lc.user_id::text
    GROUP BY conversion_source
)
SELECT 
    '🎯 CONVERSION SOURCE BREAKDOWN' as section,
    NULL as source,
    NULL as users,
    NULL as engagement

UNION ALL SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL

SELECT 
    '',
    CASE conversion_source
        WHEN 'batch_button_click' THEN '🔘 Batch Button Converts'
        WHEN 'batch_interview' THEN '🎤 Batch Interviewed'
        WHEN 'colleague' THEN '💼 Colleagues'
        WHEN 'organic' THEN '🌱 Organic Signups'
        ELSE '❓ Unknown'
    END,
    user_count::text || ' users',
    total_clicks::text || ' clicks (' || active_users::text || ' active users)'
FROM source_stats;


-- ============================================================================
-- BATCH SMS CONVERSION FUNNEL (DETAILED)
-- ============================================================================

WITH batch_metrics AS (
    SELECT 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits) as batch_links_visited,
        (SELECT COUNT(*) FROM users WHERE conversion_source = 'batch_button_click') as button_converts,
        (SELECT COUNT(*) FROM users WHERE conversion_source = 'batch_interview') as interviewed_converts
)
SELECT 
    '📊 BATCH SMS CONVERSION PATHS' as metric,
    NULL as count,
    NULL as rate

UNION ALL SELECT '═══════════════════════════════════════════════════', NULL, NULL

UNION ALL

SELECT 
    '1️⃣ Batch Links Visited',
    batch_links_visited::text,
    '100% (starting point)'
FROM batch_metrics

UNION ALL

SELECT 
    '2️⃣ Organic Button Converts',
    button_converts::text,
    ROUND(button_converts * 100.0 / batch_links_visited, 1)::text || '% (clicked "다른 이미지도 찾아보기")'
FROM batch_metrics

UNION ALL

SELECT 
    '3️⃣ Interviewed & Converted',
    interviewed_converts::text,
    ROUND(interviewed_converts * 100.0 / batch_links_visited, 1)::text || '% (you onboarded them)'
FROM batch_metrics

UNION ALL

SELECT 
    '✅ Total Batch Conversions',
    (button_converts + interviewed_converts)::text,
    ROUND((button_converts + interviewed_converts) * 100.0 / batch_links_visited, 1)::text || '% (organic + interviewed)'
FROM batch_metrics

UNION ALL SELECT '═══════════════════════════════════════════════════', NULL, NULL

UNION ALL

SELECT 
    '💡 Key Insight',
    NULL,
    'You converted ' || ROUND((SELECT COUNT(*) FROM users WHERE conversion_source = 'batch_interview') * 100.0 / 
    NULLIF((SELECT COUNT(*) FROM users WHERE conversion_source IN ('batch_button_click', 'batch_interview')), 0), 0)::text || 
    '% of converts through interviews!'
FROM batch_metrics;


-- ============================================================================
-- ENGAGEMENT BY CONVERSION SOURCE
-- ============================================================================

WITH engagement AS (
    SELECT 
        conversion_source,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(lc.id) as total_clicks,
        COUNT(DISTINCT lc.user_id) as active_users,
        ROUND(AVG(CASE WHEN lc.user_id IS NOT NULL THEN 1 ELSE 0 END) * 100, 1) as active_pct
    FROM users u
    LEFT JOIN link_clicks lc ON u.id::text = lc.user_id::text
    GROUP BY conversion_source
)
SELECT 
    '🔥 ENGAGEMENT BY SOURCE' as metric,
    NULL as source,
    NULL as clicks_per_user,
    NULL as active_rate

UNION ALL SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL

SELECT 
    '',
    CASE conversion_source
        WHEN 'batch_button_click' THEN '🔘 Button Converts'
        WHEN 'batch_interview' THEN '🎤 Interviewed'
        WHEN 'colleague' THEN '💼 Colleagues'
        WHEN 'organic' THEN '🌱 Organic'
    END,
    ROUND(total_clicks::numeric / NULLIF(user_count, 0), 1)::text || ' clicks/user',
    active_pct::text || '% active'
FROM engagement
WHERE conversion_source IS NOT NULL;


-- ============================================================================
-- WHO ARE YOUR MOST ENGAGED USERS?
-- ============================================================================

WITH top_users AS (
    SELECT 
        u.phone_number,
        u.conversion_source,
        COUNT(lc.id) as click_count
    FROM users u
    LEFT JOIN link_clicks lc ON u.id::text = lc.user_id::text
    GROUP BY u.phone_number, u.conversion_source
    ORDER BY COUNT(lc.id) DESC
    LIMIT 10
)
SELECT 
    '🏆 TOP 10 MOST ENGAGED USERS' as rank,
    NULL as phone,
    NULL as source,
    NULL as clicks

UNION ALL SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL

SELECT 
    ROW_NUMBER() OVER (ORDER BY click_count DESC)::text,
    phone_number,
    CASE conversion_source
        WHEN 'batch_button_click' THEN '🔘 Button'
        WHEN 'batch_interview' THEN '🎤 Interview'
        WHEN 'colleague' THEN '💼 Colleague'
        WHEN 'organic' THEN '🌱 Organic'
    END,
    click_count::text || ' clicks'
FROM top_users;

