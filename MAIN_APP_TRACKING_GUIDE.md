# 📊 Main MVP App Tracking Guide

## Overview

Track every visit to your main MVP application to understand user behavior and optimize conversion!

## 🚀 Quick Setup

### Step 1: Create Supabase Table

```bash
# Copy the SQL file:
cat supabase_main_app_tracking_schema.sql
```

Then run in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

### Step 2: Add Tracking to Your Pages

The tracking hook is already created! Just add it to your pages:

#### Homepage Example (`app/page.tsx`):

```typescript
'use client'

import { usePageTracking } from '@/lib/hooks/usePageTracking'

export default function HomePage() {
  // Add this line - that's it!
  usePageTracking()

  return (
    <div>
      {/* Your homepage content */}
    </div>
  )
}
```

#### Upload Page with Actions (`app/upload/page.tsx`):

```typescript
'use client'

import { useState } from 'react'
import { usePageTracking } from '@/lib/hooks/usePageTracking'

export default function UploadPage() {
  const [uploadedImage, setUploadedImage] = useState(false)

  // Track when user uploads an image
  usePageTracking({ 
    uploadedImage: uploadedImage 
  })

  const handleUpload = async () => {
    // ... your upload logic
    setUploadedImage(true) // This triggers tracking update!
  }

  return (
    <div>
      <button onClick={handleUpload}>Upload</button>
    </div>
  )
}
```

#### Analysis Page (`app/analyze/page.tsx`):

```typescript
'use client'

import { useState } from 'react'
import { usePageTracking } from '@/lib/hooks/usePageTracking'

export default function AnalyzePage() {
  const [completedAnalysis, setCompletedAnalysis] = useState(false)

  usePageTracking({ 
    completedAnalysis: completedAnalysis 
  })

  const handleAnalyze = async () => {
    // ... analysis logic
    setCompletedAnalysis(true) // Tracked!
  }

  return <div>{/* content */}</div>
}
```

### Step 3: Deploy

```bash
git add -A
git commit -m "Add main app tracking"
git push origin main
```

## 📈 What Gets Tracked

### Automatic:
- ✅ **Page path** - Which page they visited
- ✅ **Session ID** - Unique per browser session
- ✅ **Device ID** - Unique per device (persists long-term)
- ✅ **Time on page** - How long they stayed
- ✅ **Scroll depth** - How far they scrolled (0-100%)
- ✅ **Referrer** - Where they came from
- ✅ **User agent** - Browser/device info
- ✅ **New session** - First visit in this browser session

### Optional (pass to hook):
- ✅ **uploadedImage** - Did they upload?
- ✅ **completedAnalysis** - Did they complete analysis?
- ✅ **clickedSearch** - Did they click search?

## 🔍 Analytics Queries

### 1. Page Popularity

```sql
SELECT * FROM page_popularity;
```

See which pages get most traffic!

### 2. User Funnel (Conversion Rate)

```sql
SELECT * FROM user_funnel;
```

Shows:
- Homepage visits
- Upload rate
- Completion rate
- Drop-off points

### 3. Session Summary (User Journeys)

```sql
SELECT 
    session_id,
    user_journey,
    uploaded_image,
    completed_analysis,
    total_time_seconds
FROM session_summary
LIMIT 20;
```

Example output:
```
session_123 | / → /upload → /analyze | true | true | 145
```

### 4. Daily Activity

```sql
SELECT * FROM daily_activity
ORDER BY date DESC
LIMIT 7;
```

See trends over the last week!

### 5. Conversion Funnel Detailed

```sql
WITH funnel AS (
    SELECT 
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(DISTINCT CASE WHEN page_path = '/' THEN session_id END) as homepage,
        COUNT(DISTINCT CASE WHEN uploaded_image THEN session_id END) as uploads,
        COUNT(DISTINCT CASE WHEN completed_analysis THEN session_id END) as analyses
    FROM app_page_visits
)
SELECT 
    total_sessions,
    homepage,
    uploads,
    ROUND(uploads::numeric / homepage::numeric * 100, 1) as upload_conversion,
    analyses,
    ROUND(analyses::numeric / uploads::numeric * 100, 1) as analysis_conversion
FROM funnel;
```

### 6. Average Time Per Page

```sql
SELECT 
    page_path,
    COUNT(*) as visits,
    ROUND(AVG(time_on_page_seconds), 1) as avg_seconds,
    ROUND(AVG(scroll_depth_percent), 1) as avg_scroll_percent
FROM app_page_visits
WHERE time_on_page_seconds IS NOT NULL
GROUP BY page_path
ORDER BY visits DESC;
```

### 7. User Engagement Score

