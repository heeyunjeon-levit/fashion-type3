-- ============================================================================
-- YOUR COMPLETE JOURNEY - Using USER_ID
-- User: 01090848563
-- User ID: fc878118-43dd-4363-93cf-d31e453df81e
-- ============================================================================

-- 1. OVERVIEW
-- ============================================================================
SELECT 
    'User ID' as info,
    'fc878118-43dd-4363-93cf-d31e453df81e' as value
    
UNION ALL

SELECT 
    'Phone Number',
    '01090848563'
    
UNION ALL

SELECT 
    'Total Searches',
    (SELECT total_searches::text FROM users WHERE id = 'fc878118-43dd-4363-93cf-d31e453df81e')

UNION ALL

SELECT 
    'Sessions',
    COUNT(*)::text
FROM sessions 
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'

UNION ALL

SELECT 
    'Product Clicks',
    COUNT(*)::text
FROM link_clicks 
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'

UNION ALL

SELECT 
    'Feedback Submitted',
    COUNT(*)::text
FROM user_feedback 
WHERE phone_number = '01090848563';


-- 2. ALL YOUR SESSIONS
-- ============================================================================
SELECT 
    created_at,
    session_id,
    status,
    phone_collected_at,
    CASE 
        WHEN phone_number IS NOT NULL THEN '✅ Phone: ' || phone_number
        ELSE '❌ No phone'
    END as phone_status
FROM sessions
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
ORDER BY created_at DESC;


-- 3. ALL YOUR PRODUCT CLICKS
-- ============================================================================
SELECT 
    clicked_at,
    item_category,
    product_title,
    link_position,
    session_id
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
ORDER BY clicked_at DESC;


-- 4. COMPLETE TIMELINE
-- ============================================================================
SELECT * FROM (
    -- User created
    SELECT 
        created_at as timestamp,
        '🆕 JOINED' as event,
        'First visit' as details
    FROM users 
    WHERE id = 'fc878118-43dd-4363-93cf-d31e453df81e'
    
    UNION ALL
    
    -- Sessions
    SELECT 
        created_at,
        '📱 SESSION',
        'Session: ' || LEFT(session_id, 8) || '... | Status: ' || status
    FROM sessions
    WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
    
    UNION ALL
    
    -- Product clicks
    SELECT 
        clicked_at,
        '🛍️ CLICK',
        item_category || ': ' || COALESCE(product_title, 'No title')
    FROM link_clicks
    WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
    
    UNION ALL
    
    -- Feedback
    SELECT 
        created_at,
        '💭 FEEDBACK',
        satisfaction || ' - ' || COALESCE(comment, 'No comment')
    FROM user_feedback
    WHERE phone_number = '01090848563'
    
) timeline
ORDER BY timestamp DESC;


-- 5. ENGAGEMENT SUMMARY
-- ============================================================================
SELECT 
    'Sessions' as metric,
    COUNT(*)::text as value
FROM sessions
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'

UNION ALL

SELECT 
    'Sessions WITH Phone Number',
    COUNT(*)::text
FROM sessions
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
  AND phone_number IS NOT NULL

UNION ALL

SELECT 
    'Product Clicks',
    COUNT(*)::text
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'

UNION ALL

SELECT 
    'Unique Products Clicked',
    COUNT(DISTINCT item_category)::text
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'

UNION ALL

SELECT 
    'Feedback Count',
    COUNT(*)::text
FROM user_feedback
WHERE phone_number = '01090848563'

UNION ALL

SELECT 
    'First Visit',
    TO_CHAR(MIN(created_at), 'YYYY-MM-DD HH24:MI')
FROM users
WHERE id = 'fc878118-43dd-4363-93cf-d31e453df81e'

UNION ALL

SELECT 
    'Last Active',
    TO_CHAR(MAX(last_active_at), 'YYYY-MM-DD HH24:MI')
FROM users
WHERE id = 'fc878118-43dd-4363-93cf-d31e453df81e';


-- 6. YOUR FAVORITE CATEGORIES
-- ============================================================================
SELECT 
    item_category as category,
    COUNT(*) as clicks,
    COUNT(DISTINCT session_id) as different_sessions
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
GROUP BY item_category
ORDER BY clicks DESC;

