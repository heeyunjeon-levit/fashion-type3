-- ⏱️  View Pipeline Timing Performance
-- This query shows how long each stage of the pipeline takes

-- 1. Latest pipeline timing (backend + search API)
SELECT 
  session_id,
  event_type,
  created_at,
  event_data
FROM events
WHERE event_type IN ('pipeline_timing', 'backend_timing')
ORDER BY created_at DESC
LIMIT 10;

-- 2. Complete timing view (backend + search API for same session)
SELECT 
  e1.session_id,
  e1.created_at,
  'Backend (GPT-4o + GroundingDINO)' as stage,
  (e1.event_data->>'gpt4o_seconds')::float as gpt4o_seconds,
  (e1.event_data->>'groundingdino_seconds')::float as groundingdino_seconds,
  (e1.event_data->>'total_seconds')::float as backend_total_seconds,
  NULL::float as serper_seconds,
  NULL::float as gpt4_turbo_seconds,
  NULL::float as search_total_seconds
FROM events e1
WHERE e1.event_type = 'backend_timing'
UNION ALL
SELECT 
  e2.session_id,
  e2.created_at,
  'Search API (Serper + GPT-4 Turbo)' as stage,
  NULL as gpt4o_seconds,
  NULL as groundingdino_seconds,
  NULL as backend_total_seconds,
  (e2.event_data->>'serper_seconds')::float as serper_seconds,
  (e2.event_data->>'gpt4_turbo_seconds')::float as gpt4_turbo_seconds,
  (e2.event_data->>'total_seconds')::float as search_total_seconds
FROM events e2
WHERE e2.event_type = 'pipeline_timing'
ORDER BY created_at DESC, session_id
LIMIT 20;

-- 2. Average timing by stage (last 50 searches)
WITH recent_timing AS (
  SELECT 
    (event_data->>'serper_seconds')::float as serper_seconds,
    (event_data->>'serper_count')::int as serper_count,
    (event_data->>'gpt4_turbo_seconds')::float as gpt4_turbo_seconds,
    (event_data->>'gpt4_turbo_count')::int as gpt4_turbo_count,
    (event_data->>'total_seconds')::float as total_seconds
  FROM events
  WHERE event_type = 'pipeline_timing'
  ORDER BY created_at DESC
  LIMIT 50
)
SELECT 
  ROUND(AVG(serper_seconds)::numeric, 2) as avg_serper_seconds,
  ROUND(AVG(serper_count)::numeric, 1) as avg_serper_calls,
  ROUND(AVG(gpt4_turbo_seconds)::numeric, 2) as avg_gpt4_turbo_seconds,
  ROUND(AVG(gpt4_turbo_count)::numeric, 1) as avg_gpt4_turbo_calls,
  ROUND(AVG(total_seconds)::numeric, 2) as avg_total_seconds,
  COUNT(*) as sample_size
FROM recent_timing;

-- 3. Timing breakdown (percentages)
WITH recent_timing AS (
  SELECT 
    (event_data->>'serper_seconds')::float as serper_seconds,
    (event_data->>'gpt4_turbo_seconds')::float as gpt4_turbo_seconds,
    (event_data->>'total_seconds')::float as total_seconds
  FROM events
  WHERE event_type = 'pipeline_timing'
  ORDER BY created_at DESC
  LIMIT 50
)
SELECT 
  ROUND(AVG(serper_seconds)::numeric, 2) as avg_serper_seconds,
  ROUND((AVG(serper_seconds) / NULLIF(AVG(total_seconds), 0) * 100)::numeric, 1) as serper_percent,
  ROUND(AVG(gpt4_turbo_seconds)::numeric, 2) as avg_gpt4_turbo_seconds,
  ROUND((AVG(gpt4_turbo_seconds) / NULLIF(AVG(total_seconds), 0) * 100)::numeric, 1) as gpt4_turbo_percent,
  ROUND((AVG(total_seconds) - AVG(serper_seconds) - AVG(gpt4_turbo_seconds))::numeric, 2) as avg_other_seconds,
  ROUND(((AVG(total_seconds) - AVG(serper_seconds) - AVG(gpt4_turbo_seconds)) / NULLIF(AVG(total_seconds), 0) * 100)::numeric, 1) as other_percent,
  ROUND(AVG(total_seconds)::numeric, 2) as avg_total_seconds
FROM recent_timing;

