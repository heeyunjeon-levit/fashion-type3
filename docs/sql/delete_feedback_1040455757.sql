-- Delete accidental feedback submission for phone number 1040455757

-- First, let's see what feedback exists for this number
SELECT * FROM user_feedback 
WHERE phone_number = '1040455757'
ORDER BY created_at DESC;

-- Delete the feedback for this phone number
DELETE FROM user_feedback 
WHERE phone_number = '1040455757';

-- Verify deletion (should return 0 rows)
SELECT COUNT(*) as remaining_feedback 
FROM user_feedback 
WHERE phone_number = '1040455757';

-- Summary
SELECT 
    'Feedback deleted for phone: 1040455757' as message,
    COUNT(*) as total_feedback_remaining 
FROM user_feedback;

