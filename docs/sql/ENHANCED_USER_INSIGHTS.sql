-- ============================================================================
-- ENHANCED USER INSIGHTS - Detailed Engagement Metrics
-- Tracks: Product clicks, page visits, time spent, return visits
-- ============================================================================

-- ============================================================================
-- 1. COMPLETE USER ENGAGEMENT OVERVIEW
-- ============================================================================

WITH user_metrics AS (
    SELECT 
        u.phone_number,
        u.conversion_source,
        
        -- Batch Result Page Metrics (for batch SMS users)
        COALESCE(MAX(rpv.time_on_page_seconds), 0) as batch_result_seconds,
        COALESCE(COUNT(DISTINCT rpv.id), 0) as batch_result_visits,
        
        -- Main App Product Clicks
        COALESCE(COUNT(DISTINCT lc.id), 0) as product_clicks,
        
        -- Main App Page Visits
        COALESCE(COUNT(DISTINCT apv.id), 0) as app_page_visits,
        COALESCE(SUM(apv.time_on_page_seconds), 0) as total_app_time_seconds,
        
        -- Engagement Score (simple formula)
        (COALESCE(COUNT(DISTINCT lc.id), 0) * 10) + 
        (COALESCE(SUM(apv.time_on_page_seconds), 0) / 60) +
        (COALESCE(MAX(rpv.time_on_page_seconds), 0) / 10) as engagement_score
        
    FROM users u
    LEFT JOIN result_page_visits rpv ON normalize_phone(u.phone_number) = normalize_phone(rpv.phone_number)
    LEFT JOIN link_clicks lc ON u.id::text = lc.user_id::text
    LEFT JOIN app_page_visits apv ON u.id::text = apv.user_id::text
    GROUP BY u.phone_number, u.conversion_source
)
SELECT 
    '🏆 TOP 10 MOST ENGAGED USERS (DETAILED)' as rank,
    NULL as phone,
    NULL as source,
    NULL as product_clicks,
    NULL as app_time_mins,
    NULL as batch_time_secs,
    NULL as engagement

UNION ALL SELECT '═════════════════════════════════════════════════════════════════════════', NULL, NULL, NULL, NULL, NULL, NULL

UNION ALL

SELECT 
    ROW_NUMBER() OVER (ORDER BY engagement_score DESC)::text,
    phone_number,
    CASE conversion_source
        WHEN 'batch_button_click' THEN '🔘 Button'
        WHEN 'batch_interview' THEN '🎤 Interview'
        WHEN 'colleague' THEN '💼 Colleague'
        WHEN 'organic' THEN '🌱 Organic'
    END,
    product_clicks::text || ' clicks',
    ROUND(total_app_time_seconds / 60.0, 1)::text || ' min',
    batch_result_seconds::text || ' sec',
    ROUND(engagement_score, 0)::text || ' pts'
FROM (
    SELECT * FROM user_metrics ORDER BY engagement_score DESC LIMIT 10
) top_users;


-- ============================================================================
-- 2. ENGAGEMENT BREAKDOWN BY SOURCE
-- ============================================================================

WITH source_engagement AS (
    SELECT 
        u.conversion_source,
        COUNT(DISTINCT u.id) as users,
        
        -- Product Click Metrics
        COUNT(DISTINCT lc.id) as total_product_clicks,
        ROUND(COUNT(DISTINCT lc.id)::numeric / COUNT(DISTINCT u.id), 1) as clicks_per_user,
        COUNT(DISTINCT CASE WHEN lc.id IS NOT NULL THEN u.id END) as users_who_clicked,
        
        -- Time Spent Metrics
        ROUND(AVG(apv_time.total_seconds) / 60.0, 1) as avg_app_time_mins,
        ROUND(AVG(rpv_time.total_seconds), 0) as avg_batch_result_time_secs,
        
        -- Engagement Metrics
        ROUND(AVG(apv_visits.visit_count), 1) as avg_app_visits,
        COUNT(DISTINCT CASE WHEN apv_visits.visit_count > 1 THEN u.id END) as return_visitors
        
    FROM users u
    LEFT JOIN link_clicks lc ON u.id::text = lc.user_id::text
    LEFT JOIN (
        SELECT user_id, SUM(time_on_page_seconds) as total_seconds
        FROM app_page_visits
        GROUP BY user_id
    ) apv_time ON u.id::text = apv_time.user_id::text
    LEFT JOIN (
        SELECT phone_number, SUM(time_on_page_seconds) as total_seconds
        FROM result_page_visits
        GROUP BY phone_number
    ) rpv_time ON normalize_phone(u.phone_number) = normalize_phone(rpv_time.phone_number)
    LEFT JOIN (
        SELECT user_id, COUNT(*) as visit_count
        FROM app_page_visits
        GROUP BY user_id
    ) apv_visits ON u.id::text = apv_visits.user_id::text
    GROUP BY u.conversion_source
)
SELECT 
    '📊 ENGAGEMENT BREAKDOWN BY SOURCE' as metric,
    NULL as source,
    NULL as users,
    NULL as product_clicks,
    NULL as avg_app_time,
    NULL as return_rate

