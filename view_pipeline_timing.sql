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
-- Backend fields in chronological order
SELECT 
  e1.session_id,
  e1.created_at,
  'Backend (GPT-4o + GroundingDINO)' as stage,
  (e1.event_data->>'download_seconds')::float as download_seconds,
  (e1.event_data->>'gpt4o_seconds')::float as gpt4o_seconds,
  (e1.event_data->>'groundingdino_seconds')::float as groundingdino_seconds,
  (e1.event_data->>'processing_seconds')::float as processing_seconds,
  (e1.event_data->>'upload_seconds')::float as upload_seconds,
  (e1.event_data->>'overhead_seconds')::float as overhead_seconds,
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
  NULL as download_seconds,
  NULL as processing_seconds,
  NULL as upload_seconds,
  NULL as overhead_seconds,
  NULL as backend_total_seconds,
  (e2.event_data->>'serper_seconds')::float as serper_seconds,
  (e2.event_data->>'gpt4_turbo_seconds')::float as gpt4_turbo_seconds,
  (e2.event_data->>'total_seconds')::float as search_total_seconds
FROM events e2
WHERE e2.event_type = 'pipeline_timing'
ORDER BY created_at DESC, session_id
LIMIT 20;

-- 3. Average timing by stage (last 50 searches)
WITH recent_timing AS (
  SELECT 
    (event_data->>'wall_clock_seconds')::float as wall_clock_seconds,
    (event_data->>'serper_api_time_seconds')::float as serper_api_time_seconds,
    (event_data->>'serper_count')::int as serper_count,
    (event_data->>'gpt4_turbo_api_time_seconds')::float as gpt4_turbo_api_time_seconds,
    (event_data->>'gpt4_turbo_count')::int as gpt4_turbo_count,
    (event_data->>'total_seconds')::float as total_seconds,
    (event_data->>'categories_parallel')::int as categories_parallel
  FROM events
  WHERE event_type = 'pipeline_timing'
  ORDER BY created_at DESC
  LIMIT 50
)
SELECT 
  ROUND(AVG(wall_clock_seconds)::numeric, 2) as avg_wall_clock_seconds,
  ROUND(AVG(serper_api_time_seconds)::numeric, 2) as avg_serper_accumulated_seconds,
  ROUND(AVG(serper_count)::numeric, 1) as avg_categories_searched,
  ROUND(AVG(gpt4_turbo_api_time_seconds)::numeric, 2) as avg_gpt4_turbo_accumulated_seconds,
  ROUND(AVG(gpt4_turbo_count)::numeric, 1) as avg_gpt4_turbo_calls,
  ROUND(AVG(total_seconds)::numeric, 2) as avg_total_seconds,
  ROUND(AVG(categories_parallel)::numeric, 1) as avg_categories_parallel,
  COUNT(*) as sample_size
FROM recent_timing;

-- 4. Timing breakdown (what takes the most time)
WITH recent_timing AS (
  SELECT 
    (event_data->>'wall_clock_seconds')::float as wall_clock_seconds,
    (event_data->>'serper_api_time_seconds')::float as serper_api_time_seconds,
    (event_data->>'gpt4_turbo_api_time_seconds')::float as gpt4_turbo_api_time_seconds,
    (event_data->>'total_seconds')::float as total_seconds
  FROM events
  WHERE event_type = 'pipeline_timing'
  ORDER BY created_at DESC
  LIMIT 50
)
SELECT 
  ROUND(AVG(wall_clock_seconds)::numeric, 2) as avg_wall_clock_seconds,
  ROUND(AVG(serper_api_time_seconds)::numeric, 2) as avg_serper_api_time,
  ROUND((AVG(serper_api_time_seconds) / NULLIF(AVG(wall_clock_seconds), 0) * 100)::numeric, 1) as serper_efficiency_pct,
  ROUND(AVG(gpt4_turbo_api_time_seconds)::numeric, 2) as avg_gpt4_turbo_api_time,
  ROUND((AVG(gpt4_turbo_api_time_seconds) / NULLIF(AVG(wall_clock_seconds), 0) * 100)::numeric, 1) as gpt4_turbo_efficiency_pct,
  ROUND(AVG(total_seconds)::numeric, 2) as avg_total_seconds
FROM recent_timing;

-- 5. Find slowest searches (by wall-clock time)
SELECT 
  e.session_id,
  e.created_at,
  (e.event_data->>'wall_clock_seconds')::float as wall_clock_seconds,
  (e.event_data->>'serper_api_time_seconds')::float as serper_accumulated,
  (e.event_data->>'gpt4_turbo_api_time_seconds')::float as gpt4_turbo_accumulated,
  (e.event_data->>'categories_parallel')::int as categories,
  (e.event_data->>'total_seconds')::float as total_seconds
FROM events e
WHERE event_type = 'pipeline_timing'
ORDER BY (e.event_data->>'wall_clock_seconds')::float DESC
LIMIT 10;

