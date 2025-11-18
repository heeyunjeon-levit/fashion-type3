-- ============================================================================
-- COMPLETE USER JOURNEY QUERY TEMPLATE
-- ============================================================================
-- Replace 'PHONE_NUMBER_HERE' with the actual phone number (e.g., 01090848563)
-- The query checks all 3 formats automatically: 010xxx, 821xxx, 1xxx
-- ============================================================================

-- QUICK SETUP: Replace this once
-- ============================================================================
-- Find/Replace: 'PHONE_NUMBER_HERE' → 'YOUR_ACTUAL_PHONE'
-- Example: '01090848563' or '821090848563' or '1090848563'
-- ============================================================================

\set phone_full '01090848563'
\set phone_intl '821090848563'
\set phone_short '1090848563'

-- 1. USER OVERVIEW
-- ============================================================================
SELECT '========== USER OVERVIEW ==========' as section;

SELECT 
    phone_number,
    total_searches,
    created_at as first_visit,
    last_active_at as last_visit,
    EXTRACT(EPOCH FROM (NOW() - created_at))/86400 as days_active
FROM users
WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)
ORDER BY created_at DESC;

-- 2. ENGAGEMENT SUMMARY
-- ============================================================================
SELECT '========== ENGAGEMENT SUMMARY ==========' as section;

WITH user_data AS (
    SELECT phone_number FROM users 
    WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)
)
SELECT 
    (SELECT COUNT(*) FROM sessions WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)) as "Main App Sessions",
    (SELECT COUNT(*) FROM result_page_visits WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)) as "Batch Page Visits",
    (SELECT COUNT(*) FROM link_clicks lc JOIN sessions s ON lc.session_id::text = s.session_id::text WHERE s.phone_number IN (:phone_full, :phone_intl, :phone_short)) as "Product Clicks",
    (SELECT COUNT(*) FROM user_feedback WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)) as "Feedback Submitted",
    (SELECT AVG(time_on_page_seconds) FROM result_page_visits WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)) as "Avg Time on Batch Pages (seconds)";

-- 3. COMPLETE TIMELINE
-- ============================================================================
SELECT '========== COMPLETE TIMELINE ==========' as section;

SELECT * FROM (
    SELECT 
        created_at as timestamp,
        '🆕 USER CREATED' as event,
        'First visit to platform' as details
    FROM users
    WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)
    
    UNION ALL
    
    SELECT 
        created_at,
        '📱 SESSION STARTED',
        'Session: ' || session_id || ' | Status: ' || status
    FROM sessions
    WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)
    
    UNION ALL
    
    SELECT 
        visit_timestamp,
        '🔗 BATCH PAGE VISIT',
        'URL: ' || result_page_url || ' | Time: ' || time_on_page_seconds || 's | Clicked: ' || clicked_products::text
    FROM result_page_visits
    WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)
    
    UNION ALL
    
    SELECT 
        visit_timestamp,
        '🌐 MAIN APP VISIT',
        'Path: ' || page_path || ' | Uploaded: ' || uploaded_image::text || ' | Analysis: ' || completed_analysis::text
    FROM app_page_visits
    WHERE referrer LIKE '%' || :phone_short || '%'
    
    UNION ALL
    
    SELECT 
        lc.clicked_at,
        '🛍️ PRODUCT CLICKED',
        lc.item_category || ': ' || COALESCE(lc.product_title, 'No title') || ' | Pos: ' || lc.link_position::text
    FROM link_clicks lc
    JOIN sessions s ON lc.session_id::text = s.session_id::text
    WHERE s.phone_number IN (:phone_full, :phone_intl, :phone_short)
    
    UNION ALL
    
    SELECT 
        created_at,
        '💭 FEEDBACK',
        satisfaction || ' | ' || COALESCE(comment, 'No comment') || ' | Source: ' || 
        CASE WHEN result_page_url = 'main_app_result_page' THEN 'Main App' ELSE 'Batch' END
    FROM user_feedback
    WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)
    
) timeline
ORDER BY timestamp DESC;

-- 4. CONVERSION FUNNEL
-- ============================================================================
SELECT '========== CONVERSION FUNNEL ==========' as section;

SELECT 
    step_number,
    step_name,
    status
FROM (
    SELECT 1 as step_number, '1️⃣ Received Batch Link' as step_name,
        CASE WHEN EXISTS (SELECT 1 FROM result_page_visits WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)) THEN '✅ YES' ELSE '❌ NO' END as status
    UNION ALL
    SELECT 2, '2️⃣ Visited Batch Link',
        CASE WHEN (SELECT COUNT(*) FROM result_page_visits WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)) > 0 THEN '✅ YES' ELSE '❌ NO' END
    UNION ALL
    SELECT 3, '3️⃣ Clicked Products on Batch Page',
        CASE WHEN (SELECT SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END) FROM result_page_visits WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)) > 0 THEN '✅ YES' ELSE '❌ NO' END
    UNION ALL
    SELECT 4, '4️⃣ Converted to Main App',
        CASE WHEN (SELECT COUNT(*) FROM app_page_visits WHERE referrer LIKE '%' || :phone_short || '%') > 0 THEN '✅ YES' ELSE '❌ NO' END
    UNION ALL
    SELECT 5, '5️⃣ Uploaded New Image',
        CASE WHEN (SELECT COUNT(*) FROM app_page_visits WHERE referrer LIKE '%' || :phone_short || '%' AND uploaded_image = true) > 0 THEN '✅ YES' ELSE '❌ NO' END
    UNION ALL
    SELECT 6, '6️⃣ Submitted Feedback',
        CASE WHEN (SELECT COUNT(*) FROM user_feedback WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)) > 0 THEN '✅ YES' ELSE '❌ NO' END
) funnel
ORDER BY step_number;

-- 5. SESSION DETAILS
-- ============================================================================
SELECT '========== SESSION DETAILS ==========' as section;

SELECT 
    session_id,
    created_at,
    status,
    phone_collected_at,
    uploaded_image_url,
    searched_at
FROM sessions
WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)
ORDER BY created_at DESC;

-- 6. PRODUCT CLICKS
-- ============================================================================
SELECT '========== PRODUCT CLICKS ==========' as section;

SELECT 
    lc.clicked_at,
    lc.item_category,
    lc.product_title,
    lc.product_link,
    lc.link_position,
    s.session_id
FROM link_clicks lc
JOIN sessions s ON lc.session_id::text = s.session_id::text
WHERE s.phone_number IN (:phone_full, :phone_intl, :phone_short)
ORDER BY lc.clicked_at DESC;

-- 7. FEEDBACK HISTORY
-- ============================================================================
SELECT '========== FEEDBACK HISTORY ==========' as section;

SELECT 
    created_at,
    satisfaction,
    comment,
    time_to_feedback_seconds,
    CASE 
        WHEN result_page_url = 'main_app_result_page' THEN '📱 Main App'
        ELSE '🔗 Batch: ' || result_page_url
    END as source
FROM user_feedback
WHERE phone_number IN (:phone_full, :phone_intl, :phone_short)
ORDER BY created_at DESC;

