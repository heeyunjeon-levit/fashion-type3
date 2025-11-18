-- ============================================================================
-- 100% WORKING USER QUERY
-- Replace: 01090848563 with your phone number
-- ============================================================================

-- OVERVIEW (Run this first!)
-- ============================================================================
SELECT 
    'Phone Number' as info,
    '01090848563' as value
    
UNION ALL

SELECT 
    'Sessions',
    COUNT(*)::text
FROM sessions 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Batch Links',
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
    'Feedback',
    COUNT(*)::text
FROM user_feedback 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563');


-- COMPLETE TIMELINE
-- ============================================================================
SELECT * FROM (
    SELECT 
        created_at as timestamp,
        '🆕 JOINED' as event,
        'First visit' as details
    FROM users 
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    SELECT 
        created_at,
        '📱 SESSION',
        'Started session'
    FROM sessions
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    SELECT 
        visit_timestamp,
        '🔗 BATCH',
        time_on_page_seconds || ' seconds on page'
    FROM result_page_visits
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    SELECT 
        lc.clicked_at,
        '🛍️ CLICK',
        lc.item_category || ': ' || COALESCE(lc.product_title, 'No title')
    FROM link_clicks lc
    JOIN sessions s ON lc.session_id::text = s.session_id::text
    WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    SELECT 
        created_at,
        '💭 FEEDBACK',
        satisfaction || ' - ' || COALESCE(comment, 'No comment')
    FROM user_feedback
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
) timeline
ORDER BY timestamp DESC;


-- CONVERSION FUNNEL
-- ============================================================================
SELECT 
    'Got Batch Link?' as step,
    CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END as status
FROM result_page_visits
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Used Main App?',
    CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END
FROM sessions
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Clicked Products?',
    CASE WHEN COUNT(*) > 0 THEN '✅ YES (' || COUNT(*) || ')' ELSE '❌ NO' END
FROM link_clicks lc
JOIN sessions s ON lc.session_id::text = s.session_id::text
WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Gave Feedback?',
    CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END
FROM user_feedback
WHERE phone_number IN ('01090848563', '821090848563', '1090848563');

