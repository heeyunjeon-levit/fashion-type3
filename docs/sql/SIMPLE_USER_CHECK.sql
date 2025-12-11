-- ============================================================================
-- SIMPLE USER CHECK - Guaranteed to work!
-- Replace phone number: 01090848563
-- ============================================================================

-- 1. BASIC STATS
-- ============================================================================
SELECT 
    'Phone Number' as info,
    '01090848563' as value
    
UNION ALL

SELECT 
    'Total Sessions',
    COUNT(*)::text
FROM sessions 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Batch Links Sent',
    COUNT(*)::text
FROM result_page_visits 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Products Clicked',
    COUNT(*)::text
FROM link_clicks lc 
JOIN sessions s ON lc.session_id::text = s.session_id::text
WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Feedback Count',
    COUNT(*)::text
FROM user_feedback 
WHERE phone_number IN ('01090848563', '821090848563', '1090848563');


-- 2. USER ACTIVITY TIMELINE
-- ============================================================================
SELECT * FROM (
    -- User created
    SELECT 
        created_at as when_it_happened,
        '🆕 First Visit' as what_happened,
        'User account created' as notes
    FROM users 
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Sessions
    SELECT 
        created_at,
        '📱 Started Session',
        'Session: ' || LEFT(session_id, 8) || '...'
    FROM sessions
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Batch visits
    SELECT 
        visit_timestamp,
        '🔗 Visited Batch Link',
        'Spent ' || time_on_page_seconds || ' seconds'
    FROM result_page_visits
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Product clicks
    SELECT 
        lc.clicked_at,
        '🛍️ Clicked Product',
        lc.item_category || ': ' || COALESCE(LEFT(lc.product_title, 50), 'No title')
    FROM link_clicks lc
    JOIN sessions s ON lc.session_id::text = s.session_id::text
    WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Feedback
    SELECT 
        created_at,
        '💭 Gave Feedback',
        satisfaction || ' - ' || COALESCE(LEFT(comment, 50), 'No comment')
    FROM user_feedback
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
) events
ORDER BY when_it_happened DESC;


-- 3. DID THEY CONVERT? (Batch → Main App)
-- ============================================================================
SELECT 
    'Got Batch Link?' as question,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ YES'
        ELSE '❌ NO'
    END as answer
FROM result_page_visits
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Used Main App?',
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ YES'
        ELSE '❌ NO'
    END
FROM sessions
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Clicked Products?',
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ YES (' || COUNT(*) || ' clicks)'
        ELSE '❌ NO'
    END
FROM link_clicks lc
JOIN sessions s ON lc.session_id::text = s.session_id::text
WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')

UNION ALL

SELECT 
    'Gave Feedback?',
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ YES'
        ELSE '❌ NO'
    END
FROM user_feedback
WHERE phone_number IN ('01090848563', '821090848563', '1090848563');


-- 4. ALL FEEDBACK (if any)
-- ============================================================================
SELECT 
    created_at,
    satisfaction as feeling,
    COALESCE(comment, 'No comment') as their_comment,
    time_to_feedback_seconds as seconds_to_decide
FROM user_feedback
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
ORDER BY created_at DESC;


-- 5. ALL PRODUCT CLICKS (if any)
-- ============================================================================
SELECT 
    lc.clicked_at as when_clicked,
    lc.item_category as category,
    COALESCE(lc.product_title, 'No title') as product,
    lc.link_position as position_in_results
FROM link_clicks lc
JOIN sessions s ON lc.session_id::text = s.session_id::text
WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')
ORDER BY lc.clicked_at DESC;

