-- ============================================================================
-- DIAGNOSE: Where did the 9 "organic" users come from?
-- ============================================================================

-- Check if these 9 users are in result_page_visits
SELECT 
    '🔍 Are "organic" users in batch SMS?' as check_type,
    u.phone_number,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM result_page_visits rpv 
            WHERE normalize_phone(rpv.phone_number) = normalize_phone(u.phone_number)
        ) THEN '✅ YES - in batch SMS (should be batch_interview)'
        ELSE '❌ NO - truly organic (never got batch link)'
    END as in_batch,
    u.conversion_source as current_label
FROM users u
WHERE u.conversion_source = 'organic'
ORDER BY u.phone_number;


-- ============================================================================
-- Show ALL batch SMS recipients who joined the app
-- ============================================================================

SELECT 
    '📊 All Batch → App Conversions' as analysis,
    normalize_phone(rpv.phone_number) as batch_phone,
    u.phone_number as app_phone,
    u.conversion_source
FROM result_page_visits rpv
LEFT JOIN users u ON normalize_phone(rpv.phone_number) = normalize_phone(u.phone_number)
WHERE u.id IS NOT NULL  -- Only those who joined the app
ORDER BY u.conversion_source, u.phone_number;


