# Setup Background Job Processing

Your background job system isn't working because the database table doesn't exist or has the wrong schema.

## Quick Fix (5 minutes)

### Step 1: Create the Database Table

1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste this SQL:

```sql
-- Create search_jobs table
CREATE TABLE IF NOT EXISTS search_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  phone_number TEXT,
  country_code TEXT,
  original_image_url TEXT,
  job_data JSONB,
  results JSONB,
  meta JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_search_jobs_job_id ON search_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_search_jobs_status ON search_jobs(status);
CREATE INDEX IF NOT EXISTS idx_search_jobs_created_at ON search_jobs(created_at);

-- Enable RLS
ALTER TABLE search_jobs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all for service role" ON search_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow reading job results" ON search_jobs
  FOR SELECT
  USING (true);
```

5. Click **Run** (or press `Cmd + Enter`)
6. You should see: `Success. No rows returned`

### Step 2: Verify the Table

Run this query to check the table was created:

```sql
SELECT * FROM search_jobs LIMIT 10;
```

You should see an empty table with the correct columns.

### Step 3: Test It

1. Deploy your latest code (should auto-deploy from git push)
2. Upload an image on your website
3. Check the logs - you should see:
   - `💾 Saved job job_xxx to database successfully`
   - NOT `❌ Failed to save job to database`

4. Check the database:
```sql
SELECT job_id, status, progress, created_at 
FROM search_jobs 
ORDER BY created_at DESC 
LIMIT 5;
```

You should see your job with `status = 'pending'`.

### Step 4: Trigger the Cron

Wait 60 seconds for the cron to run automatically, OR manually trigger it:

Visit: `https://fashionsource.vercel.app/api/cron/trigger-manual`

You should see:
```json
{
  "message": "Manual trigger complete",
  "cronResponse": {
    "message": "Cron job completed",
    "processed": 1,
    "successful": 1
  }
}
```

## How It Works

### Normal Flow:
1. **Frontend** → Creates job → Saves to DB (status: `pending`)
2. **Vercel Cron** (every 60 sec) → Finds `pending` jobs → Processes them
3. **Backend** → Completes job → Updates DB (status: `completed`)
4. **SMS** → Sent to user with results link

### Current Problem:
- Jobs failing to save to database (PGRST errors)
- Cron finds no jobs to process
- Users stuck at "searching" forever

### After Fix:
- Jobs save successfully ✅
- Cron processes them every minute ✅
- Users get SMS when complete ✅
- Frontend can close and job continues ✅

## Troubleshooting

### Still getting "Job not found"?

1. **Check if job was created:**
```sql
SELECT * FROM search_jobs ORDER BY created_at DESC LIMIT 1;
```

2. **Check server logs for save errors:**
Look for: `❌ Failed to save job to database`

3. **Check cron is running:**
Look for: `✅ No pending jobs to process` or `📋 Found X pending job(s)`

4. **Manually trigger cron:**
Visit: `/api/cron/trigger-manual`

### Database permission errors?

Make sure your Supabase service role key is set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Alternative: Disable Background Processing

If you can't set up the database table, you can revert to synchronous processing (frontend waits for results):

In `/app/api/search-job/route.ts`, change line ~33:

```typescript
// Current (background):
return NextResponse.json({
  jobId: job.id,
  status: 'pending',
  message: 'Job queued!'
})

// Revert to synchronous:
await processSearchJob(job.id, body)
const completedJob = await getJob(job.id)
return NextResponse.json({
  jobId: job.id,
  status: 'completed',
  results: completedJob?.results
})
```

⚠️ **Downside:** If user closes browser, job dies.

