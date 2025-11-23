-- ============================================================================
-- SECTION 4: KEY INSIGHTS SUMMARY
-- Your most important metrics at a glance!
-- ============================================================================

WITH normalized_batch AS (
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
),
stats AS (
    SELECT 
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits) as batch_sent,
        (SELECT COUNT(DISTINCT u.id) FROM normalized_users u WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)) as batch_converts,
        (SELECT COUNT(DISTINCT u.id) FROM normalized_users u WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)) as colleagues,
        (SELECT COUNT(*) FROM user_feedback uf WHERE normalize_phone(uf.phone_number) IN (SELECT norm_phone FROM normalized_batch)) as batch_feedback,
        (SELECT COUNT(lc.id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)) as batch_convert_clicks,
        (SELECT COUNT(DISTINCT lc.user_id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)) as batch_convert_active,
        (SELECT COUNT(lc.id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)) as colleague_clicks,
        (SELECT COUNT(DISTINCT lc.user_id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)) as colleague_active
)
SELECT 
    '🎯 KEY INSIGHTS' as metric,
    NULL as value

UNION ALL

SELECT 
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    NULL

UNION ALL

SELECT 
    '📱 Batch SMS Sent',
    batch_sent::text || ' unique phones'
FROM stats

UNION ALL

SELECT 
    '✅ Conversion Rate (SMS → Main App)',
    ROUND(batch_converts * 100.0 / batch_sent, 1)::text || '% (' || batch_converts || '/' || batch_sent || ')'
FROM stats

UNION ALL

SELECT 
    '💬 Batch Feedback Rate',
    ROUND(batch_feedback * 100.0 / batch_sent, 1)::text || '% (' || batch_feedback || '/' || batch_sent || ')'
FROM stats

UNION ALL

SELECT 
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    NULL

UNION ALL

SELECT 
    '🔥 Batch Converts: Engagement',
    ROUND(batch_convert_active * 100.0 / NULLIF(batch_converts, 0), 1)::text || '% active (' || batch_convert_clicks || ' clicks from ' || batch_convert_active || ' users)'
FROM stats

UNION ALL

SELECT 
    '💼 Colleagues: Engagement',
    ROUND(colleague_active * 100.0 / NULLIF(colleagues, 0), 1)::text || '% active (' || colleague_clicks || ' clicks from ' || colleague_active || ' users)'
FROM stats

UNION ALL

SELECT 
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    NULL

UNION ALL

SELECT 
    '🏆 Winner: Engagement',
    CASE 
        WHEN batch_convert_active::numeric / NULLIF(batch_converts, 0) > colleague_active::numeric / NULLIF(colleagues, 0) 
        THEN '✅ Batch Converts engage more!'
        ELSE '✅ Colleagues engage more!'
    END
FROM stats;






