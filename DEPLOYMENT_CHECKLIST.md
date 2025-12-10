# 🚀 Deployment Checklist - Database Persistence Fix

## ⚠️ Critical: Complete BEFORE deploying

### Step 1: Verify Database Migration

Check if the `search_jobs` table already exists:

```sql
-- In Supabase SQL Editor, run:
SELECT * FROM search_jobs LIMIT 1;
```

**If table doesn't exist:**
```sql
-- Run the full migration:
-- File: supabase_search_jobs_migration.sql
```

**Expected result:** Table created with all indexes and RLS policies

---

### Step 2: Verify Environment Variables

Ensure these are set in **production** (Vercel/your host):

```env
# Required for reading data (already have)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# ⚠️ CRITICAL: Required for writing to database
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Where to find:**
1. Go to Supabase Dashboard
2. Settings → API
3. Copy `service_role` secret key
4. Add to Vercel Environment Variables

---

### Step 3: Test Locally First

```bash
# 1. Start dev server
npm run dev

# 2. Start a search with phone number
# (Use the UI)

# 3. Check Supabase logs
# Go to: Supabase Dashboard → Database → search_jobs
# You should see a new row created

# 4. Restart server (Ctrl+C, then npm run dev)

# 5. Poll the job API
curl http://localhost:3000/api/search-job/[job_id]

# ✅ Should return job data (loaded from DB)
```

---

### Step 4: Deploy to Production

```bash
# Push changes
git add .
git commit -m "Add database persistence for background jobs"
git push origin main

# Vercel will auto-deploy
```

---

### Step 5: Test in Production

**Critical Test: Close Phone**

1. Open your production site on mobile
2. Upload image and start search with phone number
3. **Immediately lock phone** or switch to another app
4. Wait 2-3 minutes
5. Check for SMS notification
6. Click SMS link
7. ✅ Results should load perfectly

**If it fails:**
- Check Vercel logs for errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check Supabase logs for DB errors

---

## 🔍 Verification Commands

### Check Database Connection
```typescript
// In Vercel logs or local console:
// Should see logs like:
✅ Created job job_123... (persisted to DB)
💾 Saved job job_123 to database
📂 Loaded job job_123 from database
```

### Check RLS Policies
```sql
-- In Supabase SQL Editor:
SELECT * FROM pg_policies WHERE tablename = 'search_jobs';

-- Should show 2 policies:
-- 1. Allow public read access to completed jobs
-- 2. Allow service role full access
```

### Check Job in Database
```sql
-- After creating a job, check:
SELECT job_id, status, progress, phone_number, created_at 
FROM search_jobs 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🎯 Success Indicators

You'll know it's working if:

1. ✅ Jobs appear in `search_jobs` table immediately
2. ✅ Progress updates show in database (5%, 8%, 11%, etc.)
3. ✅ "Job not found" errors disappear
4. ✅ Users can close phone and receive SMS
5. ✅ SMS links work even after server restart

---

## 🐛 Troubleshooting

### "Job not found" still occurring

**Solution:**
1. Check if job exists in database:
   ```sql
   SELECT * FROM search_jobs WHERE job_id = 'job_xxx';
   ```
2. If missing: Check service role key is set
3. If exists: Check RLS policies allow access

### Database save errors

**Common causes:**
- Missing `SUPABASE_SERVICE_ROLE_KEY`
- Wrong Supabase URL
- RLS policy blocking writes
- Table doesn't exist (run migration)

**Check logs for:**
```
❌ Failed to save job to database: [error message]
```

### SMS notifications not working

**Separate issue** - check:
- `SMS_NOTIFICATION_SETUP.md` for Twilio config
- Phone numbers are properly formatted
- Twilio credentials are correct

---

## 📊 Monitoring

### What to Monitor After Deploy

1. **Supabase Dashboard:**
   - Database → search_jobs table
   - Watch rows being created/updated
   - Check for any failed inserts

2. **Vercel Logs:**
   - Look for "persisted to DB" messages
   - Check for any database errors
   - Monitor job completion rate

3. **User Reports:**
   - Can they close their phones?
   - Do SMS notifications arrive?
   - Do SMS links work?

---

## 🧹 Optional: Database Cleanup

Set up automatic cleanup of old jobs (7+ days):

### Option A: Supabase Cron (Recommended)
```sql
-- Requires pg_cron extension
SELECT cron.schedule(
  'cleanup-old-jobs',
  '0 0 * * *',  -- Daily at midnight
  'SELECT cleanup_old_search_jobs()'
);
```

### Option B: Vercel Cron
```typescript
// pages/api/cron/cleanup.ts
export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  await cleanupOldJobs()
  res.json({ success: true })
}
```

---

## 📝 Rollback Plan

If something goes wrong:

```bash
# Revert the changes
git revert HEAD~3

# Redeploy
git push origin main
```

**Note:** This won't break anything - the system falls back to memory-only mode (single instance only).

---

## ✅ Final Checklist

Before considering this complete:

- [ ] Database migration ran successfully
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in production
- [ ] Tested locally with server restart
- [ ] Deployed to production
- [ ] Tested close phone → wait for SMS → click link
- [ ] Verified jobs appear in database
- [ ] Monitored logs for errors
- [ ] Confirmed no "job not found" errors
- [ ] Optional: Set up database cleanup cron

---

## 🎉 Success!

Once all checks pass, your system is **production-ready** with:

✅ True background processing
✅ Cross-instance compatibility
✅ Server restart resilience
✅ Close-phone-and-wait functionality
✅ Reliable SMS notifications
✅ Zero data loss

**Your MVP now works exactly as promised! 🚀**