UNION ALL SELECT '═════════════════════════════════════════════════════════════════════════', NULL, NULL, NULL, NULL, NULL

UNION ALL

SELECT 
    '',
    CASE conversion_source
        WHEN 'batch_button_click' THEN '🔘 Button Converts'
        WHEN 'batch_interview' THEN '🎤 Interviewed'
        WHEN 'colleague' THEN '💼 Colleagues'
        WHEN 'organic' THEN '🌱 Organic'
    END,
    users::text || ' users',
    total_product_clicks::text || ' (' || clicks_per_user::text || '/user)',
    COALESCE(avg_app_time_mins::text, '0') || ' min',
    ROUND(return_visitors * 100.0 / users, 0)::text || '% (' || return_visitors || '/' || users || ')'
FROM source_engagement
WHERE conversion_source IS NOT NULL;


-- ============================================================================
-- 3. BATCH SMS RESULT PAGE ENGAGEMENT
-- For users who got batch SMS links - how long did they spend?
-- ============================================================================

WITH batch_engagement AS (
    SELECT 
        u.phone_number,
        u.conversion_source,
        rpv.time_on_page_seconds,
        CASE 
            WHEN rpv.time_on_page_seconds >= 60 THEN '🔥 High (60+ sec)'
            WHEN rpv.time_on_page_seconds >= 30 THEN '👍 Medium (30-60 sec)'
            WHEN rpv.time_on_page_seconds >= 10 THEN '⚠️ Low (10-30 sec)'
            ELSE '❌ Bounced (<10 sec)'
        END as engagement_level
    FROM result_page_visits rpv
    LEFT JOIN users u ON normalize_phone(rpv.phone_number) = normalize_phone(u.phone_number)
)
SELECT 
    '📱 BATCH RESULT PAGE ENGAGEMENT' as analysis,
    NULL as engagement_level,
    NULL as count,
    NULL as avg_time,
    NULL as converted

UNION ALL SELECT '═════════════════════════════════════════════════════════════════════════', NULL, NULL, NULL, NULL

UNION ALL

SELECT 
    '',
    engagement_level,
    user_count,
    avg_time,
    converted
