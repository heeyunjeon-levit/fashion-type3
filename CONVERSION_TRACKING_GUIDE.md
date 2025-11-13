# 🎯 Conversion Tracking Guide: Result Page → Main MVP

## Overview

Track users who click the "다른 이미지도 찾아보기" button and convert from result pages to your main MVP app!

## 🚀 How It Works

### Button Link Format:
```
https://fashionsource.vercel.app/?source=result_page&phone=1040455757
```

Parameters:
- `source=result_page` - Identifies they came from a result page
- `phone=1040455757` - Which specific user clicked

### Stored in Database:
The `referrer` field in `app_page_visits` will show:
```
https://fashionsource.vercel.app/results/1040455757.html (source: result_page, phone: 1040455757)
```

## 📊 Analytics Queries

### 1. See All Conversions from Result Pages

```sql
SELECT 
    session_id,
    visit_timestamp,
    referrer,
    uploaded_image,
    completed_analysis
FROM app_page_visits
WHERE referrer LIKE '%(source: result_page%'
ORDER BY visit_timestamp DESC;
```

### 2. Count Total Conversions

```sql
SELECT 
    COUNT(*) as total_conversions,
    COUNT(DISTINCT CASE WHEN uploaded_image THEN session_id END) as uploaded_after_conversion,
    COUNT(DISTINCT CASE WHEN completed_analysis THEN session_id END) as completed_after_conversion
FROM app_page_visits
WHERE referrer LIKE '%(source: result_page%';
```

### 3. Conversion Rate by User

```sql
WITH result_page_users AS (
    -- Get all users who visited result pages
    SELECT DISTINCT phone_number
    FROM result_page_visits
),
conversions AS (
    -- Extract phone from referrer string
    SELECT 
        SUBSTRING(referrer FROM 'phone: ([0-9]+)') as phone_number,
        session_id,
        uploaded_image,
        completed_analysis
    FROM app_page_visits
    WHERE referrer LIKE '%(source: result_page%'
)
SELECT 
    r.phone_number,
    COUNT(c.session_id) as clicked_button,
    MAX(c.uploaded_image::int) as uploaded_new_image,
    MAX(c.completed_analysis::int) as completed_new_analysis
FROM result_page_users r
LEFT JOIN conversions c ON c.phone_number = r.phone_number
GROUP BY r.phone_number
HAVING COUNT(c.session_id) > 0
ORDER BY clicked_button DESC;
```

### 4. Time to Conversion

```sql
WITH result_visits AS (
    SELECT 
        phone_number,
        MAX(visit_timestamp) as last_result_visit
    FROM result_page_visits
    GROUP BY phone_number
),
app_visits AS (
    SELECT 
        SUBSTRING(referrer FROM 'phone: ([0-9]+)') as phone_number,
        MIN(visit_timestamp) as first_app_visit
    FROM app_page_visits
    WHERE referrer LIKE '%(source: result_page%'
    GROUP BY phone_number
)
SELECT 
    r.phone_number,
    r.last_result_visit,
    a.first_app_visit,
    EXTRACT(EPOCH FROM (a.first_app_visit - r.last_result_visit))/60 as minutes_to_convert
FROM result_visits r
INNER JOIN app_visits a ON a.phone_number = r.phone_number
ORDER BY minutes_to_convert ASC;
```

### 5. Conversion Funnel (Complete Journey)

```sql
WITH conversions AS (
    SELECT 
        SUBSTRING(referrer FROM 'phone: ([0-9]+)') as phone_number,
        COUNT(*) as main_app_visits,
        MAX(uploaded_image::int) as uploaded,
        MAX(completed_analysis::int) as completed
    FROM app_page_visits
    WHERE referrer LIKE '%(source: result_page%'
    GROUP BY phone_number
)
SELECT 
    COUNT(*) as total_conversions,
    SUM(CASE WHEN uploaded = 1 THEN 1 ELSE 0 END) as uploaded_new_image,
    SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_new_analysis,
    ROUND(
        SUM(CASE WHEN uploaded = 1 THEN 1 ELSE 0 END)::numeric / 
        COUNT(*)::numeric * 100, 
        1
    ) as upload_rate,
    ROUND(
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END)::numeric / 
        SUM(CASE WHEN uploaded = 1 THEN 1 ELSE 0 END)::numeric * 100, 
        1
    ) as completion_rate
FROM conversions;
```

### 6. Daily Conversion Trend

```sql
SELECT 
    DATE(visit_timestamp) as date,
    COUNT(DISTINCT session_id) as conversions,
    COUNT(DISTINCT CASE WHEN uploaded_image THEN session_id END) as uploads,
    COUNT(DISTINCT CASE WHEN completed_analysis THEN session_id END) as completions
FROM app_page_visits
WHERE referrer LIKE '%(source: result_page%'
GROUP BY DATE(visit_timestamp)
ORDER BY date DESC;
```

