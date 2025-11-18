-- ============================================================================
-- STEP 3: FINAL BREAKDOWN - See your corrected user segmentation
-- Run this AFTER Step 2
-- ============================================================================

-- Show corrected user breakdown
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
-- Show your REAL batch SMS campaign metrics
-- ============================================================================

WITH metrics AS (
    SELECT 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits) as batch_visited,
        (SELECT COUNT(*) FROM users WHERE conversion_source = 'batch_interview') as batch_converts,
        (SELECT COUNT(*) FROM users WHERE conversion_source = 'colleague') as colleagues,
        (SELECT COUNT(*) FROM users WHERE conversion_source = 'organic') as organic
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
    '🌱 Organic Signups (Not from batch)',
    organic::text
FROM metrics

UNION ALL

SELECT 
    '✅ Total Main App Users',
    (batch_converts + colleagues + organic)::text
FROM metrics;