-- 6. Find fastest searches (by wall-clock time)
SELECT 
  e.session_id,
  e.created_at,
  (e.event_data->>'wall_clock_seconds')::float as wall_clock_seconds,
  (e.event_data->>'serper_api_time_seconds')::float as serper_accumulated,
  (e.event_data->>'gpt4_turbo_api_time_seconds')::float as gpt4_turbo_accumulated,
  (e.event_data->>'categories_parallel')::int as categories,
  (e.event_data->>'total_seconds')::float as total_seconds
FROM events e
WHERE event_type = 'pipeline_timing'
ORDER BY (e.event_data->>'wall_clock_seconds')::float ASC
LIMIT 10;

-- 7. Timing trends over time (by hour)
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as search_count,
  ROUND(AVG((event_data->>'wall_clock_seconds')::float)::numeric, 2) as avg_wall_clock_seconds,
  ROUND(AVG((event_data->>'serper_api_time_seconds')::float)::numeric, 2) as avg_serper_accumulated,
  ROUND(AVG((event_data->>'gpt4_turbo_api_time_seconds')::float)::numeric, 2) as avg_gpt4_turbo_accumulated,
  ROUND(MIN((event_data->>'wall_clock_seconds')::float)::numeric, 2) as min_wall_clock,
  ROUND(MAX((event_data->>'wall_clock_seconds')::float)::numeric, 2) as max_wall_clock
FROM events
WHERE event_type = 'pipeline_timing'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- 8. Performance by number of categories searched
SELECT 
  (event_data->>'categories_parallel')::int as categories_searched,
  COUNT(*) as search_count,
  ROUND(AVG((event_data->>'wall_clock_seconds')::float)::numeric, 2) as avg_wall_clock_seconds,
  ROUND(AVG((event_data->>'serper_api_time_seconds')::float)::numeric, 2) as avg_serper_accumulated,
  ROUND(MIN((event_data->>'wall_clock_seconds')::float)::numeric, 2) as min_wall_clock,
  ROUND(MAX((event_data->>'wall_clock_seconds')::float)::numeric, 2) as max_wall_clock
FROM events
WHERE event_type = 'pipeline_timing'
GROUP BY categories_searched
ORDER BY categories_searched;

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
    (event_data->>'wall_clock_seconds')::float as wall_clock_seconds,
    (event_data->>'serper_api_time_seconds')::float as serper_api_time,
    (event_data->>'gpt4_turbo_api_time_seconds')::float as gpt4_turbo_api_time,
    (event_data->>'categories_parallel')::int as categories,
    created_at
  FROM events
  WHERE event_type = 'pipeline_timing'
)
SELECT 
  COALESCE(b.session_id, s.session_id) as session_id,
  COALESCE(b.created_at, s.created_at) as created_at,
  ROUND(COALESCE(b.gpt4o_seconds, 0)::numeric, 2) as gpt4o_seconds,
  ROUND(COALESCE(b.groundingdino_seconds, 0)::numeric, 3) as dino_seconds,
  ROUND(COALESCE(b.backend_total, 0)::numeric, 2) as backend_total,
  ROUND(COALESCE(s.wall_clock_seconds, 0)::numeric, 2) as search_wall_clock,
  ROUND(COALESCE(s.serper_api_time, 0)::numeric, 2) as serper_accumulated,
  ROUND(COALESCE(s.gpt4_turbo_api_time, 0)::numeric, 2) as gpt4_turbo_accumulated,
  COALESCE(s.categories, 0) as categories_parallel,
  ROUND((COALESCE(b.backend_total, 0) + COALESCE(s.wall_clock_seconds, 0))::numeric, 2) as end_to_end_total
FROM backend_timing b
FULL OUTER JOIN search_timing s ON b.session_id = s.session_id
ORDER BY COALESCE(b.created_at, s.created_at) DESC
LIMIT 10;

-- 7. Backend Timing Breakdown with Percentages (last 20)
-- Shows exactly where time is spent in the backend pipeline (chronological order)
SELECT 
  session_id,
  created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul' as created_at_kst,
  -- Chronological order of operations:
  (event_data->>'download_seconds')::float as download_seconds,
  (event_data->>'gpt4o_seconds')::float as gpt4o_seconds,
  (event_data->>'groundingdino_seconds')::float as dino_seconds,
  (event_data->>'processing_seconds')::float as processing_seconds,
  (event_data->>'upload_seconds')::float as upload_seconds,
  (event_data->>'overhead_seconds')::float as overhead_seconds,
  (event_data->>'total_seconds')::float as total_seconds,
  -- Percentages (most expensive operations)
  ROUND(((event_data->>'gpt4o_seconds')::float / NULLIF((event_data->>'total_seconds')::float, 0) * 100)::numeric, 1) as gpt4o_pct,
  ROUND(((event_data->>'groundingdino_seconds')::float / NULLIF((event_data->>'total_seconds')::float, 0) * 100)::numeric, 1) as dino_pct,
  ROUND(((event_data->>'upload_seconds')::float / NULLIF((event_data->>'total_seconds')::float, 0) * 100)::numeric, 1) as upload_pct
FROM events
WHERE event_type = 'backend_timing'
  AND event_data IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