FROM (
    SELECT 
        engagement_level,
        COUNT(*)::text || ' users' as user_count,
        ROUND(AVG(time_on_page_seconds), 0)::text || ' sec avg' as avg_time,
        COUNT(CASE WHEN conversion_source IS NOT NULL THEN 1 END)::text || ' converted (' ||
            ROUND(COUNT(CASE WHEN conversion_source IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 0)::text || '%)' as converted,
        CASE engagement_level
            WHEN '🔥 High (60+ sec)' THEN 1
            WHEN '👍 Medium (30-60 sec)' THEN 2
            WHEN '⚠️ Low (10-30 sec)' THEN 3
            WHEN '❌ Bounced (<10 sec)' THEN 4
        END as sort_order
    FROM batch_engagement
    GROUP BY engagement_level
    ORDER BY sort_order
) sorted;


-- ============================================================================
-- 4. USER JOURNEY: Batch Result → Main App Activity
-- For batch converts: compare their result page time vs main app engagement
-- ============================================================================

WITH batch_convert_journey AS (
    SELECT 
        u.phone_number,
        u.conversion_source,
        MAX(rpv.time_on_page_seconds) as batch_time_secs,
        COUNT(DISTINCT lc.id) as product_clicks,
        COALESCE(SUM(apv.time_on_page_seconds), 0) as app_time_secs,
        COUNT(DISTINCT apv.id) as app_visits
    FROM users u
    INNER JOIN result_page_visits rpv ON normalize_phone(u.phone_number) = normalize_phone(rpv.phone_number)
    LEFT JOIN link_clicks lc ON u.id::text = lc.user_id::text
    LEFT JOIN app_page_visits apv ON u.id::text = apv.user_id::text
    WHERE u.conversion_source IN ('batch_interview', 'batch_button_click')
    GROUP BY u.phone_number, u.conversion_source
)
SELECT 
    '🎯 BATCH CONVERT JOURNEY' as metric,
    NULL as phone,
    NULL as source,
    NULL as batch_time,
    NULL as app_time,
    NULL as product_clicks

UNION ALL SELECT '═════════════════════════════════════════════════════════════════════════', NULL, NULL, NULL, NULL, NULL

UNION ALL

SELECT 
    '',
    phone_number,
    source_label,
    batch_time,
    app_time,
    clicks
FROM (
    SELECT 
        phone_number,
        CASE conversion_source
            WHEN 'batch_button_click' THEN '🔘 Button'
            WHEN 'batch_interview' THEN '🎤 Interview'
        END as source_label,
        batch_time_secs::text || ' sec on results' as batch_time,
        ROUND(app_time_secs / 60.0, 1)::text || ' min in app' as app_time,
        product_clicks::text || ' clicks' as clicks,
        app_time_secs
    FROM batch_convert_journey
    ORDER BY app_time_secs DESC
) sorted;


-- ============================================================================
-- 5. KEY INSIGHTS SUMMARY
-- ============================================================================

WITH insights AS (
    SELECT 
        -- Overall metrics
        (SELECT COUNT(*) FROM users WHERE conversion_source IN ('batch_interview', 'batch_button_click')) as batch_converts,
        (SELECT AVG(time_on_page_seconds) FROM result_page_visits) as avg_batch_time,
        (SELECT COUNT(*) FROM result_page_visits WHERE time_on_page_seconds >= 30) as engaged_on_results,
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits) as total_batch_visitors,
        
        -- Conversion by engagement
        (SELECT COUNT(DISTINCT u.id) 
         FROM users u 
         INNER JOIN result_page_visits rpv ON normalize_phone(u.phone_number) = normalize_phone(rpv.phone_number)
         WHERE rpv.time_on_page_seconds >= 60) as converts_high_engagement,
        
        -- Main app engagement
        (SELECT COUNT(DISTINCT user_id) FROM link_clicks) as users_clicking_products,
        (SELECT AVG(time_on_page_seconds) FROM app_page_visits) as avg_app_page_time
)
SELECT 
    '💡 KEY INSIGHTS' as insight,
    NULL as value

UNION ALL SELECT '═════════════════════════════════════════════════════════════════════════', NULL

UNION ALL

SELECT 
    '📱 Batch Result Engagement',
    ROUND((engaged_on_results * 100.0 / total_batch_visitors), 1)::text || '% spent 30+ sec on results (' || 
    engaged_on_results || '/' || total_batch_visitors || ')'
FROM insights

UNION ALL

SELECT 
    '🎯 High Engagement → Conversion',
    ROUND((converts_high_engagement * 100.0 / batch_converts), 1)::text || '% of converts spent 60+ sec on results'
FROM insights

UNION ALL

SELECT 
    '🔥 Product Click Rate',
    ROUND((users_clicking_products * 100.0 / (SELECT COUNT(*) FROM users)), 1)::text || '% of users clicked products'
FROM insights

UNION ALL

SELECT 
    '⏱️ Average Result Page Time',
    ROUND(avg_batch_time, 0)::text || ' seconds'
FROM insights

UNION ALL

SELECT 
    '⏱️ Average Main App Page Time',
    ROUND(avg_app_page_time, 0)::text || ' seconds'
FROM insights;

