-- Query user journey for 01048545690 (821048545690)
-- This user clicked "다른 이미지도 찾아보기" button

-- 1. Check their result page visits
SELECT 
    visit_timestamp,
    time_on_page_seconds,
    clicked_products,
    clicked_toggle_button,
    opened_feedback,
    session_id,
    referrer
FROM result_page_visits
WHERE phone_number IN ('01048545690', '821048545690', '1048545690')
ORDER BY visit_timestamp DESC;

-- 2. Check their main app visits (conversions from result page)
SELECT 
    visit_timestamp,
    page_path,
    is_new_session,
    time_on_page_seconds,
    scroll_depth,
    uploaded_image,
    completed_analysis,
    clicked_search,
    session_id,
    device_id,
    referrer
FROM app_page_visits
WHERE referrer LIKE '%821048545690%' 
   OR referrer LIKE '%01048545690%'
   OR referrer LIKE '%1048545690%'
ORDER BY visit_timestamp DESC;

-- 3. Get their feedback if they submitted any
SELECT 
    created_at,
    satisfaction,
    comment,
    time_to_feedback_seconds
FROM user_feedback
WHERE phone_number IN ('01048545690', '821048545690', '1048545690')
ORDER BY created_at DESC;

-- 4. Summary: Did they convert and upload a new image?
SELECT 
    'Result Page Visits' as metric,
    COUNT(*) as count
FROM result_page_visits
WHERE phone_number IN ('01048545690', '821048545690', '1048545690')
UNION ALL
SELECT 
    'Main App Visits (from result page)',
    COUNT(*)
FROM app_page_visits
WHERE referrer LIKE '%48545690%'
UNION ALL
SELECT 
    'Uploaded New Image',
    COUNT(*)
FROM app_page_visits
WHERE referrer LIKE '%48545690%' AND uploaded_image = true
UNION ALL
SELECT 
    'Completed Analysis',
    COUNT(*)
FROM app_page_visits
WHERE referrer LIKE '%48545690%' AND completed_analysis = true
UNION ALL
SELECT 
    'Clicked Search',
    COUNT(*)
FROM app_page_visits
WHERE referrer LIKE '%48545690%' AND clicked_search = true;


