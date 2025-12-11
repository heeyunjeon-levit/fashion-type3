-- Find sessions by user_id (even if phone_number is missing)
SELECT 
    s.id as session_id,
    s.session_id as client_session_id,
    s.user_id,
    s.phone_number,
    s.uploaded_image_url,
    s.created_at,
    s.uploaded_at
FROM sessions s
WHERE s.user_id = 'dfc74b08-d911-41de-b06f-825093eb7c37'
ORDER BY s.created_at DESC;

-- Find events by user_id
SELECT 
    e.id,
    e.event_type,
    e.session_id,
    e.user_id,
    e.created_at
FROM events e
WHERE e.user_id = 'dfc74b08-d911-41de-b06f-825093eb7c37'
ORDER BY e.created_at;
