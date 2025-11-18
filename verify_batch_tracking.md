# 🔍 Batch User Tracking Verification

## ✅ What WILL Be Tracked:

### 1. **Result Page Opens** ✅
- **Tracked in:** `result_page_visits` table
- **API:** `/api/track-visit`
- **Shows in analytics:** Yes (as "Visited Results")

### 2. **"다른 이미지도 찾아보기" Button Clicks** ✅
- **Tracked in:** `app_page_visits` table
- **Format:** `referrer` field contains `(source: result_page, phone: XXXXX)`
- **Shows in analytics:** Yes (tracked as app visit with conversion source)

### 3. **If They Upload New Image** ✅
- **Tracked in:** `sessions` table + `events` table (image_upload)
- **SessionManager:** Will create session on main app page load
- **Shows in analytics:** Yes (will show as "Uploaded Image")

### 4. **GPT Selection** ✅
- **Tracked in:** `events` table (gpt_product_selection or items_selected)
- **Shows in analytics:** Yes (will show as "GPT Selection")

### 5. **Results Shown** ✅
- **Tracked in:** `events` table (final_results_displayed)
- **Shows in analytics:** Yes (will show as "Results Shown")

### 6. **Clicked Products** ✅
- **Tracked in:** `link_clicks` table
- **Linked by:** session_id
- **Shows in analytics:** Yes (will show as "Clicked Product")

### 7. **Feedback on Original Result Page** ✅
- **Tracked in:** `user_feedback` table
- **Matched by:** phone_number
- **Shows in analytics:** Yes (will show as "Feedback")

## ⚠️ IMPORTANT: How Batch Users Will Appear

### Scenario A: User ONLY Views Result Page
- **Badge:** "📧 Batch User"
- **Timeline:** 
  - ✅ Visited Results
  - ✅ Feedback (if given)
- **Uploads:** 0
- **Searches:** 0

### Scenario B: User Clicks Button → Uploads New Image
- **Badge:** "📱 Main App User" (will show BOTH journeys!)
- **Timeline:**
  - ✅ Visited Results (from original batch)
  - ✅ Feedback (from original batch, if given)
  - ✅ Uploaded Image (new)
  - ✅ GPT Selection (new)
  - ✅ Results Shown (new)
  - ✅ Clicked Product (new, if clicked)
  - ✅ Feedback (new, if given on new results)
- **Uploads:** 1+
- **Searches:** 1+

## 🎯 What To Look For After Sending SMS:

1. Go to `/analytics/users`
2. Filter by "Batch Only" to see users who only viewed result pages
3. Filter by "All" to see everyone (including conversions)
4. Click on any user to see their detailed horizontal timeline

## ✅ Everything is Ready!

All tracking is in place. The critical session bug was fixed and deployed.
