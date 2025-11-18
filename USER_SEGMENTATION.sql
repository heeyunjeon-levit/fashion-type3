-- ============================================================================
-- USER SEGMENTATION - Batch SMS vs. Colleagues vs. Batch Converts
-- ============================================================================

-- 1. IDENTIFY USER GROUPS (3 Groups!)
-- ============================================================================
-- Group 1: Batch SMS ONLY (visited batch page, didn't convert)
-- Group 2: Batch SMS CONVERTS (clicked "다른 이미지도 찾아보기" → joined main app)
-- Group 3: Colleagues (~7 people including you)
-- ============================================================================
SELECT 
    '📦 Batch SMS Only (Visited, Didn''t Convert)' as user_group,
    COUNT(DISTINCT phone_number) as count
FROM result_page_visits
WHERE phone_number NOT IN (SELECT phone_number FROM users WHERE phone_number IS NOT NULL)

UNION ALL

SELECT 
    '✅ Batch SMS → Main App Converts (Clicked "다른 이미지도 찾아보기")',
    COUNT(DISTINCT u.id)
FROM users u
WHERE u.phone_number IN (SELECT phone_number FROM result_page_visits)

UNION ALL

SELECT 
    '💼 Colleagues (~7 including you)',
    COUNT(DISTINCT u.id)
FROM users u
WHERE u.phone_number NOT IN (SELECT phone_number FROM result_page_visits WHERE phone_number IS NOT NULL)

UNION ALL

SELECT 
    '─── TOTAL BATCH SMS SENT ───',
    COUNT(DISTINCT phone_number)
FROM result_page_visits

UNION ALL

SELECT 
    '─── TOTAL MAIN APP USERS ───',
    COUNT(DISTINCT id)
FROM users;


-- 2. PRODUCT CLICKS BY USER GROUP (Main App Only)
-- ============================================================================
-- Only Batch Converts & Colleagues click in main app
-- (Batch SMS Only users stayed on batch page)
WITH user_segments AS (
    SELECT 
        u.id as user_id,
        u.phone_number,
        CASE 
            WHEN rpv.phone_number IS NOT NULL THEN '✅ Batch SMS Converts'
            ELSE '💼 Colleagues'
        END as user_group
    FROM users u
    LEFT JOIN (SELECT DISTINCT phone_number FROM result_page_visits) rpv 
        ON u.phone_number = rpv.phone_number
)
SELECT 
    us.user_group,
    COUNT(lc.id) as product_clicks,
    COUNT(DISTINCT lc.user_id) as active_users,
    COUNT(DISTINCT lc.item_category) as unique_categories,
    ROUND(COUNT(lc.id)::numeric / NULLIF(COUNT(DISTINCT lc.user_id), 0), 1) as avg_clicks_per_user
FROM user_segments us
LEFT JOIN link_clicks lc ON us.user_id::text = lc.user_id::text
WHERE lc.id IS NOT NULL
GROUP BY us.user_group
ORDER BY product_clicks DESC;


-- 3. DETAILED USER LIST BY SEGMENT
-- ============================================================================
WITH user_segments AS (
    SELECT 
        u.id as user_id,
        u.phone_number,
        u.total_searches,
        u.created_at,
        u.last_active_at,
        CASE 
            WHEN rpv.phone_number IS NOT NULL THEN '👥 Friends'' Friends'
            ELSE '🌐 Naver Strangers'
        END as user_group,
        COALESCE(rpv.visits, 0) as batch_visits,
        COALESCE(rpv.total_time, 0) as time_on_batch_pages
    FROM users u
    LEFT JOIN (
        SELECT 
            phone_number, 
            COUNT(*) as visits,
            SUM(time_on_page_seconds) as total_time
        FROM result_page_visits 
        GROUP BY phone_number
    ) rpv ON u.phone_number = rpv.phone_number
)
SELECT 
    us.user_group,
    us.phone_number,
    us.total_searches,
    us.batch_visits,
    COALESCE(lc.clicks, 0) as product_clicks,
    COALESCE(lc.categories, 0) as unique_categories,
    CASE 
        WHEN COALESCE(lc.clicks, 0) > 0 THEN '✅'
        ELSE '❌'
    END as is_active,
    TO_CHAR(us.created_at, 'YYYY-MM-DD') as joined_date
FROM user_segments us
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as clicks,
        COUNT(DISTINCT item_category) as categories
    FROM link_clicks
    GROUP BY user_id
) lc ON us.user_id::text = lc.user_id::text
ORDER BY us.user_group, COALESCE(lc.clicks, 0) DESC;


-- 4. CONVERSION FUNNEL BY GROUP
-- ============================================================================

-- Batch SMS Recipients Funnel (Got SMS → Batch Page → Main App → Clicks)
SELECT 
    '========== BATCH SMS RECIPIENTS FUNNEL ==========' as stage,
    NULL as count,
    NULL as percentage

UNION ALL

SELECT 
    '1. Got SMS with Batch Result Link',
    COUNT(DISTINCT phone_number)::text,
    '100%'
FROM result_page_visits

UNION ALL

