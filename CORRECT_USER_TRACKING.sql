-- ============================================================================
-- CORRECT USER TRACKING - Using the RIGHT tables!
-- Based on audit: sessions table is EMPTY, use app_page_visits instead
-- Replace: PHONE_NUMBER_HERE with target phone
-- ============================================================================

-- 1. USER OVERVIEW
-- ============================================================================
WITH target_user AS (
    SELECT 
        id as user_id,
        phone_number,
        total_searches,
        created_at,
        last_active_at
    FROM users
    WHERE phone_number LIKE '%PHONE_NUMBER_HERE%'
    LIMIT 1
)
SELECT 
    'Phone Number' as info,
    phone_number as value
FROM target_user

UNION ALL

SELECT 
    'User ID',
    user_id::text
FROM target_user

UNION ALL

SELECT 
    'Total Searches',
    total_searches::text
FROM target_user

UNION ALL

SELECT 
    'Member Since',
    TO_CHAR(created_at, 'YYYY-MM-DD')
FROM target_user

UNION ALL

SELECT 
    'Last Active',
    TO_CHAR(last_active_at, 'YYYY-MM-DD HH24:MI')
FROM target_user;


-- 2. ACTIVITY SUMMARY (Using correct tables)
-- ============================================================================
WITH target_user AS (
    SELECT id as user_id, phone_number FROM users WHERE phone_number LIKE '%PHONE_NUMBER_HERE%' LIMIT 1
)
SELECT 
    'Product Clicks (Main App)' as metric,
    COUNT(*)::text as count
FROM link_clicks lc, target_user
WHERE lc.user_id = target_user.user_id

UNION ALL

SELECT 
    'Unique Categories Clicked',
    COUNT(DISTINCT item_category)::text
FROM link_clicks lc, target_user
WHERE lc.user_id = target_user.user_id

UNION ALL

SELECT 
    'Batch Page Visits',
    COUNT(*)::text
FROM result_page_visits rpv, target_user
WHERE rpv.phone_number = target_user.phone_number

UNION ALL

SELECT 
    'Total Time on Batch Pages',
    COALESCE(SUM(time_on_page_seconds)::text, '0') || ' seconds'
FROM result_page_visits rpv, target_user
WHERE rpv.phone_number = target_user.phone_number

UNION ALL

SELECT 
    'Clicked Products on Batch Pages?',
    CASE 
        WHEN SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END) > 0 THEN '✅ YES'
        ELSE '❌ NO'
    END
FROM result_page_visits rpv, target_user
WHERE rpv.phone_number = target_user.phone_number

UNION ALL

SELECT 
    'Feedback Submitted?',
    CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END
FROM user_feedback uf, target_user
WHERE uf.phone_number = target_user.phone_number;


-- 3. COMPLETE ACTIVITY TIMELINE
-- ============================================================================
WITH target_user AS (
    SELECT id as user_id, phone_number FROM users WHERE phone_number LIKE '%PHONE_NUMBER_HERE%' LIMIT 1
)
SELECT * FROM (
    -- User joined
    SELECT 
        created_at as timestamp,
        '🆕 JOINED' as event,
        'Main App' as source,
        'First visit' as details
    FROM target_user, users u
    WHERE u.id = target_user.user_id
    
    UNION ALL
    
    -- Batch page visits
    SELECT 
        visit_timestamp,
        '🔗 BATCH PAGE',
        'Batch Results',
        'Spent ' || time_on_page_seconds || 's | Clicked products: ' || clicked_products::text
    FROM result_page_visits rpv, target_user
    WHERE rpv.phone_number = target_user.phone_number
    
    UNION ALL
    
    -- Product clicks (main app)
    SELECT 
        clicked_at,
        '🛍️ CLICKED',
        'Main App',
        item_category || ': ' || COALESCE(LEFT(product_title, 50), 'No title')
    FROM link_clicks lc, target_user
    WHERE lc.user_id = target_user.user_id
    
    UNION ALL
    
    -- Feedback
    SELECT 
        created_at,
        '💭 FEEDBACK',
        CASE WHEN result_page_url = 'main_app_result_page' THEN 'Main App' ELSE 'Batch Page' END,
        satisfaction || ' | ' || COALESCE(LEFT(comment, 50), 'No comment')
    FROM user_feedback uf, target_user
    WHERE uf.phone_number = target_user.phone_number
    
) timeline
ORDER BY timestamp DESC;


-- 4. FAVORITE CATEGORIES
-- ============================================================================
WITH target_user AS (
    SELECT id as user_id FROM users WHERE phone_number LIKE '%PHONE_NUMBER_HERE%' LIMIT 1
)
SELECT 
    item_category as category,
    COUNT(*) as clicks,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage,
    MAX(clicked_at) as last_clicked
FROM link_clicks lc, target_user
WHERE lc.user_id = target_user.user_id
GROUP BY item_category
ORDER BY clicks DESC;


-- 5. CLICKED PRODUCTS
-- ============================================================================
WITH target_user AS (
    SELECT id as user_id FROM users WHERE phone_number LIKE '%PHONE_NUMBER_HERE%' LIMIT 1
)
SELECT 
    clicked_at,
    item_category,
    product_title,
    link_position,
    LEFT(product_link, 50) as link_preview
FROM link_clicks lc, target_user
WHERE lc.user_id = target_user.user_id
ORDER BY clicked_at DESC;


-- 6. BATCH PAGE VISIT DETAILS
-- ============================================================================
WITH target_user AS (
    SELECT phone_number FROM users WHERE phone_number LIKE '%PHONE_NUMBER_HERE%' LIMIT 1
)
SELECT 
    visit_timestamp,
    result_page_url,
    time_on_page_seconds,
    clicked_products,
    clicked_toggle_button,
    opened_feedback,
    session_id
FROM result_page_visits rpv, target_user
WHERE rpv.phone_number = target_user.phone_number
ORDER BY visit_timestamp DESC;


-- 7. FEEDBACK DETAILS (if any)
-- ============================================================================
WITH target_user AS (
    SELECT phone_number FROM users WHERE phone_number LIKE '%PHONE_NUMBER_HERE%' LIMIT 1
)
SELECT 
    created_at,
    satisfaction,
    comment,
    result_page_url,
    time_to_feedback_seconds
FROM user_feedback uf, target_user
WHERE uf.phone_number = target_user.phone_number
ORDER BY created_at DESC;


