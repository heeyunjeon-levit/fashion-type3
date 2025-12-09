# 📱 SMS Notification Setup Guide

Your app now supports sending search results via SMS! Users can provide their phone number and receive a text message with a link to their results when the search completes.

---

## 🚀 Quick Setup (5 minutes)

### 1. Create Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free account
3. Verify your email and phone number
4. You'll get **$15 free credit** to test with!

### 2. Get Your Twilio Credentials

After signing up:

1. Go to **Console Dashboard**: [https://console.twilio.com/](https://console.twilio.com/)
2. Find these credentials:
   - **Account SID**: Starts with `AC...`
   - **Auth Token**: Click "View" to reveal it

### 3. Get a Twilio Phone Number

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Choose your country (Korea recommended: `+82`)
3. Click **Search** and select a number
4. Click **Buy** (free with trial credit!)
5. Your number will look like: `+821234567890`

### 4. Add Environment Variables

Add these to your `.env.local` file:

```bash
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

# Base URL for SMS links (change to your production domain when deploying)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Example:**
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_from_twilio_console
TWILIO_PHONE_NUMBER=+821234567890
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 5. Create Supabase Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of supabase_search_jobs_migration.sql
```

Or use the Supabase CLI:
```bash
supabase db push supabase_search_jobs_migration.sql
```

### 6. Restart Your Server

```bash
npm run dev
```

---

## ✅ Testing

### Test SMS Notifications

1. Start your dev server: `npm run dev`
2. Upload a fashion image
3. Select items to search
4. **Enter your phone number** when prompted
5. Click search
6. **Wait 1-2 minutes**
7. **You'll receive an SMS** with a link like: `http://localhost:3000/results/job_abc123`
8. Click the link to view your results!

### During Trial Period

⚠️ **Important**: Twilio trial accounts can only send SMS to **verified phone numbers**

To test:
1. Go to Twilio Console → **Phone Numbers** → **Manage** → **Verified Caller IDs**
2. Click **Add a new Caller ID**
3. Enter your test phone number
4. Verify it with the code Twilio sends you
5. Now you can send SMS to this number!

---

## 🌐 Production Deployment

### 1. Update Environment Variables

When deploying to production (Vercel):

```bash
# In Vercel Dashboard → Settings → Environment Variables
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### 2. Upgrade Twilio Account

For production use:
1. Go to Twilio Console → **Billing**
2. Add payment method
3. Upgrade to paid account
4. Now you can send SMS to **any phone number** (not just verified ones)

### 3. Pricing

Twilio SMS pricing (as of 2025):
- **Outbound SMS (Korea)**: ~$0.06 per message
- **Outbound SMS (US)**: ~$0.0079 per message
- Very affordable for your use case!

---

## 💡 How It Works

### User Flow

```
1. User uploads image + enters phone number
   ↓
2. Server creates background job
   ↓
3. Server returns job ID immediately
   ↓
4. User can close the app/browser
   ↓
5. Server processes search (30-50 seconds)
   ↓
6. When complete, server sends SMS:
   "✨ Your fashion search is ready! View your results here: 
    https://yourdomain.com/results/job_abc123"
   ↓
7. User clicks link → Views results
```

### Technical Flow

```
Frontend (page.tsx)
   ↓ POST /api/search-job
   ↓ {phoneNumber: "+821234567890", ...}
   ↓
Backend (search-job/route.ts)
   ↓ Creates job with phone number
   ↓ Starts background processing
   ↓ Returns job ID immediately
   ↓
Background Processing
   ↓ Searches for products (30-50s)
   ↓ Saves results to Supabase
   ↓ Calls sendSearchResultsNotification()
   ↓
Twilio SMS Service
   ↓ Sends SMS with results link
   ↓
User clicks link
   ↓ /results/[jobId]
   ↓ Loads results from Supabase
   ↓ Displays ResultsBottomSheet
```

---

## 🔒 Security Notes

### Phone Number Privacy

- Phone numbers are stored in Supabase `search_jobs` table
- Only completed jobs are publicly readable (via RLS policy)
- Phone numbers are NOT exposed in results page
- Consider adding phone number hashing for extra privacy

### SMS Link Security

- Job IDs are random: `job_1234567890_abc123`
- Links expire after 7 days (configurable)
- No authentication required (shareable links)
- Consider adding optional PIN codes for sensitive searches

---

## 🐛 Troubleshooting

### "Twilio credentials not configured"

**Solution**: Make sure you added all 3 Twilio env variables to `.env.local` and restarted your server

### "SMS not received"

**Possible causes**:
1. **Trial account**: Phone number not verified in Twilio
2. **Wrong format**: Phone number must include country code (e.g., `+821234567890`)
3. **Twilio balance**: Check your Twilio balance
4. **Check logs**: Look in terminal for "SMS sent successfully" or error messages

### "Job not found" when clicking SMS link

**Possible causes**:
1. **Server restarted**: Jobs are in-memory, restart clears them
   - **Solution**: Job is saved to Supabase, should load from there
2. **Database not set up**: Run the SQL migration
3. **Job expired**: Jobs older than 7 days are cleaned up

### "Results page shows loading forever"

**Solution**: Check browser console (F12) for errors. Likely API route issue.

---

## 📊 Monitoring

### Check SMS Status

View all SMS sent by your app:
1. Go to Twilio Console → **Monitor** → **Logs** → **Messaging**
2. See delivery status, timestamps, errors

### Track Usage

- Twilio Console shows: Message count, costs, delivery rates
- Monitor `search_jobs` table in Supabase for job completion rates

---

## 🎉 You're All Set!

Your app now supports:
- ✅ Background job processing
- ✅ SMS notifications with results links
- ✅ Shareable results pages
- ✅ Persistent storage in Supabase

Users can now:
1. Start a search
2. Close the app
3. Receive SMS when ready
4. View results anytime via link

---

## 📝 Next Steps (Optional)

### Enhancements

1. **Add phone number input UI** (currently needs to be added to frontend)
2. **Customize SMS message** (brand name, custom text)
3. **Add SMS opt-out** (for marketing compliance)
4. **Add retry logic** (if Twilio fails)
5. **Track SMS delivery** (save delivery status in database)
6. **Add internationalization** (SMS in user's language)

### Cost Optimization

- **Batch notifications** (send 1 SMS for multiple completed jobs)
- **Use push notifications instead** (free, requires app install)
- **Add SMS/Push toggle** (let users choose)

---

**Questions?** Check Twilio docs: https://www.twilio.com/docs/sms

**Ready to test?** Run `npm run dev` and try uploading an image! 🚀

