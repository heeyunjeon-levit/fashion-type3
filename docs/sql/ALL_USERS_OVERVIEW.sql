-- ============================================================================
-- ALL USERS OVERVIEW - See everyone's activity at a glance
-- ============================================================================

-- 1. ALL MAIN APP USERS (17 total)
-- ============================================================================
SELECT 
    u.phone_number,
    u.total_searches,
    u.created_at as joined,
    u.last_active_at as last_active,
    COALESCE(lc.clicks, 0) as product_clicks,
    COALESCE(rpv.batch_visits, 0) as batch_visits,
    COALESCE(uf.feedback_count, 0) as feedback_count,
    CASE 
        WHEN COALESCE(lc.clicks, 0) > 0 THEN '✅'
        ELSE '❌'
    END as clicked_products,
    CASE 
        WHEN COALESCE(rpv.batch_visits, 0) > 0 THEN '✅'
        ELSE '❌'
    END as visited_batch,
    CASE 
        WHEN COALESCE(uf.feedback_count, 0) > 0 THEN '✅'
        ELSE '❌'
    END as gave_feedback
FROM users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as clicks
    FROM link_clicks
    GROUP BY user_id
) lc ON u.id::text = lc.user_id::text
LEFT JOIN (
    SELECT phone_number, COUNT(*) as batch_visits
    FROM result_page_visits
    GROUP BY phone_number
) rpv ON u.phone_number = rpv.phone_number
LEFT JOIN (
    SELECT phone_number, COUNT(*) as feedback_count
    FROM user_feedback
    GROUP BY phone_number
) uf ON u.phone_number = uf.phone_number
ORDER BY u.total_searches DESC, u.last_active_at DESC;


-- 2. TOP ACTIVE USERS (by product clicks)
-- ============================================================================
SELECT 
    u.phone_number,
    COUNT(lc.id) as total_clicks,
    COUNT(DISTINCT lc.item_category) as unique_categories,
    MIN(lc.clicked_at) as first_click,
    MAX(lc.clicked_at) as last_click
FROM users u
JOIN link_clicks lc ON u.id::text = lc.user_id::text
GROUP BY u.phone_number
ORDER BY total_clicks DESC
LIMIT 10;


-- 3. BATCH PAGE ENGAGEMENT (75 unique phones!)
-- ============================================================================
SELECT 
    phone_number,
    COUNT(*) as visits,
    SUM(time_on_page_seconds) as total_time,
    AVG(time_on_page_seconds) as avg_time,
    SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END) as clicked_products_count,
    MAX(visit_timestamp) as last_visit
FROM result_page_visits
GROUP BY phone_number
ORDER BY visits DESC, total_time DESC
LIMIT 20;


-- 4. FEEDBACK SUMMARY (34 submissions!)
-- ============================================================================
SELECT 
    satisfaction,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM user_feedback
GROUP BY satisfaction
ORDER BY count DESC;

-- Recent feedback
SELECT 
    phone_number,
    satisfaction,
    LEFT(COALESCE(comment, 'No comment'), 50) as comment,
    created_at,
    CASE 
        WHEN result_page_url = 'main_app_result_page' THEN '📱 Main App'
        ELSE '🔗 Batch Page'
    END as source
FROM user_feedback
ORDER BY created_at DESC
LIMIT 10;


-- 5. MOST POPULAR PRODUCT CATEGORIES
-- ============================================================================
SELECT 
    item_category,
    COUNT(*) as clicks,
    COUNT(DISTINCT user_id) as unique_users,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM link_clicks
GROUP BY item_category
ORDER BY clicks DESC;


-- 6. USER JOURNEY SUMMARY
-- ============================================================================
SELECT 
    'Main App Users' as metric,
    COUNT(*)::text as value
FROM users

UNION ALL

SELECT 
    'Users Who Clicked Products',
    COUNT(DISTINCT user_id)::text
FROM link_clicks

UNION ALL

SELECT 
    'Unique Phones on Batch Pages',
    COUNT(DISTINCT phone_number)::text
FROM result_page_visits

UNION ALL

SELECT 
    'Phones That Submitted Feedback',
    COUNT(DISTINCT phone_number)::text
FROM user_feedback

UNION ALL

SELECT 
    'Total Product Clicks',
    COUNT(*)::text
FROM link_clicks

UNION ALL

SELECT 
    'Total Batch Page Visits',
    COUNT(*)::text
FROM result_page_visits

UNION ALL

SELECT 
    'Total Feedback Submissions',
    COUNT(*)::text
FROM user_feedback

UNION ALL

SELECT 
    'Conversion Rate (Batch → Feedback)',
    ROUND(
        (SELECT COUNT(DISTINCT phone_number)::numeric FROM user_feedback WHERE result_page_url != 'main_app_result_page') / 
        NULLIF((SELECT COUNT(DISTINCT phone_number)::numeric FROM result_page_visits), 0) * 100, 
        1
    )::text || '%';


-- 7. RECENT ACTIVITY (Last 24 hours)
-- ============================================================================
SELECT * FROM (
    SELECT 
        'Product Click' as activity,
        TO_CHAR(clicked_at, 'YYYY-MM-DD HH24:MI') as timestamp,
        (SELECT phone_number FROM users WHERE id::text = link_clicks.user_id::text) as phone,
        item_category as details
    FROM link_clicks
    WHERE clicked_at > NOW() - INTERVAL '24 hours'
    
    UNION ALL
    
    SELECT 
        'Batch Visit',
        TO_CHAR(visit_timestamp, 'YYYY-MM-DD HH24:MI'),
        phone_number,
        'Spent ' || time_on_page_seconds || 's'
    FROM result_page_visits
    WHERE visit_timestamp > NOW() - INTERVAL '24 hours'
    
    UNION ALL
    
    SELECT 
        'Feedback',
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI'),
        phone_number,
        satisfaction
    FROM user_feedback
    WHERE created_at > NOW() - INTERVAL '24 hours'
    
) recent
ORDER BY timestamp DESC;

