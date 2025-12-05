# Test Plan: Shareable Results Feature

## Setup Steps

### 1. Database Setup
```bash
# Run this in your Supabase SQL Editor
# Copy and paste the contents of: supabase_shared_results_schema.sql
```

### 2. Verify Environment Variables
```bash
# Check these are set in .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or your production URL
```

### 3. Start Development Server
```bash
npm run dev
# Server should start on http://localhost:3000
```

## Test Cases

### Test 1: Create Shareable Link
**Steps:**
1. Go to http://localhost:3000
2. Upload an image (use the hoodie image from the screenshot)
3. Wait for search results
4. Scroll down to the bottom action bar
5. Click "결과 공유하기" (Share Results) button

**Expected Results:**
- Button shows loading state ("링크 생성 중...")
- Console shows: `🔗 Creating shareable link...`
- Console shows: `💾 Saving shared results...`
- Console shows: `✅ Share link created and copied: http://localhost:3000/results/{uuid}`
- Button turns green with checkmark
- Text changes to "링크가 클립보드에 복사되었습니다!"
- Success popup appears above button
- Link is in clipboard (try pasting)

### Test 2: Open Shared Link
**Steps:**
1. After Test 1, copy the share URL from console
2. Open a new incognito/private browser window
3. Paste and navigate to the URL

**Expected Results:**
- Page loads successfully
- Shows "공유된 검색 결과" header
- Shows creation date/time
- Displays all products from original search
- Cropped item images visible
- Products are clickable
- NO phone modal appears
- NO share button appears (it's already shared)

### Test 3: View Counter
**Steps:**
1. Open the shared link from Test 2
2. Check Supabase dashboard → `shared_results` table
3. Find the row with matching ID
4. Note the `view_count` value
5. Refresh the page
6. Check `view_count` again

**Expected Results:**
- Initial `view_count` = 1
- After refresh, `view_count` = 2
- `last_viewed_at` timestamp updates

### Test 4: Multiple Categories
**Steps:**
1. Upload an image with multiple items (e.g., outfit with top + bottom + shoes)
2. Select all items in the interactive selector
3. Wait for all results
4. Click share button

**Expected Results:**
- All categories are saved
- Shared link shows all categories with correct product counts
- Each category section displays properly

### Test 5: Share Link Persistence
**Steps:**
1. Create a share link
2. Close browser completely
3. Wait 1 minute
4. Open browser again
5. Paste the share link

**Expected Results:**
- Link still works
- All data loads correctly
- No errors in console

### Test 6: API Error Handling
**Steps:**
1. Temporarily disconnect internet
2. Try to create share link
3. Reconnect internet
4. Try again

**Expected Results:**
- First attempt shows error alert
- Second attempt succeeds

## Console Log Checklist

When testing, you should see these logs:

### Creating Share Link:
```
🔗 Creating shareable link...
💾 Saving shared results...
   Categories: 1
   Total products: 3
✅ Shared results saved: {uuid}
   Share URL: http://localhost:3000/results/{uuid}
✅ Share link created and copied: http://localhost:3000/results/{uuid}
```

### Viewing Shared Link:
```
🔗 Loading shared results: {uuid}
👁️ Shared view detected, skipping phone modal
✅ Shared results loaded: {categories: 1, totalProducts: 3}
👁️ Shared results viewed: {uuid} (views: 2)
```

## Database Verification

### Check Data in Supabase:
1. Go to Supabase Dashboard
2. Navigate to Table Editor
3. Open `shared_results` table
4. Verify row exists with:
   - ✅ UUID in `id` column
   - ✅ Current timestamp in `created_at`
   - ✅ JSON data in `results` column
   - ✅ Image URL in `original_image_url`
   - ✅ Items array in `selected_items`
   - ✅ View count increments
   - ✅ `deleted_at` is NULL

## Common Issues & Solutions

### Issue: "Failed to create share link"
**Solution:**
- Check Supabase connection in console
- Verify environment variables are set
- Check if table was created successfully
- Check RLS policies are enabled

### Issue: Share link returns 404
**Solution:**
- Verify the UUID is correct
- Check if row exists in database
- Check if `deleted_at` is NULL
- Verify Next.js dynamic route is working

### Issue: Clipboard copy doesn't work
**Solution:**
- Use HTTPS (clipboard API requires secure context)
- Check browser permissions
- Try manually copying from console log

### Issue: Phone modal appears on shared view
**Solution:**
- Verify `isSharedView={true}` prop is passed
- Check console for "Shared view detected" log
- Clear localStorage and try again

## Performance Benchmarks

Expected timings:
- Share link creation: < 2 seconds
- Shared page load: < 3 seconds
- View count update: < 500ms

## Success Criteria

✅ All 6 test cases pass
✅ No errors in browser console
✅ No errors in server logs
✅ Database entries created correctly
✅ View counter increments
✅ Links work in incognito mode
✅ Phone modal doesn't appear for shared views
✅ Share button copies to clipboard
✅ UI transitions are smooth

## Ready for Production?

Before deploying:
- [ ] All tests pass
- [ ] Database table created in production
- [ ] Environment variables set in Vercel/hosting
- [ ] HTTPS enabled (required for clipboard API)
- [ ] Test share links work across devices
- [ ] Check mobile responsiveness
- [ ] Verify social media link previews (og:image)

---

## Quick Test Command Sequence

```bash
# 1. Setup
cd /Users/levit/Desktop/mvp
npm run dev

# 2. Test in browser
# - Open http://localhost:3000
# - Upload hoodie image
# - Click share button
# - Copy link from console
# - Open link in incognito tab

# 3. Verify in database
# - Open Supabase dashboard
# - Check shared_results table
# - Verify row exists and view_count increments
```

---

**Test Status:** ⏳ Ready to test
**Last Updated:** December 2024

