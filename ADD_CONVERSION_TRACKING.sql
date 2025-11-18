-- ============================================================================
-- ADD CONVERSION SOURCE TRACKING TO USERS TABLE
-- This allows you to track HOW each user joined your main app
-- ============================================================================

-- Step 1: Add new column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS conversion_source TEXT;

-- Step 2: Add comment to explain the field
COMMENT ON COLUMN users.conversion_source IS 
'How the user joined: batch_button_click, batch_interview, colleague, organic';


-- ============================================================================
-- BACKFILL: Mark Your Existing Users
-- ============================================================================

-- Mark the known button convert
UPDATE users 
SET conversion_source = 'batch_button_click'
WHERE phone_number = '01048545690';

-- Mark your 6 colleagues (UPDATE THESE PHONE NUMBERS!)
UPDATE users 
SET conversion_source = 'colleague'
WHERE phone_number IN (
    '01090848563',  -- You
    '01085258875',   -- Replace with actual
    '01036849157',   -- Replace with actual
    '01034798885',   -- Replace with actual
    '01051913590',   -- Replace with actual
    '01029401890',
    '01068631341'    -- Replace with actual
);

-- Mark the interviewed converts (everyone else from batch who joined)
UPDATE users 
SET conversion_source = 'batch_interview'
WHERE phone_number IN (
    -- Users who are in BOTH result_page_visits AND users, but not button/colleague
    SELECT u.phone_number
    FROM users u
    WHERE normalize_phone(u.phone_number) IN (
        SELECT normalize_phone(phone_number) FROM result_page_visits
    )
    AND conversion_source IS NULL
);

-- Mark everyone else as organic (direct main app signups)
UPDATE users 
SET conversion_source = 'organic'
WHERE conversion_source IS NULL;


-- ============================================================================
-- VERIFY: Check the counts
-- ============================================================================
SELECT 
    conversion_source,
    COUNT(*) as count,
    ARRAY_AGG(phone_number) as phone_numbers
FROM users
GROUP BY conversion_source
ORDER BY count DESC;