```sql
SELECT 
    device_id,
    COUNT(DISTINCT session_id) as sessions,
    COUNT(*) as page_views,
    ROUND(AVG(time_on_page_seconds), 1) as avg_time,
    MAX(uploaded_image::int) as has_uploaded,
    MAX(completed_analysis::int) as has_completed,
    ROUND(AVG(scroll_depth_percent), 1) as avg_scroll
FROM app_page_visits
GROUP BY device_id
HAVING COUNT(DISTINCT session_id) > 1
ORDER BY sessions DESC, avg_time DESC
LIMIT 20;
```

### 8. Drop-off Analysis

```sql
WITH session_paths AS (
    SELECT 
        session_id,
        STRING_AGG(page_path, ' → ' ORDER BY visit_timestamp) as journey,
        MAX(uploaded_image::int) > 0 as uploaded,
        MAX(completed_analysis::int) > 0 as completed
    FROM app_page_visits
    GROUP BY session_id
)
SELECT 
    CASE 
        WHEN NOT uploaded THEN 'Dropped before upload'
        WHEN uploaded AND NOT completed THEN 'Dropped before analysis'
        WHEN completed THEN 'Completed full flow'
    END as user_status,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM session_paths)::numeric * 100, 1) as percent
FROM session_paths
GROUP BY user_status
ORDER BY count DESC;
```

## 🎯 Recommended Pages to Track

### Must Track:
1. **Homepage** (`/`) - Entry point
2. **Upload** (`/upload`) - First action
3. **Analyze** (`/analyze`) - Core feature
4. **Results** (if in app) - Final output

### Nice to Track:
5. **About/FAQ** - Learn more pages
6. **Pricing** (if applicable)
7. **Contact** - Support pages

## 🎁 Combined Analytics (Main App + Result Pages)

### Full User Journey

```sql
-- Combine main app visits with result page visits
SELECT 
    'Main App' as source,
    session_id,
    page_path,
    visit_timestamp
FROM app_page_visits

UNION ALL

SELECT 
    'Result Page' as source,
    session_id,
    'results/' || phone_number as page_path,
    visit_timestamp
FROM result_page_visits

ORDER BY visit_timestamp DESC
LIMIT 50;
```

### Complete Conversion Funnel

```sql
SELECT 
    (SELECT COUNT(DISTINCT session_id) FROM app_page_visits WHERE page_path = '/') as homepage_visits,
    (SELECT COUNT(DISTINCT session_id) FROM app_page_visits WHERE uploaded_image) as uploads,
    (SELECT COUNT(DISTINCT session_id) FROM app_page_visits WHERE completed_analysis) as analyses,
    (SELECT COUNT(DISTINCT phone_number) FROM result_page_visits) as result_page_views,
    (SELECT COUNT(DISTINCT phone_number) FROM user_feedback WHERE satisfaction = '만족') as satisfied_users;
```

## 💡 Pro Tips

### 1. Track Custom Events

You can extend the hook to track custom actions:

```typescript
const [clickedFeature, setClickedFeature] = useState(false)

usePageTracking({ 
  clickedSearch: clickedFeature // Reuse existing fields
})

<button onClick={() => setClickedFeature(true)}>
  Search
</button>
```

### 2. Session vs Device ID

- **Session ID**: Changes when browser closes (tracks single visit session)
- **Device ID**: Persists forever (tracks returning users across sessions)

### 3. Scroll Depth

- High scroll depth (>80%) = engaged user
- Low scroll depth (<30%) = bounce/not interested

### 4. Time on Page

- <5 seconds = bounce
- 10-30 seconds = interested
- >60 seconds = highly engaged

## 🚨 Privacy Note

This tracking is **anonymous** and **privacy-friendly**:
- No personal data collected
- No cookies (uses sessionStorage + localStorage)
- No third-party trackers
- Fully under your control

## 📊 Success Metrics

### Track These KPIs:

1. **Conversion Rate**: `uploads / homepage_visits`
2. **Completion Rate**: `analyses / uploads`
3. **Return Rate**: `sessions > 1 / total_devices`
4. **Engagement**: `avg_time_on_page`
5. **Satisfaction**: From feedback table

### Weekly Report Query:

```sql
SELECT 
    'This Week' as period,
    COUNT(DISTINCT session_id) as total_sessions,
    COUNT(DISTINCT device_id) as unique_users,
    SUM(CASE WHEN uploaded_image THEN 1 ELSE 0 END) as uploads,
    SUM(CASE WHEN completed_analysis THEN 1 ELSE 0 END) as analyses,
    ROUND(AVG(time_on_page_seconds), 1) as avg_time,
    ROUND(AVG(scroll_depth_percent), 1) as avg_scroll
FROM app_page_visits
WHERE visit_timestamp > NOW() - INTERVAL '7 days';
```

---

Happy tracking! 📊 You now have **complete visibility** into your user journey! 🎉

