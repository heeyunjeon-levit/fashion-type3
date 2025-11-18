-- ============================================================================
-- SECTION 3: DETAILED LIST OF ALL BATCH CONVERTS
-- This will show user 01048545690 and all others who converted!
-- ============================================================================

WITH normalized_batch AS (
    SELECT 
        phone_number,
        normalize_phone(phone_number) as norm_phone,
        COUNT(*) as visits,
        SUM(time_on_page_seconds) as total_time
    FROM result_page_visits
    GROUP BY phone_number, normalize_phone(phone_number)
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
    '✅ Batch SMS Converts' as group_name,
    u.phone_number,
    COALESCE(nb.visits, 0) as batch_visits,
    COALESCE(nb.total_time, 0) as time_on_batch,
    COALESCE(lc.clicks, 0) as product_clicks_in_main_app,
    CASE WHEN COALESCE(lc.clicks, 0) > 0 THEN '✅ Active' ELSE '⏸️ Not clicking yet' END as engagement_status
FROM normalized_users u
LEFT JOIN normalized_batch nb ON u.norm_phone = nb.norm_phone
LEFT JOIN (
    SELECT user_id, COUNT(*) as clicks
    FROM link_clicks
    GROUP BY user_id
) lc ON u.id::text = lc.user_id::text
WHERE u.norm_phone IN (SELECT norm_phone FROM normalized_batch)
ORDER BY COALESCE(lc.clicks, 0) DESC, u.phone_number;

