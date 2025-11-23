# 🔍 How to Track Complete User Journey

## 📋 Quick Start

To see a user's complete journey from their phone number, run the SQL queries in **Supabase SQL Editor**.

---

## 🎯 For Your Phone Number (01090848563)

### Option 1: Use the Pre-Made File

Open and run: **`query_user_journey_01090848563.sql`**

This file is **ready to go** - just copy all the queries into Supabase SQL Editor and run them!

---

## 🔄 For Any Phone Number

### Option 2: Use the Template

1. Open: **`query_user_journey_TEMPLATE.sql`**
2. **Find/Replace** at the top:
   ```sql
   \set phone_full '01090848563'    → Replace with target phone
   \set phone_intl '821090848563'   → Replace with 82 version
   \set phone_short '1090848563'    → Replace with short version
   ```
3. Run in Supabase SQL Editor

---

## 📊 What Each Query Shows

### 1. **User Overview**
- First visit date
- Last active date
- Total searches
- Days active

### 2. **Engagement Summary**
- Total sessions
- Batch page visits
- Product clicks
- Feedback submissions
- Average time on pages

### 3. **Complete Timeline** ⭐
Shows **everything** the user did in chronological order:
- 🆕 Account creation
- 📱 Session starts
- 🔗 Batch page visits
- 🌐 Main app visits
- 🛍️ Product clicks
- 💭 Feedback submissions

### 4. **Conversion Funnel**
Tracks the user's journey step-by-step:
1. ✅ Received batch link?
2. ✅ Visited batch link?
3. ✅ Clicked products?
4. ✅ Converted to main app?
5. ✅ Uploaded new image?
6. ✅ Submitted feedback?

### 5. **Session Details**
All sessions with:
- Upload timestamps
- Search timestamps
- Time to complete actions

### 6. **Product Clicks**
Every product the user clicked:
- Category
- Product title
- Link
- Position in results
- Timestamp

### 7. **Feedback History**
All feedback submissions:
- Satisfaction (만족/불만족)
- Comments
- Time to feedback
- Source (main app vs batch)

---

## 🎯 Common Use Cases

### Find High-Value Users
```sql
-- Users who clicked 3+ products
SELECT 
    s.phone_number,
    COUNT(lc.id) as total_clicks,
    MAX(lc.clicked_at) as last_click
FROM link_clicks lc
JOIN sessions s ON lc.session_id = s.session_id
GROUP BY s.phone_number
HAVING COUNT(lc.id) >= 3
ORDER BY total_clicks DESC;
```

### Find Users Who Converted
```sql
-- Users who went from batch page → main app
SELECT DISTINCT 
    rpv.phone_number,
    rpv.visit_timestamp as batch_visit,
    apv.visit_timestamp as app_visit
FROM result_page_visits rpv
JOIN app_page_visits apv 
    ON apv.referrer LIKE '%' || rpv.phone_number || '%'
WHERE apv.visit_timestamp > rpv.visit_timestamp
ORDER BY rpv.visit_timestamp DESC;
```

### Find Unsatisfied Users
```sql
-- Users who gave negative feedback
SELECT 
    phone_number,
    comment,
    result_page_url,
    created_at
FROM user_feedback
WHERE satisfaction = '불만족'
ORDER BY created_at DESC;
```

---

## 🚀 Your Phone Number: 01090848563

Run this now to see **YOUR** complete journey:

```sql
-- Quick overview
SELECT * FROM (
    SELECT 'Sessions' as metric, COUNT(*)::text as value 
    FROM sessions WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    UNION ALL
    SELECT 'Batch Visits', COUNT(*)::text 
    FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    UNION ALL
    SELECT 'Product Clicks', COUNT(*)::text 
    FROM link_clicks lc JOIN sessions s ON lc.session_id = s.session_id 
    WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')
    UNION ALL
    SELECT 'Feedback', COUNT(*)::text 
    FROM user_feedback WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
) summary;
```

Then run the full timeline:
```sql
-- Your complete timeline
SELECT * FROM (
    SELECT 
        created_at as timestamp,
        '🆕 USER CREATED' as event,
        'First visit' as details
    FROM users WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    SELECT visit_timestamp, '🔗 BATCH PAGE', result_page_url
    FROM result_page_visits WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    SELECT lc.clicked_at, '🛍️ PRODUCT CLICK', lc.product_title
    FROM link_clicks lc JOIN sessions s ON lc.session_id = s.session_id 
    WHERE s.phone_number IN ('01090848563', '821090848563', '1090848563')
    
    UNION ALL
    
    SELECT created_at, '💭 FEEDBACK', satisfaction || ': ' || COALESCE(comment, 'No comment')
    FROM user_feedback WHERE phone_number IN ('01090848563', '821090848563', '1090848563')
) timeline
ORDER BY timestamp DESC;
```

---

## 📁 Files Available

1. **`query_user_journey_01090848563.sql`** - Your specific queries (ready to run)
2. **`query_user_journey_TEMPLATE.sql`** - Template for any phone number
3. **`HOW_TO_TRACK_USER_JOURNEY.md`** - This guide

---

## 💡 Pro Tips

1. **Phone Number Formats**: Queries check all 3 formats automatically:
   - `01090848563` (Korean)
   - `821090848563` (International)
   - `1090848563` (Short)

2. **Run in Order**: Start with Overview → Summary → Timeline

3. **Export Results**: Use Supabase's "Download CSV" button for analysis

4. **Regular Checks**: Run weekly to track engagement trends

---

## 🎊 You're All Set!

Open **Supabase SQL Editor** and run `query_user_journey_01090848563.sql` to see your complete journey! 🚀






