-- ============================================================================
-- FIND YOUR SESSIONS (they exist, just not linked to phone!)
-- ============================================================================

-- 1. Check your user_id
-- ============================================================================
SELECT 
    id as your_user_id,
    phone_number,
    total_searches,
    created_at
FROM users
WHERE phone_number = '01090848563';


-- 2. Find sessions linked to your USER_ID (not phone number)
-- ============================================================================
WITH your_user AS (
    SELECT id FROM users WHERE phone_number = '01090848563'
)
SELECT 
    s.session_id,
    s.phone_number,
    s.created_at,
    s.status,
    s.user_id,
    s.phone_collected_at
FROM sessions s
WHERE s.user_id IN (SELECT id FROM your_user)
ORDER BY s.created_at DESC
LIMIT 20;


-- 3. Count sessions by user_id vs phone_number
-- ============================================================================
WITH your_user AS (
    SELECT id FROM users WHERE phone_number = '01090848563'
)
SELECT 
    'Sessions by USER_ID' as method,
    COUNT(*) as count
FROM sessions
WHERE user_id IN (SELECT id FROM your_user)

UNION ALL

SELECT 
    'Sessions by PHONE',
    COUNT(*)
FROM sessions
WHERE phone_number = '01090848563';


-- 4. Show recent sessions to understand the pattern
-- ============================================================================
SELECT 
    session_id,
    user_id,
    phone_number,
    created_at,
    status,
    CASE 
        WHEN phone_number IS NULL THEN '❌ No phone'
        ELSE '✅ Has phone'
    END as phone_status
FROM sessions
ORDER BY created_at DESC
LIMIT 30;


-- 5. Check link_clicks by user_id
-- ============================================================================
WITH your_user AS (
    SELECT id FROM users WHERE phone_number = '01090848563'
)
SELECT 
    lc.clicked_at,
    lc.item_category,
    lc.product_title,
    lc.session_id,
    lc.user_id
FROM link_clicks lc
WHERE lc.user_id IN (SELECT id FROM your_user)
ORDER BY lc.clicked_at DESC
LIMIT 20;

