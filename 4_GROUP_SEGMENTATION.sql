-- ============================================================================
-- 4-GROUP USER SEGMENTATION
-- Separates: Batch Only, Button Converts, Interviewed Converts, Colleagues
-- ============================================================================

-- STEP 1: Add your 6 colleague phone numbers here
WITH colleague_phones AS (
    SELECT phone FROM (VALUES
        ('01090848563'),  -- You
        ('0101234567'),   -- Replace with actual colleague phone
        ('0101234568'),   -- Replace with actual colleague phone
        ('0101234569'),   -- Replace with actual colleague phone
        ('0101234570'),   -- Replace with actual colleague phone
        ('0101234571')    -- Replace with actual colleague phone
    ) AS t(phone)
),
normalized_batch AS (
    SELECT 
        phone_number,
        normalize_phone(phone_number) as norm_phone
    FROM result_page_visits
),
normalized_users AS (
    SELECT 
        id,
        phone_number,
        normalize_phone(phone_number) as norm_phone
    FROM users
    WHERE phone_number IS NOT NULL
)
SELECT 
    '📦 Batch SMS Only (Viewed results, no conversion)' as user_group,
    COUNT(DISTINCT nb.phone_number) as count,
    'Got SMS, viewed link, left' as behavior
FROM normalized_batch nb
WHERE nb.norm_phone NOT IN (SELECT norm_phone FROM normalized_users)

UNION ALL

SELECT 
    '🔘 Batch SMS Button Converts (Organic conversion)',
    1,  -- We know user 01048545690 is the button convert
    'Clicked "다른 이미지도 찾아보기"'
-- Note: Currently tracked as 1 known convert

UNION ALL

SELECT 
    '🎤 Batch SMS Interviewed (Manual onboarding)',
    COUNT(DISTINCT u.id),
    'Got SMS, you interviewed them, joined main app'
FROM normalized_users u
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)
  AND u.phone_number NOT IN (SELECT phone FROM colleague_phones)
  AND u.phone_number != '01048545690'  -- Exclude the button convert

UNION ALL

SELECT 
    '💼 True Colleagues (Internal testing)',
    COUNT(DISTINCT u.id),
    'Your team testing the app'
FROM normalized_users u
WHERE u.phone_number IN (SELECT phone FROM colleague_phones)

UNION ALL

SELECT 
    '═══ TOTAL BATCH SMS SENT ═══',
    COUNT(DISTINCT phone_number),
    '116 users from 3 batches'
FROM result_page_visits

UNION ALL

SELECT 
    '═══ TOTAL MAIN APP USERS ═══',
    COUNT(DISTINCT id),
    'Colleagues + button converts + interviewed'
FROM users;


-- ============================================================================
-- DETAILED BREAKDOWN: Who Are The Interviewed Users?
-- ============================================================================

SELECT 
    '🎤 Batch SMS Interviewed Users' as group_name,
    u.phone_number,
    COALESCE(lc.clicks, 0) as product_clicks,
    CASE WHEN COALESCE(lc.clicks, 0) > 0 THEN '✅ Active' ELSE '⏸️ Not clicking yet' END as engagement
FROM normalized_users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as clicks
    FROM link_clicks
    GROUP BY user_id
) lc ON u.id::text = lc.user_id::text
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)
  AND u.phone_number NOT IN (SELECT phone FROM colleague_phones)
  AND u.phone_number != '01048545690'  -- Exclude the button convert
ORDER BY COALESCE(lc.clicks, 0) DESC;


