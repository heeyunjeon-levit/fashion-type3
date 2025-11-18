-- ============================================================================
-- UNIVERSAL USER JOURNEY - Works for ANY phone number
-- Replace: PHONE_NUMBER_HERE with actual phone (e.g., 01090848563)
-- ============================================================================

-- STEP 1: Get user_id from phone number
-- ============================================================================
WITH target_user AS (
    SELECT 
        id as user_id,
        phone_number,
        total_searches,
        created_at as first_visit,
        last_active_at
    FROM users
    WHERE phone_number LIKE '%PHONE_NUMBER_HERE%'
       OR phone_number = 'PHONE_NUMBER_HERE'
       OR phone_number = '82PHONE_NUMBER_HERE'
       OR phone_number = '0PHONE_NUMBER_HERE'
    LIMIT 1
)

-- STEP 2: Complete user overview
SELECT 
    '========== USER OVERVIEW ==========' as section,
    NULL as detail1,
    NULL as detail2,
    NULL as detail3
    
UNION ALL

SELECT 
    'Phone Number',
    phone_number,
    NULL,
    NULL
FROM target_user

UNION ALL

SELECT 
    'User ID',
    user_id::text,
    NULL,
    NULL
FROM target_user

UNION ALL

SELECT 
    'Total Searches',
    total_searches::text,
    NULL,
    NULL
FROM target_user

UNION ALL

SELECT 
    'First Visit',
    TO_CHAR(first_visit, 'YYYY-MM-DD HH24:MI:SS'),
    NULL,
    NULL
FROM target_user

UNION ALL

SELECT 
    'Last Active',
    TO_CHAR(last_active_at, 'YYYY-MM-DD HH24:MI:SS'),
    NULL,
    NULL
FROM target_user;


-- STEP 3: Activity counts across all tables
-- ============================================================================
WITH target_user AS (
    SELECT id as user_id, phone_number FROM users WHERE phone_number LIKE '%PHONE_NUMBER_HERE%' LIMIT 1
)
SELECT 
    '========== ACTIVITY COUNTS ==========' as metric,
    NULL as count,
    NULL as detail1,
    NULL as detail2

UNION ALL

SELECT 
    'Sessions (by user_id)',
    COUNT(*)::text,
    NULL,
    NULL
FROM sessions s, target_user
WHERE s.user_id = target_user.user_id

UNION ALL

SELECT 
    'Sessions (by phone)',
    COUNT(*)::text,
    NULL,
    NULL
FROM sessions s, target_user
WHERE s.phone_number = target_user.phone_number

UNION ALL

SELECT 
    'Product Clicks',
    COUNT(*)::text,
    'Unique Categories: ' || COUNT(DISTINCT item_category)::text,
    NULL
FROM link_clicks lc, target_user
WHERE lc.user_id = target_user.user_id

UNION ALL

SELECT 
    'Batch Page Visits',
    COUNT(*)::text,
    'Avg Time: ' || ROUND(AVG(time_on_page_seconds))::text || 's',
    NULL
FROM result_page_visits rpv, target_user
WHERE rpv.phone_number = target_user.phone_number

UNION ALL

SELECT 
    'Feedback Submitted',
    COUNT(*)::text,
    NULL,
    NULL
FROM user_feedback uf, target_user
WHERE uf.phone_number = target_user.phone_number;


-- STEP 4: Complete timeline of ALL activities
-- ============================================================================
WITH target_user AS (
    SELECT id as user_id, phone_number FROM users WHERE phone_number LIKE '%PHONE_NUMBER_HERE%' LIMIT 1
)
SELECT 
    '========== COMPLETE TIMELINE ==========' as timestamp,
    NULL as event,
    NULL as category,
    NULL as details

UNION ALL

SELECT * FROM (
    -- User creation
    SELECT 
        TO_CHAR(u.created_at, 'YYYY-MM-DD HH24:MI:SS') as timestamp,
        '🆕 JOINED' as event,
        NULL as category,
        'First visit to platform' as details
    FROM users u, target_user
    WHERE u.id = target_user.user_id
    
    UNION ALL
    
    -- Sessions
    SELECT 
        TO_CHAR(s.created_at, 'YYYY-MM-DD HH24:MI:SS'),
        '📱 SESSION',
        s.status,
        'Session: ' || LEFT(s.session_id, 8) || '...'
    FROM sessions s, target_user
    WHERE s.user_id = target_user.user_id
       OR s.phone_number = target_user.phone_number
    
    UNION ALL
    
    -- Product clicks
    SELECT 
        TO_CHAR(lc.clicked_at, 'YYYY-MM-DD HH24:MI:SS'),
        '🛍️ CLICKED',
        lc.item_category,
        COALESCE(LEFT(lc.product_title, 60), 'No title') || ' (pos: ' || lc.link_position::text || ')'
    FROM link_clicks lc, target_user
    WHERE lc.user_id = target_user.user_id
    
    UNION ALL
    
    -- Batch page visits
    SELECT 
        TO_CHAR(rpv.visit_timestamp, 'YYYY-MM-DD HH24:MI:SS'),
        '🔗 BATCH PAGE',
        NULL,
        'Time on page: ' || rpv.time_on_page_seconds::text || 's | Clicked: ' || rpv.clicked_products::text
    FROM result_page_visits rpv, target_user
    WHERE rpv.phone_number = target_user.phone_number
    
    UNION ALL
    
    -- Feedback
    SELECT 
        TO_CHAR(uf.created_at, 'YYYY-MM-DD HH24:MI:SS'),
        '💭 FEEDBACK',
        uf.satisfaction,
        COALESCE(uf.comment, 'No comment')
    FROM user_feedback uf, target_user
    WHERE uf.phone_number = target_user.phone_number
    
) timeline
ORDER BY timestamp DESC;


-- STEP 5: Favorite categories and products
-- ============================================================================
WITH target_user AS (
    SELECT id as user_id FROM users WHERE phone_number LIKE '%PHONE_NUMBER_HERE%' LIMIT 1
)
SELECT 
    '========== FAVORITE CATEGORIES ==========' as category,
    NULL as clicks,
    NULL as percentage,
    NULL as last_click

UNION ALL

SELECT 
    item_category,
    COUNT(*)::text,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1)::text || '%',
    TO_CHAR(MAX(clicked_at), 'YYYY-MM-DD HH24:MI')
FROM link_clicks lc, target_user
WHERE lc.user_id = target_user.user_id
GROUP BY item_category
ORDER BY COUNT(*) DESC;


