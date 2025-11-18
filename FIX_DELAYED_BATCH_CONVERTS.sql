-- ============================================================================
-- FIX: Reclassify delayed batch converts as batch_interview
-- DATA-DRIVEN: Check if "organic" users are actually in batch SMS list
-- ============================================================================

-- STEP 1: Show what will be updated (preview)
SELECT 
    '🔍 PREVIEW: Which "organic" users are in batch SMS?' as check_type,
    u.phone_number,
    CASE 
        WHEN normalize_phone(u.phone_number) IN (
            SELECT normalize_phone(phone_number) FROM result_page_visits
        ) THEN '✅ IN BATCH SMS → will become batch_interview'
        ELSE '❌ NOT IN BATCH → stays organic'
    END as action
FROM users u
WHERE u.conversion_source = 'organic';

-- STEP 2: Update ONLY those "organic" users who are in result_page_visits
-- (meaning they got batch SMS but tracking broke due to time delay)
UPDATE users 
SET conversion_source = 'batch_interview'
WHERE conversion_source = 'organic'
  AND normalize_phone(phone_number) IN (
      SELECT normalize_phone(phone_number) 
      FROM result_page_visits
  );

-- Any users who stay as 'organic' are truly organic (never got batch SMS)

-- Verify the fix
SELECT 
    '✅ CORRECTED USER BREAKDOWN' as section,
    conversion_source,
    COUNT(*) as count,
    ARRAY_AGG(phone_number ORDER BY phone_number) as phone_numbers
FROM users
GROUP BY conversion_source
ORDER BY 
    CASE conversion_source
        WHEN 'colleague' THEN 1
        WHEN 'batch_interview' THEN 2
        WHEN 'batch_button_click' THEN 3
        WHEN 'direct_interview' THEN 4
        WHEN 'organic' THEN 5
    END;


-- ============================================================================
-- Show your REAL metrics
-- ============================================================================

WITH metrics AS (
    SELECT 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits) as batch_visited,
        (SELECT COUNT(*) FROM users WHERE conversion_source = 'batch_interview') as batch_converts,
        (SELECT COUNT(*) FROM users WHERE conversion_source = 'colleague') as colleagues
)
SELECT 
    '📊 BATCH SMS CAMPAIGN RESULTS' as metric,
    NULL as value

UNION ALL

SELECT 
    '📱 Links Visited',
    batch_visited::text
FROM metrics

UNION ALL

SELECT 
    '🎤 Converted After Interview',
    batch_converts::text || ' (' || ROUND(batch_converts * 100.0 / batch_visited, 1)::text || '%)'
FROM metrics

UNION ALL

SELECT 
    '💼 Colleagues (Internal)',
    colleagues::text
FROM metrics

UNION ALL

SELECT 
    '✅ Total Main App Users',
    (batch_converts + colleagues)::text
FROM metrics;

