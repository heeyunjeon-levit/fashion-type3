-- ============================================================================
-- COMPLETE USER JOURNEY FOR: 01090848563
-- ============================================================================

-- 1. BASIC USER INFO
-- ============================================================================
SELECT 
    id as user_id,
    phone_number,
    country_code,
    total_searches,
    created_at as first_seen,
    last_active_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/86400 as days_since_first_visit
FROM users
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
ORDER BY created_at DESC;

-- 2. ALL SESSIONS (Main App)
-- ============================================================================
SELECT 
    session_id,
    created_at,
    status,
    phone_collected_at,
    uploaded_image_url,
    selected_items,
    searched_at
FROM sessions
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
ORDER BY created_at DESC;

-- 3. RESULT PAGE VISITS (From Batch Links - Individual HTML Pages)
-- ============================================================================
SELECT 
    visit_timestamp,
    result_page_url,
    time_on_page_seconds,
    clicked_products,
    clicked_toggle_button,
    opened_feedback,
    session_id,
    referrer
FROM result_page_visits
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
ORDER BY visit_timestamp DESC;

-- 4. MAIN APP PAGE VISITS
-- ============================================================================
SELECT 
    visit_timestamp,
    page_path,
    time_on_page_seconds,
    session_id,
    referrer
FROM app_page_visits
WHERE referrer LIKE '%1090848563%' 
   OR session_id IN (
       SELECT session_id FROM sessions 
       WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
   )
ORDER BY visit_timestamp DESC;

-- 5. LINK CLICKS (Main App)
-- ============================================================================
SELECT 
    lc.clicked_at,
    lc.item_category,
    lc.item_description,
    lc.product_link,
    lc.product_title,
    lc.link_position,
    lc.session_id
FROM link_clicks lc
JOIN sessions s ON lc.session_id::text = s.session_id::text
WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')
ORDER BY lc.clicked_at DESC;

-- 6. FEEDBACK SUBMISSIONS
-- ============================================================================
SELECT 
    created_at,
    satisfaction,
    comment,
    result_page_url,
    time_to_feedback_seconds,
    CASE 
        WHEN result_page_url = 'main_app_result_page' THEN 'Main App'
        ELSE 'Batch Result Page'
    END as feedback_source
FROM user_feedback
WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
ORDER BY created_at DESC;

-- 7. COMPLETE TIMELINE (All Events Combined)
-- ============================================================================
SELECT * FROM (
    -- User creation
    SELECT 
        created_at as timestamp,
        'USER_CREATED' as event_type,
        'First visit to platform' as description,
        NULL as details
    FROM users
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Sessions
    SELECT 
        created_at,
        'SESSION_STARTED' as event_type,
        'New session in main app' as description,
        json_build_object(
            'session_id', session_id,
            'status', status
        )::text as details
    FROM sessions
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Result page visits
    SELECT 
        visit_timestamp,
        'RESULT_PAGE_VISIT' as event_type,
        'Visited batch result page' as description,
        json_build_object(
            'url', result_page_url,
            'time_on_page', time_on_page_seconds,
            'clicked_products', clicked_products,
            'opened_feedback', opened_feedback
        )::text as details
    FROM result_page_visits
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Link clicks
    SELECT 
        lc.clicked_at,
        'LINK_CLICKED' as event_type,
        'Clicked product link' as description,
        json_build_object(
            'category', lc.item_category,
            'product', lc.product_title,
            'link', lc.product_link
        )::text as details
    FROM link_clicks lc
    JOIN sessions s ON lc.session_id::text = s.session_id::text
    WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    -- Feedback
    SELECT 
        created_at,
        'FEEDBACK_SUBMITTED' as event_type,
        'Submitted satisfaction feedback' as description,
        json_build_object(
            'satisfaction', satisfaction,
            'comment', comment,
            'source', CASE 
                WHEN result_page_url = 'main_app_result_page' THEN 'Main App'
                ELSE 'Batch Page'
            END
        )::text as details
    FROM user_feedback
    WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
) timeline
ORDER BY timestamp DESC;

-- 8. ENGAGEMENT SUMMARY
-- ============================================================================
SELECT 
    -- Basic counts
    (SELECT COUNT(*) FROM sessions WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) as total_sessions,
    (SELECT COUNT(*) FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) as result_page_visits,
    (SELECT COUNT(*) FROM link_clicks lc JOIN sessions s ON lc.session_id::text = s.session_id::text WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')) as total_link_clicks,
    (SELECT COUNT(*) FROM user_feedback WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) as feedback_submitted,
    
    -- Engagement metrics
    (SELECT AVG(time_on_page_seconds) FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) as avg_time_on_result_pages,
    (SELECT SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END) FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) as result_pages_with_clicks,
    
    -- Conversion
    CASE 
        WHEN (SELECT COUNT(*) FROM app_page_visits WHERE referrer LIKE '%1090848563%') > 0 
        THEN 'YES - Converted from batch to main app'
        ELSE 'NO - Main app only or batch only'
    END as converted_from_batch;

-- 9. CHECK IF USER WAS IN ANY BATCH
-- ============================================================================
SELECT 
    'Batch Result Page Status' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM result_page_visits 
            WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
        ) 
        THEN '✅ YES - User received a batch result link'
        ELSE '❌ NO - User is main app only'
    END as result;

-- 10. CONVERSION FUNNEL (If they got batch link)
-- ============================================================================
SELECT 
    '1. Received Batch Link' as step,
    CASE WHEN EXISTS (SELECT 1 FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    '2. Visited Batch Link',
    CASE WHEN (SELECT COUNT(*) FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) > 0 THEN '✅' ELSE '❌' END
UNION ALL
SELECT 
    '3. Clicked Products',
    CASE WHEN (SELECT SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END) FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) > 0 THEN '✅' ELSE '❌' END
UNION ALL
SELECT 
    '4. Clicked "다른 이미지도 찾아보기"',
    CASE WHEN (SELECT COUNT(*) FROM app_page_visits WHERE referrer LIKE '%1090848563%') > 0 THEN '✅' ELSE '❌' END
UNION ALL
SELECT 
    '5. Used Main App',
    CASE WHEN (SELECT COUNT(*) FROM sessions WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) > 0 THEN '✅' ELSE '❌' END
UNION ALL
SELECT 
    '6. Submitted Feedback',
    CASE WHEN (SELECT COUNT(*) FROM user_feedback WHERE phone_number IN ('01090848563', '821090848563', '1090848563')) > 0 THEN '✅' ELSE '❌' END;

