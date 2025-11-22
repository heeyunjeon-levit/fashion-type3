-- ============================================================================
-- Mark the 9 "organic" users as direct interviews (no batch SMS involved)
-- ============================================================================

-- Update them to a new category
UPDATE users 
SET conversion_source = 'direct_interview'
WHERE conversion_source = 'organic';

-- Verify
SELECT 
    conversion_source,
    COUNT(*) as count,
    ARRAY_AGG(phone_number ORDER BY phone_number) as phone_numbers
FROM users
GROUP BY conversion_source
ORDER BY 
    CASE conversion_source
        WHEN 'colleague' THEN 1
        WHEN 'batch_button_click' THEN 2
        WHEN 'batch_interview' THEN 3
        WHEN 'direct_interview' THEN 4
        WHEN 'organic' THEN 5
    END;




