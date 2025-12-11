-- ============================================================================
-- STEP 1: PREVIEW - Which "organic" users are in batch SMS?
-- Run this FIRST to see what will change
-- ============================================================================

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
WHERE u.conversion_source = 'organic'
ORDER BY u.phone_number;

-- Summary count
SELECT 
    '📊 SUMMARY' as type,
    COUNT(*) FILTER (WHERE normalize_phone(phone_number) IN (
        SELECT normalize_phone(phone_number) FROM result_page_visits
    )) as in_batch_sms,
    COUNT(*) FILTER (WHERE normalize_phone(phone_number) NOT IN (
        SELECT normalize_phone(phone_number) FROM result_page_visits
    )) as truly_organic,
    COUNT(*) as total_organic_now
FROM users
WHERE conversion_source = 'organic';







