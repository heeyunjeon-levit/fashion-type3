-- ============================================================================
-- QUICK USER LOOKUP - Simple queries that always work
-- ============================================================================
-- Replace phone number in all 3 places below
-- Example: '01090848563' or '821090848563'
-- ============================================================================

-- 1. QUICK OVERVIEW (Run this first!)
-- ============================================================================
SELECT 
    'Total Sessions' as metric, 
    COUNT(*)::text as value 
FROM sessions 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Batch Page Visits', 
    COUNT(*)::text 
FROM result_page_visits 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Product Clicks', 
    COUNT(*)::text 
FROM link_clicks lc 
JOIN sessions s ON lc.session_id::text = s.session_id::text 
WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Feedback Submitted', 
    COUNT(*)::text 
FROM user_feedback 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'First Visit', 
    TO_CHAR(MIN(created_at), 'YYYY-MM-DD HH24:MI')
FROM users 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Last Active', 
    TO_CHAR(MAX(last_active_at), 'YYYY-MM-DD HH24:MI')
FROM users 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563');


-- 2. COMPLETE TIMELINE (Everything they did)
-- ============================================================================
SELECT * FROM (
    -- User created
    SELECT 
        created_at as timestamp,
        '🆕 USER CREATED' as event,
        'First visit to platform' as details
    FROM users 
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Sessions
    SELECT 
        created_at,
        '📱 SESSION' as event,
        'Session ID: ' || session_id || ' | Status: ' || status
    FROM sessions
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Batch page visits
    SELECT 
        visit_timestamp,
        '🔗 BATCH PAGE' as event,
        'Time on page: ' || time_on_page_seconds || 's | Clicked products: ' || clicked_products::text
    FROM result_page_visits
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Product clicks
    SELECT 
        lc.clicked_at,
        '🛍️ PRODUCT CLICK' as event,
        lc.item_category || ': ' || COALESCE(lc.product_title, 'No title')
    FROM link_clicks lc
    JOIN sessions s ON lc.session_id::text = s.session_id::text
    WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Feedback
    SELECT 
        created_at,
        '💭 FEEDBACK' as event,
        satisfaction || ' | ' || COALESCE(comment, 'No comment')
    FROM user_feedback
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
) timeline
ORDER BY timestamp DESC;


-- 3. CONVERSION CHECK (Did they go from batch → main app?)
-- ============================================================================
SELECT 
    'Received Batch Link?' as question,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM result_page_visits 
            WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
        ) 
        THEN '✅ YES'
        ELSE '❌ NO - Main app only'
    END as answer

UNION ALL

SELECT 
    'Visited Batch Link?',
    CASE 
        WHEN (SELECT COUNT(*) FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) > 0 
        THEN '✅ YES'
        ELSE '❌ NO'
    END

UNION ALL

SELECT 
    'Clicked Products on Batch?',
    CASE 
        WHEN (SELECT SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END) FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) > 0 
        THEN '✅ YES'
        ELSE '❌ NO'
    END

UNION ALL

SELECT 
    'Clicked "다른 이미지도 찾아보기"?',
    CASE 
        WHEN (SELECT COUNT(*) FROM app_page_visits WHERE referrer LIKE '%1090848563%') > 0 
        THEN '✅ YES - Converted!'
        ELSE '❌ NO'
    END

UNION ALL

SELECT 
    'Uploaded New Image?',
    CASE 
        WHEN (SELECT COUNT(*) FROM app_page_visits WHERE referrer LIKE '%1090848563%' AND uploaded_image = true) > 0 
        THEN '✅ YES'
        ELSE '❌ NO'
    END

UNION ALL

SELECT 
    'Submitted Feedback?',
    CASE 
        WHEN (SELECT COUNT(*) FROM user_feedback WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) > 0 
        THEN '✅ YES'
        ELSE '❌ NO'
    END;


-- 4. ALL FEEDBACK (If any)
-- ============================================================================
SELECT 
    created_at,
    satisfaction,
    comment,
    time_to_feedback_seconds,
    CASE 
        WHEN result_page_url = 'main_app_result_page' THEN '📱 Main App'
        ELSE '🔗 Batch Page'
    END as source
FROM user_feedback
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
ORDER BY created_at DESC;


-- 5. ALL PRODUCT CLICKS (If any)
-- ============================================================================
SELECT 
    lc.clicked_at,
    lc.item_category,
    lc.product_title,
    lc.link_position,
    s.session_id
FROM link_clicks lc
JOIN sessions s ON lc.session_id::text = s.session_id::text
WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')
ORDER BY lc.clicked_at DESC;

