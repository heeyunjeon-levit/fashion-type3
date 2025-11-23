-- ============================================================================
-- YOUR REAL ACTIVITY (Even without sessions!)
-- User: 01090848563
-- User ID: fc878118-43dd-4363-93cf-d31e453df81e
-- ============================================================================

-- 1. YOUR STATS
-- ============================================================================
SELECT 
    'Total Searches (from users table)' as metric,
    '57' as value
    
UNION ALL

SELECT 
    'Product Clicks Tracked',
    COUNT(*)::text
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'

UNION ALL

SELECT 
    'First Click',
    TO_CHAR(MIN(clicked_at), 'YYYY-MM-DD HH24:MI')
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'

UNION ALL

SELECT 
    'Latest Click',
    TO_CHAR(MAX(clicked_at), 'YYYY-MM-DD HH24:MI')
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'

UNION ALL

SELECT 
    'Days Active',
    EXTRACT(DAY FROM (MAX(clicked_at) - MIN(clicked_at)))::text || ' days'
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e';


-- 2. ALL YOUR CLICKS (COMPLETE HISTORY)
-- ============================================================================
SELECT 
    clicked_at,
    item_category,
    product_title,
    link_position
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
ORDER BY clicked_at DESC;


-- 3. YOUR FAVORITE CATEGORIES
-- ============================================================================
SELECT 
    item_category as category,
    COUNT(*) as clicks,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM link_clicks WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'), 1) as percentage
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
GROUP BY item_category
ORDER BY clicks DESC;


-- 4. ACTIVITY BY DAY
-- ============================================================================
SELECT 
    DATE(clicked_at) as date,
    COUNT(*) as clicks,
    COUNT(DISTINCT item_category) as categories
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
GROUP BY DATE(clicked_at)
ORDER BY date DESC;


-- 5. MOST CLICKED PRODUCTS
-- ============================================================================
SELECT 
    item_category,
    product_title,
    COUNT(*) as times_clicked,
    MAX(clicked_at) as last_clicked
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
  AND product_title IS NOT NULL
GROUP BY item_category, product_title
ORDER BY times_clicked DESC, last_clicked DESC
LIMIT 20;


-- 6. HOURLY ACTIVITY PATTERN
-- ============================================================================
SELECT 
    EXTRACT(HOUR FROM clicked_at) as hour_of_day,
    COUNT(*) as clicks
FROM link_clicks
WHERE user_id = 'fc878118-43dd-4363-93cf-d31e453df81e'
GROUP BY EXTRACT(HOUR FROM clicked_at)
ORDER BY hour_of_day;






