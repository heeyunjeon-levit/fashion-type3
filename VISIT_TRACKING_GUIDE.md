# 📊 Result Page Visit Tracking Guide

## Overview

Track every visit to result pages to identify your most engaged users and prioritize follow-up!

## 🚀 Setup

### 1. Create Supabase Table

Run this SQL in your Supabase SQL Editor:

```bash
# Copy the SQL file content:
cat supabase_visit_tracking_schema.sql
```

Then paste and run in: https://supabase.com/dashboard → SQL Editor

### 2. Deploy Code

The visit tracking is already integrated! Just commit and push:

```bash
git add -A
git commit -m "Add visit tracking for result pages"
git push origin main
```

Vercel will auto-deploy.

## 📈 What Gets Tracked

### Per Visit:
- ✅ **Phone number** - Who visited
- ✅ **Timestamp** - When they visited  
- ✅ **Session ID** - Unique per browser session
- ✅ **Time on page** - How long they stayed
- ✅ **Product clicks** - Did they click any shopping links?
- ✅ **Toggle button** - Did they view the original image?
- ✅ **Feedback** - Did they open the feedback modal/tab?
- ✅ **Referrer** - Where they came from (SMS, direct, etc)
- ✅ **User agent** - Browser/device info

## 🔍 How to View Data

### Most Engaged Users (Multiple Visits)

```sql
SELECT * FROM most_engaged_users;
```

Shows users who came back multiple times, sorted by visit count!

### User Revisit Summary

```sql
SELECT * FROM user_revisit_summary
ORDER BY total_visits DESC;
```

See:
- Total visits per user
- Days visited
- Average time on page
- Click rate percentage
- First and last visit times

### Recent Activity (Last 24 Hours)

```sql
SELECT * FROM recent_visits;
```

### All Visit Data

```sql
SELECT 
    phone_number,
    visit_timestamp,
    time_on_page_seconds,
    clicked_products,
    clicked_toggle_button,
    opened_feedback
FROM result_page_visits
ORDER BY visit_timestamp DESC
LIMIT 50;
```

### Find Your Top 10 Most Engaged Users

```sql
SELECT 
    phone_number,
    COUNT(DISTINCT session_id) as visits,
    MAX(visit_timestamp) as last_visit,
    AVG(time_on_page_seconds) as avg_time,
    SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END) as clicks
FROM result_page_visits
GROUP BY phone_number
ORDER BY visits DESC, avg_time DESC
LIMIT 10;
```

## 🎯 Prioritization Strategy

### High Priority (Follow up immediately!)
- **Multiple visits** (came back 2+ times)
- **Long time on page** (>30 seconds avg)
- **Clicked products** (showed purchase intent)
- **Opened feedback** (engaged with survey)

Query for high priority users:
```sql
SELECT 
    phone_number,
    total_visits,
    avg_time_on_page,
    visits_with_clicks,
    last_visit
FROM user_revisit_summary
WHERE total_visits >= 2 
   OR avg_time_on_page > 30
   OR visits_with_clicks > 0
ORDER BY total_visits DESC, avg_time_on_page DESC;
```

### Medium Priority
- **Single visit** with long time (>20 seconds)
- **Viewed original image** (clicked toggle button)

### Low Priority
- **Single visit** with short time (<10 seconds)
- No engagement actions

## 📊 Analytics Queries

### Daily Visit Trends
```sql
SELECT 
    DATE(visit_timestamp) as date,
    COUNT(DISTINCT session_id) as unique_visits,
    COUNT(*) as total_page_views,
    AVG(time_on_page_seconds) as avg_time
FROM result_page_visits
GROUP BY DATE(visit_timestamp)
ORDER BY date DESC;
```

### Engagement Rate by Hour
```sql
SELECT 
    EXTRACT(HOUR FROM visit_timestamp) as hour,
    COUNT(*) as visits,
    AVG(time_on_page_seconds) as avg_time,
    SUM(CASE WHEN clicked_products THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as click_rate
FROM result_page_visits
GROUP BY EXTRACT(HOUR FROM visit_timestamp)
ORDER BY hour;
```

### Revisit Rate
```sql
SELECT 
    CASE 
        WHEN visit_count = 1 THEN '1 visit'
        WHEN visit_count = 2 THEN '2 visits'
        WHEN visit_count >= 3 THEN '3+ visits'
    END as visit_category,
    COUNT(*) as users
FROM (
    SELECT phone_number, COUNT(DISTINCT session_id) as visit_count
    FROM result_page_visits
    GROUP BY phone_number
) subquery
GROUP BY visit_category
ORDER BY visit_category;
```

## 🔔 How It Works

1. **Page Load**: 
   - Session ID generated (persists during browser session)
   - Initial visit logged immediately

2. **User Actions**:
   - Product click → `clicked_products = true`
   - Toggle button → `clicked_toggle_button = true`
   - Feedback modal → `opened_feedback = true`

3. **Page Leave**:
   - Time on page calculated
   - Final visit data sent via `sendBeacon` (reliable even during page close)

4. **Revisits**:
   - Each new session = new row in database
   - Same session (refresh/back button) = same session_id

## 💡 Tips

- **Session ID**: Unique per browser session, persists until browser closed
- **Multiple tabs**: Each tab = separate session
- **Refresh**: Same session, shows engagement within that visit
- **Come back later**: New session, shows they're interested!

## 🎁 Export for SMS Follow-up

```sql
-- Export high-priority users for SMS campaign
SELECT 
    phone_number,
    total_visits,
    last_visit,
    'High priority - visited ' || total_visits || ' times' as note
FROM user_revisit_summary
WHERE total_visits >= 2
ORDER BY total_visits DESC;
```

Save as CSV and send targeted SMS to your most engaged users! 🎯

