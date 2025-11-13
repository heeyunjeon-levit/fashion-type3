# User Feedback System - Setup Guide 📊

## Overview

All 58 result pages now include a satisfaction feedback modal that:
- ✅ Shows after user **clicks a product** (+ 5 sec) **OR**
- ✅ Shows after **reaching bottom** of sheet (+ 3 sec) **OR**  
- ✅ Shows after **45 seconds** (fallback if no engagement)
- ✅ Collects 만족/불만족 + optional comment
- ✅ Saves to Supabase database
- ✅ Only shows once per user (tracked via localStorage)

**Key improvement:** Won't interrupt browsing - waits for natural engagement!

---

## 🚀 Setup Instructions

### Step 1: Create Supabase Table

Run this SQL in your **Supabase SQL Editor**:

```sql
-- Copy from: supabase_feedback_schema.sql
-- Or run directly:

CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    satisfaction TEXT NOT NULL CHECK (satisfaction IN ('만족', '불만족')),
    comment TEXT,
    result_page_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    page_load_time INTEGER
);

CREATE INDEX IF NOT EXISTS idx_feedback_phone ON user_feedback(phone_number);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_satisfaction ON user_feedback(satisfaction);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to user_feedback" ON user_feedback;
CREATE POLICY "Allow service role full access to user_feedback" ON user_feedback
    FOR ALL USING (true);
```

### Step 2: Verify API Endpoint

The feedback API is deployed at:
```
https://fashionsource.vercel.app/api/feedback
```

Located in: `/app/api/feedback/route.ts`

### Step 3: Test the System

1. Open any result page:
   - **Multi-category**: https://mvp-ofhilalzw-heeyun-jeons-projects.vercel.app/results/1040455757.html
   - **Single category**: https://mvp-ofhilalzw-heeyun-jeons-projects.vercel.app/results/1036393835.html

2. Browse the products (scroll, click cards, etc.)

3. Feedback modal will appear after:
   - Clicking a product (+ 5 sec) OR
   - Reaching bottom (+ 3 sec) OR
   - 45 seconds

4. Select 만족 or 불만족

5. (Optional) Add comment

6. Click "확인"

7. Check Supabase table for the entry

---

## 📊 How It Works

### Trigger Logic

```javascript
// Show feedback when (whichever happens first):
1. User clicks ANY product card
   → Wait 5 seconds → Show feedback
   OR
2. User scrolls to bottom of sheet
   → Wait 3 seconds → Show feedback
   OR
3. 45 seconds elapsed with no engagement
   → Show feedback immediately
```

### Modal Behavior

```
1. User sees result page
2. Fallback timer starts (45 seconds)
3. TRIGGER SCENARIOS:
   
   Scenario A - Clicks product:
   - Cancels 45-second timer
   - Waits 5 seconds after click
   - Shows feedback modal
   
   Scenario B - Scrolls to bottom:
   - Cancels 45-second timer
   - Waits 3 seconds after reaching bottom
   - Shows feedback modal
   
   Scenario C - No engagement:
   - After 45 seconds, shows feedback
   
4. Modal appears with:
   - 만족 😊 / 불만족 😞 buttons
   - Text input (optional)
   - 확인 button (disabled until satisfaction selected)
```

### Data Collection

Each feedback submission includes:
- `phone_number` - User's phone number
- `satisfaction` - "만족" or "불만족"
- `comment` - Optional user comment
- `result_page_url` - Which result page they viewed
- `page_load_time` - Seconds before feedback submitted
- `user_agent` - Browser/device info
- `created_at` - Timestamp

### Preventing Duplicate Submissions

```javascript
// Stored in localStorage:
feedback_submitted_{phone_number} = true

// Modal will NOT show again for this user on this device
```

---

## 📈 View Feedback Analytics

### Query All Feedback

```sql
SELECT * FROM user_feedback 
ORDER BY created_at DESC;
```

### Satisfaction Summary

```sql
SELECT 
    satisfaction,
    COUNT(*) as total,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM user_feedback
GROUP BY satisfaction;
```

### Users with Comments

```sql
SELECT 
    phone_number,
    satisfaction,
    comment,
    created_at
FROM user_feedback
WHERE comment IS NOT NULL AND comment != ''
ORDER BY created_at DESC;
```

### Average Response Time

```sql
SELECT 
    satisfaction,
    AVG(page_load_time) as avg_seconds_to_respond,
    COUNT(*) as total_responses
FROM user_feedback
GROUP BY satisfaction;
```

### Use the Analytics View

```sql
SELECT * FROM feedback_analytics;
```

This shows:
- Total responses per satisfaction type
- Number of responses with comments
- Average time to feedback

---

## 🎨 Modal Design

Matches your screenshot:
- White modal with rounded corners
- 😊 만족 and 😞 불만족 buttons
- Blue highlight when selected
- Text input: "의견을 입력해주세요"
- Blue submit button: "확인"
- Close X button (top right)

---

## 🔗 Deployment URLs

### Result Pages (with improved timing)
https://mvp-ofhilalzw-heeyun-jeons-projects.vercel.app/results/

### Feedback API Endpoint
https://fashionsource.vercel.app/api/feedback

### SMS List
`FINAL_IMPROVED_TIMING.csv` - 58 users

---

## ✅ Testing Checklist

- [ ] Created `user_feedback` table in Supabase
- [ ] Verified table has RLS policy
- [ ] Tested feedback modal appears after clicking product
- [ ] Tested feedback modal appears after reaching bottom
- [ ] Tested feedback modal appears after 45 seconds (no engagement)
- [ ] Tested submitting 만족 feedback
- [ ] Tested submitting 불만족 feedback
- [ ] Tested submitting with comment
- [ ] Verified data appears in Supabase
- [ ] Tested that modal doesn't show again (localStorage)
- [ ] Tested close button works
- [ ] Verified modal doesn't interrupt initial browsing

---

## 📱 User Experience Flow

1. User receives SMS with result link
2. Opens link → sees their results
3. User browses products:
   - Scrolls through categories
   - Clicks on products they like
   - Views shopping options
4. Feedback modal appears AFTER natural engagement:
   - After clicking a product (+ 5 sec)
   - After scrolling to bottom (+ 3 sec)
   - After 45 seconds if no clicks/scrolling
5. User selects satisfaction + optional comment
6. Clicks "확인"
7. Sees "감사합니다!" message
8. Modal closes automatically
9. Can continue browsing results
10. Modal won't show again on this device

**Key benefit:** Users can browse products freely before being asked for feedback!

---

## 🔧 Troubleshooting

### Modal doesn't appear?
- Check browser console for errors
- Verify localStorage isn't blocking it
- Try in incognito mode

### Feedback not saving?
- Check Supabase table exists
- Verify RLS policy allows inserts
- Check API endpoint is accessible
- Look at Network tab in DevTools

### Modal shows every time?
- Check localStorage is enabled
- Verify phone number is correct in HTML
- Try clearing browser cache

---

## 📊 Expected Results

With 58 users, you should expect:
- **Response rate**: 40-60% (24-35 responses)
- **만족 rate**: Typically 60-80%
- **Comment rate**: 20-30% of responses
- **Average response time**: 15-30 seconds

---

*Generated on November 13, 2025*  
*All 58 result pages updated with feedback system*

