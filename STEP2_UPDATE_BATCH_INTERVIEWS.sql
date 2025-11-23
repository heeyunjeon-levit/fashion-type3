-- ============================================================================
-- STEP 2: UPDATE - Reclassify batch SMS users as batch_interview
-- Run this AFTER reviewing Step 1
-- ============================================================================

-- Update ONLY those "organic" users who are in result_page_visits
UPDATE users 
SET conversion_source = 'batch_interview'
WHERE conversion_source = 'organic'
  AND normalize_phone(phone_number) IN (
      SELECT normalize_phone(phone_number) 
      FROM result_page_visits
  );

-- Show what was updated
SELECT 
    '✅ UPDATE COMPLETE' as status,
    'Check Step 3 for final breakdown' as next_step;






