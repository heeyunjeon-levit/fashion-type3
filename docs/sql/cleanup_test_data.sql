-- Clean up test data for phone number 1040455757
-- Run this in Supabase SQL Editor before sending links to real users

-- 1. Delete from result_page_visits (result page tracking)
DELETE FROM result_page_visits
WHERE phone_number = '1040455757';

-- 2. Delete from user_feedback (feedback submissions)
DELETE FROM user_feedback
WHERE phone_number = '1040455757';

-- 3. Delete from app_page_visits (main app tracking with this phone as referrer)
DELETE FROM app_page_visits
WHERE referrer LIKE '%phone=1040455757%';

-- Verify deletion
SELECT 'result_page_visits' as table_name, COUNT(*) as remaining_rows
FROM result_page_visits
WHERE phone_number = '1040455757'

UNION ALL

SELECT 'user_feedback', COUNT(*)
FROM user_feedback
WHERE phone_number = '1040455757'

UNION ALL

SELECT 'app_page_visits', COUNT(*)
FROM app_page_visits
WHERE referrer LIKE '%phone=1040455757%';

-- Expected output: All counts should be 0

