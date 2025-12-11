SELECT 
    phone_number,
    satisfaction,
    comment,
    result_page_url,
    created_at,
    page_load_time
FROM user_feedback
WHERE phone_number = '01066809800'
ORDER BY created_at;
