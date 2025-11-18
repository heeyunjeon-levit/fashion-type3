-- ============================================================================
-- 📊 BUSINESS INSIGHTS DASHBOARD
-- Meaningful metrics for decision-making (scales as your user base grows!)
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
metrics AS (
    SELECT 
        -- Batch SMS Metrics
        (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits) as batch_links_visited,
        116 as batch_sms_sent,
        
        -- Conversion Metrics
        (SELECT COUNT(DISTINCT u.id) FROM normalized_users u WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)) as batch_converts,
        
        -- Engagement Metrics
        (SELECT COUNT(*) FROM user_feedback uf WHERE normalize_phone(uf.phone_number) IN (SELECT norm_phone FROM normalized_batch)) as batch_feedback_count,
        (SELECT COUNT(DISTINCT uf.phone_number) FROM user_feedback uf WHERE normalize_phone(uf.phone_number) IN (SELECT norm_phone FROM normalized_batch)) as batch_feedback_unique,
        
        -- User Activity Metrics
        (SELECT COUNT(DISTINCT u.id) FROM normalized_users u WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)) as colleagues_count,
        
        -- Click Metrics
        (SELECT COUNT(*) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)) as batch_convert_clicks,
        (SELECT COUNT(DISTINCT lc.user_id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)) as batch_convert_active_users,
        (SELECT COUNT(*) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)) as colleague_clicks,
        (SELECT COUNT(DISTINCT lc.user_id) FROM link_clicks lc JOIN normalized_users u ON lc.user_id::text = u.id::text WHERE u.norm_phone NOT IN (SELECT norm_phone FROM normalized_batch)) as colleague_active_users
)
SELECT 
    '═══════════════════════════════════════════════════' as section,
    NULL as metric,
    NULL as value,
    NULL as insight

UNION ALL SELECT '🎯 BATCH SMS CAMPAIGN PERFORMANCE', NULL, NULL, NULL

UNION ALL SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL

SELECT 
    '',
    '📱 SMS Sent',
    batch_sms_sent::text,
    'Total batch links created'
FROM metrics

UNION ALL

SELECT 
    '',
    '👁️ Links Opened',
    batch_links_visited::text || ' (' || ROUND(batch_links_visited * 100.0 / batch_sms_sent, 1)::text || '%)',
    CASE 
        WHEN batch_links_visited * 100.0 / batch_sms_sent >= 70 THEN '✅ Great open rate!'
        WHEN batch_links_visited * 100.0 / batch_sms_sent >= 50 THEN '👍 Good open rate'
        WHEN batch_links_visited * 100.0 / batch_sms_sent >= 30 THEN '⚠️ Decent open rate'
        ELSE '❌ Low open rate - check SMS copy/timing'
    END
FROM metrics

UNION ALL

SELECT 
    '',
    '💬 Feedback Submitted',
    batch_feedback_unique::text || ' (' || ROUND(batch_feedback_unique * 100.0 / batch_links_visited, 1)::text || '%)',
    CASE 
        WHEN batch_feedback_unique * 100.0 / batch_links_visited >= 40 THEN '🎉 AMAZING engagement! Users care about results'
        WHEN batch_feedback_unique * 100.0 / batch_links_visited >= 20 THEN '✅ Strong engagement'
        WHEN batch_feedback_unique * 100.0 / batch_links_visited >= 10 THEN '👍 Moderate engagement'
        ELSE '⚠️ Low engagement - improve result quality?'
    END
FROM metrics

UNION ALL

SELECT 
    '',
    '✅ Converted to Main App',
    batch_converts::text || ' (' || ROUND(batch_converts * 100.0 / batch_links_visited, 1)::text || '%)',
    CASE 
        WHEN batch_converts * 100.0 / batch_links_visited >= 5 THEN '🚀 Excellent conversion!'
        WHEN batch_converts * 100.0 / batch_links_visited >= 2 THEN '✅ Good conversion rate'
        WHEN batch_converts * 100.0 / batch_links_visited >= 1 THEN '👍 Early success - optimize to grow'
        ELSE '⚠️ Need to improve call-to-action'
    END
FROM metrics

UNION ALL

SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL SELECT '🔥 USER ENGAGEMENT BREAKDOWN', NULL, NULL, NULL

UNION ALL SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL

SELECT 
    '',
    '📊 Batch Converts',
    batch_converts::text || ' users',
    batch_convert_clicks::text || ' product clicks (' || batch_convert_active_users::text || ' active users)'
FROM metrics

UNION ALL

SELECT 
    '',
    '💼 Colleagues',
    colleagues_count::text || ' users',
    colleague_clicks::text || ' product clicks (' || colleague_active_users::text || ' active users)'
FROM metrics

UNION ALL

