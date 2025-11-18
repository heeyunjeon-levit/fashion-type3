-- 📊 View Fallback Tracking for All Recent Users
-- Run this in Supabase SQL Editor after the deployment is live

-- 1. See all final_results_displayed events (newest first)
SELECT 
  id,
  session_id,
  created_at,
  event_data->'summary'->>'totalProducts' as total_products,
  event_data->'summary'->>'gptProducts' as gpt_products,
  event_data->'summary'->>'fallbackProducts' as fallback_products,
  event_data->'summary'->>'categoriesWithFallback' as categories_with_fallback
FROM events
WHERE event_type = 'final_results_displayed'
ORDER BY created_at DESC
LIMIT 10;


-- 2. Compare GPT selection vs Final displayed for recent searches
WITH recent_searches AS (
  SELECT 
    session_id,
    created_at,
    event_type,
    CASE 
      WHEN event_type = 'gpt_product_selection' THEN
        jsonb_object_keys(event_data->'reasoning')
      WHEN event_type = 'final_results_displayed' THEN
        jsonb_object_keys(event_data->'displayedProducts')
    END as category,
    CASE 
      WHEN event_type = 'gpt_product_selection' THEN
        jsonb_array_length(event_data->'reasoning'->jsonb_object_keys(event_data->'reasoning')->'selectedLinks')
      WHEN event_type = 'final_results_displayed' THEN
        (event_data->'displayedProducts'->jsonb_object_keys(event_data->'displayedProducts')->>'count')::int
    END as product_count,
    CASE 
      WHEN event_type = 'final_results_displayed' THEN
        event_data->'displayedProducts'->jsonb_object_keys(event_data->'displayedProducts')->>'source'
      ELSE 'gpt'
    END as source
  FROM events
  WHERE event_type IN ('gpt_product_selection', 'final_results_displayed')
    AND created_at > NOW() - INTERVAL '1 day'
)
SELECT * FROM recent_searches
ORDER BY session_id, created_at;


-- 3. Find users who saw fallback products
SELECT DISTINCT
  session_id,
  created_at,
  event_data->'summary'->>'fallbackProducts' as fallback_count
FROM events
WHERE event_type = 'final_results_displayed'
  AND (event_data->'summary'->>'fallbackProducts')::int > 0
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;


-- 4. Fallback usage rate
SELECT 
  COUNT(*) as total_searches,
  SUM(CASE WHEN (event_data->'summary'->>'fallbackProducts')::int > 0 THEN 1 ELSE 0 END) as searches_with_fallback,
  ROUND(
    100.0 * SUM(CASE WHEN (event_data->'summary'->>'fallbackProducts')::int > 0 THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as fallback_usage_pct
FROM events
WHERE event_type = 'final_results_displayed'
  AND created_at > NOW() - INTERVAL '7 days';


-- 5. View specific user's fallback history (replace phone number)
WITH user_sessions AS (
  SELECT id, phone_number
  FROM users
  WHERE phone_number = '01048545690'
)
SELECT 
  e.created_at,
  e.event_data->'summary'->>'totalProducts' as total,
  e.event_data->'summary'->>'gptProducts' as gpt,
  e.event_data->'summary'->>'fallbackProducts' as fallback,
  e.event_data->'displayedProducts' as products_breakdown
FROM events e
JOIN user_sessions u ON e.session_id = u.id::text
WHERE e.event_type = 'final_results_displayed'
ORDER BY e.created_at DESC;


-- 6. Category-level fallback analysis
WITH category_data AS (
  SELECT 
    jsonb_object_keys(event_data->'displayedProducts') as category,
    event_data->'displayedProducts'->jsonb_object_keys(event_data->'displayedProducts')->>'source' as source,
    (event_data->'displayedProducts'->jsonb_object_keys(event_data->'displayedProducts')->>'count')::int as count
  FROM events
  WHERE event_type = 'final_results_displayed'
    AND created_at > NOW() - INTERVAL '7 days'
)
SELECT 
  category,
  source,
  COUNT(*) as occurrences,
  SUM(count) as total_products
FROM category_data
GROUP BY category, source
ORDER BY category, source;


-- 7. Fallback click-through rate (are users clicking fallback products?)
WITH fallback_categories AS (
  SELECT 
    e.session_id,
    jsonb_object_keys(e.event_data->'displayedProducts') as category,
    e.event_data->'displayedProducts'->jsonb_object_keys(e.event_data->'displayedProducts')->>'source' as source
  FROM events e
  WHERE e.event_type = 'final_results_displayed'
    AND e.created_at > NOW() - INTERVAL '7 days'
),
clicks AS (
  SELECT 
    user_id,
    item_category
  FROM link_clicks
  WHERE clicked_at > NOW() - INTERVAL '7 days'
)
SELECT 
  fc.category,
  fc.source,
  COUNT(DISTINCT fc.session_id) as times_shown,
  COUNT(DISTINCT c.user_id) as times_clicked,
  ROUND(100.0 * COUNT(DISTINCT c.user_id) / COUNT(DISTINCT fc.session_id), 2) as ctr_pct
FROM fallback_categories fc
LEFT JOIN clicks c ON fc.session_id = c.user_id::text AND fc.category = c.item_category
GROUP BY fc.category, fc.source
HAVING COUNT(DISTINCT fc.session_id) > 0
ORDER BY fc.category, fc.source;


-- 8. Most recent final_results_displayed with full details (pretty print)
SELECT 
  created_at,
  jsonb_pretty(event_data) as full_event_data
FROM events
WHERE event_type = 'final_results_displayed'
ORDER BY created_at DESC
LIMIT 1;


