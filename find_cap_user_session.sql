-- Find the session for user 01024450277 with the cap image
-- This will show their session data and we can generate a link from it

SELECT 
    session_id,
    phone_number,
    created_at,
    uploaded_image_url as original_image,
    jsonb_pretty(gpt_analysis) as detected_items,
    jsonb_array_length(gpt_analysis->'items') as item_count,
    cropped_images,
    selected_items,
    search_results
FROM sessions
WHERE phone_number = '01024450277'
ORDER BY created_at DESC
LIMIT 5;

-- If you want just the most recent session:
/*
SELECT 
    session_id,
    phone_number,
    uploaded_image_url,
    gpt_analysis->'items' as items
FROM sessions
WHERE phone_number = '01024450277'
ORDER BY created_at DESC
LIMIT 1;
*/

-- To see all events for this user:
/*
SELECT 
    e.created_at,
    e.event_type,
    e.event_data
FROM events e
JOIN sessions s ON e.session_id = s.id
WHERE s.phone_number = '01024450277'
ORDER BY e.created_at DESC;
*/






