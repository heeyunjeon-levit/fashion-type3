-- Check what data exists for a specific user
-- Replace with actual phone number to test

SELECT 'EVENTS TABLE' as source, event_type, user_id, session_id, created_at
FROM events
WHERE user_id IN (SELECT id FROM users WHERE phone_number = '01092103590')
ORDER BY created_at;

SELECT 'SESSIONS TABLE' as source, session_id, user_id, phone_number, uploaded_image_url, created_at
FROM sessions  
WHERE phone_number = '01092103590'
ORDER BY created_at;
