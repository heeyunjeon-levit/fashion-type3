-- ============================================================================
-- SECTION 2: CONVERSION RATE - Batch SMS → Main App (FIXED)
-- ============================================================================

WITH normalized_batch AS (
    SELECT 
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        time_on_page_seconds
    FROM result_page_visits
),
normalized_users AS (
    SELECT 
        id,
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        total_searches
    FROM users
    WHERE phone_number IS NOT NULL
)
SELECT 
    'Conversion Funnel' as stage,
    NULL as count,
    NULL as rate

UNION ALL

SELECT 
    '1. Batch SMS Sent (unique phones)',
    COUNT(DISTINCT phone_number)::text,
    '100%'
FROM result_page_visits

UNION ALL

SELECT 
    '2. Visited Batch Page',
    COUNT(DISTINCT phone_number)::text,
    '100%'
FROM result_page_visits
WHERE time_on_page_seconds > 0

UNION ALL

SELECT 
    '3. Clicked "다른 이미지도 찾아보기" & Joined Main App',
    COUNT(DISTINCT u.id)::text,
    ROUND(COUNT(DISTINCT u.id) * 100.0 / 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits), 1)::text || '% ✅ CONVERSION RATE'
FROM normalized_users u
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)

UNION ALL

SELECT 
    '4. Now Clicking Products in Main App',
    COUNT(DISTINCT lc.user_id)::text,
    ROUND(COUNT(DISTINCT lc.user_id) * 100.0 / NULLIF(
        (SELECT COUNT(DISTINCT u.id) FROM normalized_users u WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)), 
        0), 1)::text || '% of converts'
FROM link_clicks lc
JOIN normalized_users u ON lc.user_id::text = u.id::text
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch);