-- 4. Find slowest searches
SELECT 
  e.session_id,
  e.created_at,
  (e.event_data->>'total_seconds')::float as total_seconds,
  (e.event_data->>'serper_seconds')::float as serper_seconds,
  (e.event_data->>'gpt4_turbo_seconds')::float as gpt4_turbo_seconds,
  (e.event_data->>'serper_count')::int as serper_calls,
  (e.event_data->>'gpt4_turbo_count')::int as gpt4_turbo_calls
FROM events e
WHERE event_type = 'pipeline_timing'
ORDER BY (e.event_data->>'total_seconds')::float DESC
LIMIT 10;

-- 5. Find fastest searches
SELECT 
  e.session_id,
  e.created_at,
  (e.event_data->>'total_seconds')::float as total_seconds,
  (e.event_data->>'serper_seconds')::float as serper_seconds,
  (e.event_data->>'gpt4_turbo_seconds')::float as gpt4_turbo_seconds,
  (e.event_data->>'serper_count')::int as serper_calls,
  (e.event_data->>'gpt4_turbo_count')::int as gpt4_turbo_calls
FROM events e
WHERE event_type = 'pipeline_timing'
ORDER BY (e.event_data->>'total_seconds')::float ASC
LIMIT 10;

-- 6. Timing trends over time (by hour)
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as search_count,
  ROUND(AVG((event_data->>'total_seconds')::float)::numeric, 2) as avg_total_seconds,
  ROUND(AVG((event_data->>'serper_seconds')::float)::numeric, 2) as avg_serper_seconds,
  ROUND(AVG((event_data->>'gpt4_turbo_seconds')::float)::numeric, 2) as avg_gpt4_turbo_seconds,
  ROUND(MIN((event_data->>'total_seconds')::float)::numeric, 2) as min_total_seconds,
  ROUND(MAX((event_data->>'total_seconds')::float)::numeric, 2) as max_total_seconds
FROM events
WHERE event_type = 'pipeline_timing'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- 7. Performance by number of API calls
SELECT 
  (event_data->>'serper_count')::int as serper_calls,
  (event_data->>'gpt4_turbo_count')::int as gpt4_turbo_calls,
  COUNT(*) as search_count,
  ROUND(AVG((event_data->>'total_seconds')::float)::numeric, 2) as avg_total_seconds,
  ROUND(MIN((event_data->>'total_seconds')::float)::numeric, 2) as min_total_seconds,
  ROUND(MAX((event_data->>'total_seconds')::float)::numeric, 2) as max_total_seconds
FROM events
WHERE event_type = 'pipeline_timing'
GROUP BY serper_calls, gpt4_turbo_calls
ORDER BY serper_calls, gpt4_turbo_calls;

-- 8. Complete end-to-end timing (backend + search API combined)
WITH backend_timing AS (
  SELECT 
    session_id,
    (event_data->>'gpt4o_seconds')::float as gpt4o_seconds,
    (event_data->>'groundingdino_seconds')::float as groundingdino_seconds,
    (event_data->>'total_seconds')::float as backend_total,
    created_at
  FROM events
  WHERE event_type = 'backend_timing'
),
search_timing AS (
  SELECT 
    session_id,
    (event_data->>'serper_seconds')::float as serper_seconds,
    (event_data->>'gpt4_turbo_seconds')::float as gpt4_turbo_seconds,
    (event_data->>'total_seconds')::float as search_total,
    created_at
  FROM events
  WHERE event_type = 'pipeline_timing'
)
SELECT 
  COALESCE(b.session_id, s.session_id) as session_id,
  COALESCE(b.created_at, s.created_at) as created_at,
  ROUND(COALESCE(b.gpt4o_seconds, 0)::numeric, 2) as gpt4o_seconds,
  ROUND(COALESCE(b.groundingdino_seconds, 0)::numeric, 3) as groundingdino_seconds,
  ROUND(COALESCE(b.backend_total, 0)::numeric, 2) as backend_total,
  ROUND(COALESCE(s.serper_seconds, 0)::numeric, 2) as serper_seconds,
  ROUND(COALESCE(s.gpt4_turbo_seconds, 0)::numeric, 2) as gpt4_turbo_seconds,
  ROUND(COALESCE(s.search_total, 0)::numeric, 2) as search_total,
  ROUND((COALESCE(b.backend_total, 0) + COALESCE(s.search_total, 0))::numeric, 2) as end_to_end_total
FROM backend_timing b
FULL OUTER JOIN search_timing s ON b.session_id = s.session_id
ORDER BY COALESCE(b.created_at, s.created_at) DESC
LIMIT 10;

