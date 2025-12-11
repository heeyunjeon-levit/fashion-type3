-- 🤖 View GPT Product Selection Reasoning
-- This query shows why GPT selected specific product links

-- 1. Latest GPT product selection reasoning
SELECT 
  session_id,
  event_type,
  created_at,
  event_data->'reasoning' as gpt_reasoning,
  event_data->'sourceCounts' as source_counts
FROM events
WHERE event_type = 'gpt_product_selection'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Detailed breakdown of GPT reasoning by category
-- Shows what GPT was looking for and what it selected
SELECT 
  e.session_id,
  e.created_at,
  jsonb_object_keys(e.event_data->'reasoning') as category,
  e.event_data->'reasoning'->jsonb_object_keys(e.event_data->'reasoning')->'itemDescription' as item_description,
  e.event_data->'reasoning'->jsonb_object_keys(e.event_data->'reasoning')->'searchTerms' as search_terms,
  e.event_data->'reasoning'->jsonb_object_keys(e.event_data->'reasoning')->'candidateCount' as candidate_count,
  e.event_data->'reasoning'->jsonb_object_keys(e.event_data->'reasoning')->'selectionCount' as selection_count,
  e.event_data->'reasoning'->jsonb_object_keys(e.event_data->'reasoning')->'selectedLinks' as selected_links
FROM events e
WHERE event_type = 'gpt_product_selection'
ORDER BY e.created_at DESC
LIMIT 10;

-- 3. Compare what user uploaded vs what GPT selected
SELECT 
  s.session_id,
  s.created_at,
  -- User's uploaded image
  s.uploaded_image_url as original_image,
  -- What GPT detected
  jsonb_array_length(s.gpt_analysis->'items') as items_detected_by_gpt,
  -- What user selected
  jsonb_array_length(s.selected_items->'items') as items_selected_by_user,
  -- GPT's product selection reasoning
  s.gpt_selection_reasoning
FROM sessions s
WHERE s.gpt_selection_reasoning IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 5;

-- 4. See which products GPT chose for each item (formatted nicely)
WITH reasoning_data AS (
  SELECT 
    session_id,
    created_at,
    jsonb_each(event_data->'reasoning') as reasoning_pair
  FROM events
  WHERE event_type = 'gpt_product_selection'
)
SELECT 
  session_id,
  created_at,
  reasoning_pair.key as category,
  reasoning_pair.value->>'itemDescription' as what_gpt_looked_for,
  reasoning_pair.value->>'candidateCount' as products_considered,
  reasoning_pair.value->>'selectionCount' as products_selected,
  reasoning_pair.value->'selectedLinks' as selected_products
FROM reasoning_data
ORDER BY created_at DESC
LIMIT 20;

-- 5. Aggregate: See GPT selection success rate
SELECT 
  COUNT(*) as total_searches,
  COUNT(CASE WHEN (event_data->'sourceCounts'->>'gpt')::int > 0 THEN 1 END) as gpt_successful,
  COUNT(CASE WHEN (event_data->'sourceCounts'->>'fallback')::int > 0 THEN 1 END) as used_fallback,
  ROUND(
    100.0 * COUNT(CASE WHEN (event_data->'sourceCounts'->>'gpt')::int > 0 THEN 1 END) / COUNT(*), 
    2
  ) as gpt_success_rate_pct
FROM events
WHERE event_type = 'gpt_product_selection';

-- 6. See full reasoning for most recent search
SELECT 
  session_id,
  created_at,
  jsonb_pretty(event_data->'reasoning') as reasoning_formatted
FROM events
WHERE event_type = 'gpt_product_selection'
ORDER BY created_at DESC
LIMIT 1;

