# 📋 User Logging Setup Checklist

Follow these steps to enable user tracking and phone number collection.

---

## ✅ Step 1: Run Database Schema

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy contents of `supabase_logging_schema.sql`
4. Paste and run
5. Verify 4 tables created: `users`, `sessions`, `events`, `link_clicks`

**Verification:**
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'sessions', 'events', 'link_clicks');
```

Should return 4 rows.

---

## ✅ Step 2: Add Service Role Key to Vercel

### Where to Find It:
1. Supabase Dashboard → Settings → API
2. Look for **"service_role"** key (secret key)
3. Copy the key (starts with `eyJ...`)

### Add to Vercel:
1. Go to Vercel project settings
2. Environment Variables
3. Add new variable:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** `eyJ...` (your service role key)
   - **Environment:** All (Production, Preview, Development)
4. Click "Save"

**⚠️ IMPORTANT:** This key has full database access. Never expose it to the client!

---

## ✅ Step 3: Verify Existing Environment Variables

Make sure these are set in Vercel:

```
✓ NEXT_PUBLIC_SUPABASE_URL
✓ NEXT_PUBLIC_SUPABASE_ANON_KEY
✓ SUPABASE_SERVICE_ROLE_KEY  ← NEW! Must add this
✓ BACKEND_URL
✓ SERPER_API_KEY
✓ OPENAI_API_KEY
```

---

## ✅ Step 4: Deploy to Vercel

```bash
git add .
git commit -m "Add user logging system with phone collection"
git push
```

Vercel will auto-deploy. Wait 1-2 minutes.

---

## ✅ Step 5: Test the System

### Test Flow:
1. Visit your deployed site
2. Upload an image
3. Wait for AI analysis
4. Select items to search
5. **Phone modal should appear over results** 📱
6. Enter test phone: `010-1234-5678`
7. Click modal button
8. **Links should become clickable**
9. Click a product link

### Verify in Supabase:

**Check Sessions:**
```sql
SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1;
```

Should show your session with uploaded image, analysis, etc.

**Check Users:**
```sql
SELECT * FROM users WHERE phone_number = '01012345678';
```

Should show your test phone number.

**Check Events:**
```sql
SELECT event_type, created_at FROM events 
ORDER BY created_at DESC LIMIT 10;
```

Should show: `image_upload`, `gpt_analysis`, `items_selected`, `phone_provided`, etc.

**Check Link Clicks:**
```sql
SELECT * FROM link_clicks ORDER BY clicked_at DESC LIMIT 5;
```

Should show your clicked links.

---

## ✅ Step 6: Test Returning User

1. Open site in **same browser** (uses localStorage)
2. Upload a new image
3. Go through flow
4. Phone modal should say: **"다시 찾아주셨네요! 👋"** (Welcome back!)
5. Enter phone again (still required)
6. Check Supabase:

```sql
SELECT phone_number, total_searches FROM users 
WHERE phone_number = '01012345678';
```

`total_searches` should be 2.

---

## 🎨 What You Should See

### Phone Modal (Post-it Style):
- Yellow gradient background
- Rotating animation (subtle)
- "Tape" effect at top
- Phone input with auto-formatting
- Clear call-to-action button
- Privacy notice at bottom

### Blurred Product Links:
- Product images slightly blurred
- Small yellow "post-it" overlay: "🔒 전화번호 입력 후 확인 가능합니다"
- Links are NOT clickable until phone submitted

### After Phone Submission:
- Modal disappears
- Blur removed
- Links fully clickable
- Clicks are tracked

---

## 🐛 Troubleshooting

### Issue: Phone modal doesn't appear
**Fix:**
- Check browser console for errors
- Verify `PhoneModal` component exists in `app/components/`
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Issue: "Failed to log" errors in console
**Fix:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- Redeploy after adding the key
- Check Supabase logs for RLS errors

### Issue: Data not saving to database
**Fix:**
- Run `supabase_logging_schema.sql` again
- Verify RLS policies are enabled
- Check if service role key has correct permissions

### Issue: Phone validation fails
**Fix:**
- Use Korean phone format: 010-XXXX-XXXX
- Must start with 010
- Auto-formatting should work as you type

---

## 📊 View Your Data

### Quick Query - Recent Activity:
```sql
SELECT 
    s.created_at,
    s.phone_number,
    jsonb_array_length(s.gpt_analysis->'items') as items_detected,
    jsonb_array_length(s.selected_items) as items_selected,
    (SELECT COUNT(*) FROM link_clicks WHERE session_id = s.id) as links_clicked
FROM sessions s
WHERE s.phone_number IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 10;
```

### Dashboard View:
Use the `session_analytics` view for easy querying:
```sql
SELECT * FROM session_analytics 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY total_clicks DESC;
```

---

## 🎉 Success Criteria

You're done when:
- ✅ Phone modal appears after search results
- ✅ Modal has yellow "post-it" design
- ✅ Product links are blurred before phone submission
- ✅ Phone number validates Korean format (010-XXXX-XXXX)
- ✅ Links become clickable after phone submission
- ✅ Data appears in Supabase tables
- ✅ Returning users see welcome message
- ✅ Link clicks are tracked
- ✅ No errors in console

---

## 📞 Next Steps: User Interviews

Once you have 10+ phone numbers:

1. Export list:
```sql
SELECT phone_number, total_searches, last_active_at 
FROM users 
ORDER BY total_searches DESC;
```

2. Review their sessions to understand behavior

3. Call for interviews:
   - "안녕하세요! 저희 패션 검색 서비스를 사용해주셔서 감사합니다"
   - Ask about their experience
   - Take notes in `users.notes` field

4. Iterate based on feedback

---

## 📖 Full Documentation

See `USER_LOGGING_GUIDE.md` for:
- Complete database schema
- All tracking details
- Query examples
- Privacy considerations
- Analytics ideas

---

**Need help?** Check console for detailed error messages and session IDs.