SELECT 
    '',
    '🎯 Batch Convert Activity',
    CASE 
        WHEN batch_converts > 0 
        THEN ROUND(batch_convert_clicks::numeric / batch_converts, 1)::text || ' clicks/user avg'
        ELSE 'N/A (no converts yet)'
    END,
    CASE 
        WHEN batch_converts >= 5 THEN 'Sample size good for analysis ✅'
        WHEN batch_converts >= 2 THEN 'Getting there - need more data'
        WHEN batch_converts = 1 THEN '⚠️ Only 1 convert - too early to compare'
        ELSE '⚠️ No converts yet'
    END
FROM metrics

UNION ALL

SELECT 
    '',
    '🎯 Colleague Activity',
    ROUND(colleague_clicks::numeric / NULLIF(colleagues_count, 0), 1)::text || ' clicks/user avg',
    CASE 
        WHEN colleague_active_users * 100.0 / NULLIF(colleagues_count, 0) >= 70 THEN '🔥 Highly engaged team!'
        WHEN colleague_active_users * 100.0 / NULLIF(colleagues_count, 0) >= 50 THEN '✅ Good engagement'
        ELSE '⚠️ Need more colleague testing'
    END
FROM metrics

UNION ALL

SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL SELECT '💡 KEY TAKEAWAYS', NULL, NULL, NULL

UNION ALL SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL

SELECT 
    '',
    '🎯 Conversion Strategy',
    'SMS → Main App: ' || ROUND(batch_converts * 100.0 / batch_links_visited, 1)::text || '%',
    CASE 
        WHEN batch_converts >= 5 THEN '✅ Funnel validated - scale up SMS campaign!'
        WHEN batch_converts >= 1 THEN '✅ Funnel works! Optimize & scale gradually'
        ELSE '⚠️ Need first convert to validate funnel'
    END
FROM metrics

UNION ALL

SELECT 
    '',
    '📈 Growth Opportunity',
    (batch_sms_sent - batch_links_visited)::text || ' users haven''t opened links yet',
    CASE 
        WHEN (batch_sms_sent - batch_links_visited) > 50 
        THEN '💡 Consider follow-up SMS or improved messaging'
        WHEN (batch_sms_sent - batch_links_visited) > 20 
        THEN '👍 Reasonable drop-off rate'
        ELSE '✅ Great open rate!'
    END
FROM metrics

UNION ALL

SELECT 
    '',
    '💬 Feedback Quality',
    batch_feedback_count::text || ' total responses',
    CASE 
        WHEN batch_feedback_count > batch_feedback_unique * 1.5 
        THEN '⚠️ Some users gave multiple feedbacks - check for issues'
        WHEN batch_feedback_count = batch_feedback_unique 
        THEN '✅ One feedback per user - clean data'
        ELSE '✅ Good feedback collection'
    END
FROM metrics

UNION ALL

SELECT 
    '',
    '🔍 Next Steps',
    NULL,
    CASE 
        WHEN batch_converts = 0 THEN '1. Analyze why no converts yet 2. A/B test CTA button 3. Improve result quality'
        WHEN batch_converts = 1 THEN '1. Get 4-5 more converts 2. Interview convert to learn why they joined 3. Optimize based on feedback'
        WHEN batch_converts < 5 THEN '1. Scale SMS campaign 2. Track which result types convert best 3. Optimize for conversion'
        ELSE '1. Segment converts by result quality 2. Optimize for active users 3. Scale campaign aggressively'
    END
FROM metrics

UNION ALL

SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL SELECT '📊 STATISTICAL NOTE', NULL, NULL, NULL

UNION ALL SELECT '═══════════════════════════════════════════════════', NULL, NULL, NULL

UNION ALL

SELECT 
    '',
    '⚠️ Sample Size Warning',
    'Batch Converts: ' || batch_converts::text || ' users',
    CASE 
        WHEN batch_converts >= 30 THEN '✅ Statistically significant - trust the data!'
        WHEN batch_converts >= 10 THEN '👍 Reasonable sample - trends are reliable'
        WHEN batch_converts >= 5 THEN '⚠️ Small sample - look for trends, not absolutes'
        WHEN batch_converts >= 2 THEN '⚠️ Very small sample - early indicators only'
        WHEN batch_converts = 1 THEN '⚠️ Single convert - proves funnel works, but NO comparison stats yet'
        ELSE '❌ No converts - focus on getting first one!'
    END
FROM metrics

UNION ALL

SELECT 
    '',
    '📈 When to Compare Groups',
    'Need ' || GREATEST(0, 5 - batch_converts)::text || ' more converts',
    CASE 
        WHEN batch_converts >= 5 THEN '✅ Can start meaningful comparisons with colleagues!'
        WHEN batch_converts >= 2 THEN '🔜 Almost there - 2-3 more converts needed'
        WHEN batch_converts = 1 THEN '🔜 Need 4 more converts for group comparisons'
        ELSE '🔜 Get first convert, then we can talk stats!'
    END
FROM metrics;

