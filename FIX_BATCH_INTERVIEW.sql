-- ============================================================================
-- FIX: Reclassify "organic" users as "batch_interview"
-- These are the 9 users who got batch SMS links and you interviewed them
-- ============================================================================

-- Update all "organic" users who are actually from batch SMS
UPDATE users 
SET conversion_source = 'batch_interview'
WHERE conversion_source = 'organic'
  AND normalize_phone(phone_number) IN (
      SELECT normalize_phone(phone_number) 
      FROM result_page_visits
  );

-- Verify the fix
SELECT 
    conversion_source,
    COUNT(*) as count,
    ARRAY_AGG(phone_number ORDER BY phone_number) as phone_numbers
FROM users
GROUP BY conversion_source
ORDER BY count DESC;