### 7. Most Engaged Converters

```sql
SELECT 
    SUBSTRING(referrer FROM 'phone: ([0-9]+)') as phone_number,
    COUNT(*) as app_visits,
    MAX(uploaded_image::int) > 0 as uploaded,
    MAX(completed_analysis::int) > 0 as completed,
    AVG(time_on_page_seconds) as avg_time,
    AVG(scroll_depth_percent) as avg_scroll
FROM app_page_visits
WHERE referrer LIKE '%(source: result_page%'
GROUP BY phone_number
ORDER BY app_visits DESC, avg_time DESC
LIMIT 20;
```

### 8. Conversion Source Breakdown

```sql
SELECT 
    CASE 
        WHEN referrer LIKE '%/results/%' THEN 'Result Page Button'
        WHEN referrer LIKE '%direct%' THEN 'Direct Visit'
        ELSE 'Other'
    END as source,
    COUNT(*) as visits,
    COUNT(DISTINCT device_id) as unique_users
FROM app_page_visits
GROUP BY source
ORDER BY visits DESC;
```

## 🎯 Key Metrics to Track

### Conversion Rate
```
(Users who clicked button / Total result page users) × 100
```

### Upload Rate After Conversion
```
(Conversions who uploaded / Total conversions) × 100
```

### Complete Re-engagement Rate
```
(Conversions who completed new analysis / Total conversions) × 100
```

## 📈 Success Indicators

### High Engagement:
- ✅ Conversion rate > 20%
- ✅ Upload rate after conversion > 50%
- ✅ Time on page > 30 seconds

### Medium Engagement:
- 🟡 Conversion rate 10-20%
- 🟡 Upload rate 25-50%
- 🟡 Time on page 15-30 seconds

### Low Engagement:
- 🔴 Conversion rate < 10%
- 🔴 Upload rate < 25%
- 🔴 Time on page < 15 seconds

## 💡 Optimization Tips

### If Conversion Rate is Low:
1. Make button more prominent
2. Add urgency ("Try another image now!")
3. Offer incentive ("Get 3 free searches")

### If Users Click But Don't Upload:
1. Simplify upload flow
2. Add example images
3. Show success stories

### If Users Upload But Don't Complete:
1. Check for errors in analysis
2. Improve loading speed
3. Add progress indicators

## 🔗 Combined Journey View

See complete user journey from SMS → Result Page → Main App:

```sql
WITH result_visits AS (
    SELECT 
        phone_number,
        COUNT(*) as result_page_visits,
        MAX(clicked_products::int) as clicked_products
    FROM result_page_visits
    GROUP BY phone_number
),
app_visits AS (
    SELECT 
        SUBSTRING(referrer FROM 'phone: ([0-9]+)') as phone_number,
        COUNT(*) as main_app_visits,
        MAX(uploaded_image::int) as uploaded,
        MAX(completed_analysis::int) as completed
    FROM app_page_visits
    WHERE referrer LIKE '%(source: result_page%'
    GROUP BY phone_number
)
SELECT 
    r.phone_number,
    r.result_page_visits,
    r.clicked_products,
    COALESCE(a.main_app_visits, 0) as converted_to_app,
    COALESCE(a.uploaded, 0) as uploaded_new,
    COALESCE(a.completed, 0) as completed_new,
    CASE 
        WHEN a.main_app_visits IS NULL THEN 'No conversion'
        WHEN a.uploaded = 0 THEN 'Clicked button only'
        WHEN a.completed = 0 THEN 'Uploaded but not completed'
        ELSE 'Full re-engagement!'
    END as engagement_level
FROM result_visits r
LEFT JOIN app_visits a ON a.phone_number = r.phone_number
ORDER BY r.result_page_visits DESC, a.main_app_visits DESC;
```

## 🎁 Export for Re-engagement Campaign

```sql
-- Users who converted and uploaded (hot leads!)
SELECT 
    SUBSTRING(referrer FROM 'phone: ([0-9]+)') as phone_number,
    COUNT(*) as app_visits,
    MAX(visit_timestamp) as last_visit,
    'Converted and uploaded - HIGH PRIORITY' as note
FROM app_page_visits
WHERE referrer LIKE '%(source: result_page%'
  AND uploaded_image = true
GROUP BY phone_number
ORDER BY app_visits DESC;
```

Save as CSV and follow up with these engaged users! 🎯

---

**Summary:** Every click of "다른 이미지도 찾아보기" is now tracked with the user's phone number, giving you complete visibility into who's converting from result pages to your main app! 🚀

