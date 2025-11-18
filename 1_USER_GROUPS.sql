-- ============================================================================
-- SECTION 1: THE 3 USER GROUPS (WITH PHONE NORMALIZATION)
-- ============================================================================
-- Run this FIRST to create the normalize_phone function
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT) RETURNS TEXT AS $$
BEGIN
    IF phone LIKE '82%' THEN
        RETURN '0' || SUBSTRING(phone FROM 3);
    ELSE
        RETURN phone;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Now get the user groups
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
        normalize_phone(phone_number) as norm_phone
    FROM users
    WHERE phone_number IS NOT NULL
)
SELECT 
    '📦 Batch SMS Only (Visited batch page, didn''t convert)' as user_group,
    COUNT(DISTINCT nb.phone_number) as count,
    'In result_page_visits only' as identification
FROM normalized_batch nb
WHERE nb.norm_phone NOT IN (SELECT norm_phone FROM normalized_users)

UNION ALL

SELECT 
    '✅ Batch SMS Converts (Clicked "다른 이미지도 찾아보기")',
    COUNT(DISTINCT u.id),
    'In BOTH result_page_visits AND users'
FROM normalized_users u
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)

UNION ALL

SELECT 
    '💼 Colleagues (~7 including you)',
    COUNT(DISTINCT u.id),
    'In users only, NOT in result_page_visits'
FROM normalized_users u
WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)

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
    '~7 colleagues + batch converts'
FROM users;