SELECT 
    '2. Visited Batch Page',
    COUNT(DISTINCT phone_number)::text,
    ROUND(COUNT(DISTINCT phone_number) * 100.0 / 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits), 1)::text || '%'
FROM result_page_visits
WHERE time_on_page_seconds > 0

UNION ALL

SELECT 
    '3. Clicked Products on Batch Page',
    COUNT(DISTINCT phone_number)::text,
    ROUND(COUNT(DISTINCT phone_number) * 100.0 / 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits), 1)::text || '%'
FROM result_page_visits
WHERE clicked_products = true

UNION ALL

SELECT 
    '4. Joined Main App',
    COUNT(DISTINCT u.id)::text,
    ROUND(COUNT(DISTINCT u.id) * 100.0 / 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits), 1)::text || '%'
FROM users u
WHERE EXISTS (SELECT 1 FROM result_page_visits rpv WHERE rpv.phone_number = u.phone_number)

UNION ALL

SELECT 
    '5. Clicked Products in Main App',
    COUNT(DISTINCT lc.user_id)::text,
    ROUND(COUNT(DISTINCT lc.user_id) * 100.0 / 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits), 1)::text || '%'
FROM link_clicks lc
JOIN users u ON lc.user_id::text = u.id::text
WHERE EXISTS (SELECT 1 FROM result_page_visits rpv WHERE rpv.phone_number = u.phone_number);


-- Colleagues Funnel (Direct Access → Main App → Clicks)
SELECT 
    '========== YOUR COLLEAGUES FUNNEL ==========' as stage,
    NULL as count,
    NULL as percentage

UNION ALL

SELECT 
    '1. Used Main App',
    COUNT(DISTINCT u.id)::text,
    '100%'
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM result_page_visits rpv WHERE rpv.phone_number = u.phone_number)

UNION ALL

SELECT 
    '2. Clicked Products',
    COUNT(DISTINCT lc.user_id)::text,
    ROUND(COUNT(DISTINCT lc.user_id) * 100.0 / NULLIF(
        (SELECT COUNT(DISTINCT u.id) FROM users u 
         WHERE NOT EXISTS (SELECT 1 FROM result_page_visits rpv WHERE rpv.phone_number = u.phone_number)), 
        0), 1)::text || '%'
FROM link_clicks lc
JOIN users u ON lc.user_id::text = u.id::text
WHERE NOT EXISTS (SELECT 1 FROM result_page_visits rpv WHERE rpv.phone_number = u.phone_number);


-- 5. COMPLETE ACTIVITY TIMELINE BY GROUP
-- ============================================================================
WITH user_segments AS (
    SELECT 
        u.id as user_id,
        u.phone_number,
        CASE 
            WHEN rpv.phone_number IS NOT NULL THEN '👥 Friends'
            ELSE '🌐 Naver'
        END as user_group
    FROM users u
    LEFT JOIN (SELECT DISTINCT phone_number FROM result_page_visits) rpv 
        ON u.phone_number = rpv.phone_number
)
SELECT * FROM (
    -- Batch page visits (only Batch SMS Recipients)
    SELECT 
        TO_CHAR(rpv.visit_timestamp, 'YYYY-MM-DD HH24:MI') as timestamp,
        '🔗 Batch Visit' as activity,
        '📦 Batch' as user_group,
        rpv.phone_number,
        'Time: ' || rpv.time_on_page_seconds || 's | Clicked: ' || rpv.clicked_products::text as details
    FROM result_page_visits rpv
    
    UNION ALL
    
    -- Product clicks (both groups)
    SELECT 
        TO_CHAR(lc.clicked_at, 'YYYY-MM-DD HH24:MI'),
        '🛍️ Product Click',
        us.user_group,
        us.phone_number,
        lc.item_category || ': ' || COALESCE(LEFT(lc.product_title, 40), 'No title')
    FROM link_clicks lc
    JOIN user_segments us ON lc.user_id::text = us.user_id::text
    
    UNION ALL
    
    -- Feedback (both groups)
    SELECT 
        TO_CHAR(uf.created_at, 'YYYY-MM-DD HH24:MI'),
        '💭 Feedback',
        us.user_group,
        us.phone_number,
        uf.satisfaction
    FROM user_feedback uf
    JOIN user_segments us ON uf.phone_number = us.phone_number
    
) timeline
ORDER BY timestamp DESC
LIMIT 50;


-- 6. CATEGORY PREFERENCES BY GROUP
-- ============================================================================
WITH user_segments AS (
    SELECT 
        u.id as user_id,
        CASE 
            WHEN rpv.phone_number IS NOT NULL THEN '📦 Batch SMS'
            ELSE '💼 Colleagues'
        END as user_group
    FROM users u
    LEFT JOIN (SELECT DISTINCT phone_number FROM result_page_visits) rpv 
        ON u.phone_number = rpv.phone_number
)
SELECT 
    us.user_group,
    lc.item_category,
    COUNT(*) as clicks,
    COUNT(DISTINCT lc.user_id) as unique_users
FROM link_clicks lc
JOIN user_segments us ON lc.user_id::text = us.user_id::text
GROUP BY us.user_group, lc.item_category
ORDER BY us.user_group, clicks DESC;

