-- View GPT Analysis Data (Stage 1: Detection with GroundingDINO prompts)
-- Run these queries in Supabase SQL Editor to see your GPT analysis results

-- 1. View all sessions with GPT analysis (most recent first)
SELECT 
    session_id,
    phone_number,
    created_at,
    analyzed_at,
    gpt_analysis->'items' as detected_items,
    jsonb_array_length(gpt_analysis->'items') as item_count
FROM sessions
WHERE gpt_analysis IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 2. View detailed GPT analysis for most recent session
SELECT 
    session_id,
    phone_number,
    jsonb_pretty(gpt_analysis) as gpt_analysis_formatted
FROM sessions
WHERE gpt_analysis IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

-- 3. View all detected items with their GroundingDINO prompts
SELECT 
    s.session_id,
    s.phone_number,
    s.analyzed_at,
    item->>'category' as category,
    item->>'groundingdino_prompt' as groundingdino_prompt,
    item->>'description' as description,
    item->>'croppedImageUrl' as cropped_image_url
FROM sessions s,
     jsonb_array_elements(s.gpt_analysis->'items') as item
WHERE s.gpt_analysis IS NOT NULL
ORDER BY s.created_at DESC, (item->>'category')
LIMIT 50;

-- 4. View GPT analysis events (detailed event log)
SELECT 
    e.created_at,
    s.session_id,
    s.phone_number,
    e.event_data->'itemCount' as items_detected,
    e.event_data->'cached' as was_cached,
    jsonb_pretty(e.event_data->'items') as detected_items
FROM events e
JOIN sessions s ON e.session_id = s.id
WHERE e.event_type = 'gpt_analysis'
ORDER BY e.created_at DESC
LIMIT 10;

-- 5. Summary: Count of items detected per session
SELECT 
    session_id,
    phone_number,
    analyzed_at,
    jsonb_array_length(gpt_analysis->'items') as total_items_detected,
    (SELECT string_agg(item->>'category', ', ')
     FROM jsonb_array_elements(gpt_analysis->'items') as item
    ) as categories
FROM sessions
WHERE gpt_analysis IS NOT NULL
ORDER BY analyzed_at DESC
LIMIT 20;

-- 6. Most common GroundingDINO prompts across all sessions
SELECT 
    item->>'groundingdino_prompt' as prompt,
    item->>'category' as category,
    COUNT(*) as frequency
FROM sessions s,
     jsonb_array_elements(s.gpt_analysis->'items') as item
WHERE s.gpt_analysis IS NOT NULL
GROUP BY item->>'groundingdino_prompt', item->>'category'
ORDER BY frequency DESC
LIMIT 30;

-- 7. Check if data exists (quick verification)
SELECT 
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN gpt_analysis IS NOT NULL THEN 1 END) as sessions_with_analysis,
    COUNT(CASE WHEN gpt_analysis IS NULL THEN 1 END) as sessions_without_analysis
FROM sessions;

-- 8. View your most recent test (everything about the latest session)
SELECT 
    session_id,
    phone_number,
    uploaded_image_url,
    analyzed_at,
    jsonb_pretty(gpt_analysis) as full_gpt_analysis,
    (SELECT COUNT(*) FROM events WHERE session_id = sessions.id) as event_count,
    (SELECT COUNT(*) FROM link_clicks WHERE session_id = sessions.id) as click_count
FROM sessions
ORDER BY created_at DESC
LIMIT 1;

