# 📱 SMS Notification Setup Guide

⚠️ **DEPRECATED**: This guide is for the old Twilio setup. The app now uses **NCP SENS** for SMS.

**Please refer to `NCP_SMS_SETUP.md` for the current setup instructions.**

---

## 🔄 Migration Notice

This app has been migrated from Twilio to **Naver Cloud Platform (NCP) SENS** for SMS notifications.

### Why the Change?

- **Cost-effective for Korean users**: NCP is optimized for Korea
- **Better pricing**: ₩8-50 per message vs Twilio's $0.06+
- **Local support**: Korean sender number registration
- **Batch sending**: Up to 100 messages per API call

### Migration Guide

See `TWILIO_TO_NCP_MIGRATION.md` for detailed migration instructions.

### New Setup Guide

See `NCP_SMS_SETUP.md` for complete NCP SENS setup instructions.

---

## 🚀 Quick Setup (NCP SENS)

### 1. Create NCP Account

1. Go to [https://console.ncloud.com/](https://console.ncloud.com/)
2. Sign up for a new account
3. Enable SENS service

### 2. Get Your NCP Credentials

1. Go to **My Page** → **API Key Management**
2. Create new API key
3. Note your Access Key and Secret Key

### 3. Register Sender Phone Number

1. In SENS console, create SMS project
2. Register your Korean phone number (010xxxxxxxx)
3. Verify via ARS or document verification

### 4. Add Environment Variables

Add these to your `.env.local` file:

```bash
# NCP SMS Configuration
NCP_ACCESS_KEY=your_access_key_here
NCP_SECRET_KEY=your_secret_key_here
NCP_SMS_SERVICE_ID=your_service_id_here
NCP_FROM_NUMBER=01012345678

# Base URL for SMS links (change to your production domain when deploying)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Example:**
```bash
NCP_ACCESS_KEY=eGFtcGxlQWNjZXNzS2V5
NCP_SECRET_KEY=eGFtcGxlU2VjcmV0S2V5MTIzNDU2Nzg=
NCP_SMS_SERVICE_ID=ncp:sms:kr:123456789012:your-project
NCP_FROM_NUMBER=01012345678
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 5. Install Dependencies

```bash
npm install
```

Note: Twilio has been removed. NCP uses Node.js built-in `crypto` module.

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
4. **Enter your Korean phone number** (010-xxxx-xxxx)
5. Click search
6. **Wait 1-2 minutes**
7. **You'll receive an SMS** with a link like: `http://localhost:3000/search-results/job_abc123`
8. Click the link to view your results!

### Phone Number Requirements

⚠️ **Important**: NCP SENS requires Korean phone numbers

- Format: `010-1234-5678` or `01012345678`
- System auto-converts `+821012345678` to `01012345678`
- Must be a valid Korean mobile number starting with 010

---

## 🌐 Production Deployment

### 1. Update Environment Variables

When deploying to production (Vercel):

```bash
# In Vercel Dashboard → Settings → Environment Variables
NCP_ACCESS_KEY=your_access_key
NCP_SECRET_KEY=your_secret_key
NCP_SMS_SERVICE_ID=your_service_id
NCP_FROM_NUMBER=01012345678
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### 2. NCP Account Setup

For production use:
1. Ensure your sender number is fully verified
2. Set up billing in NCP console
3. Configure usage alerts (optional)
4. You can send SMS to any Korean phone number

### 3. Pricing

NCP SMS pricing (as of 2025):
- **SMS (≤80 bytes)**: ~₩8-15 per message
- **LMS (81-2000 bytes)**: ~₩25-50 per message
- **MMS (with images)**: ~₩150-200 per message
- Very affordable for Korean users!

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

### "NCP SMS credentials not configured"

**Solution**: Make sure you added all 4 NCP env variables to `.env.local` and restarted your server
- `NCP_ACCESS_KEY`
- `NCP_SECRET_KEY`
- `NCP_SMS_SERVICE_ID`
- `NCP_FROM_NUMBER`

### "SMS not received"

**Possible causes**:
1. **Phone format**: Must be Korean number (010xxxxxxxx)
2. **Sender not verified**: Check sender number registration in NCP SENS console
3. **Wrong format**: Use `010-1234-5678` or `01012345678`
4. **Check logs**: Look in terminal for "SMS sent successfully" or error messages
5. **NCP balance**: Check your NCP billing status

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
1. Go to NCP Console → **SENS** → **SMS**
2. Select your project
3. Go to **발송 내역** (Send History)
4. See delivery status, timestamps, errors

### Track Usage

- NCP Console shows: Message count, costs, delivery rates
- Go to **My Page** → **이용 현황** (Usage Status) for billing
- Monitor `search_jobs` table in Supabase for job completion rates

---

## 🎉 You're All Set!

Your app now supports:
- ✅ Background job processing
- ✅ SMS notifications via NCP SENS
- ✅ Korean phone number validation
- ✅ Auto SMS/LMS type detection
- ✅ Shareable results pages
- ✅ Persistent storage in Supabase

Users can now:
1. Start a search
2. Close the app
3. Receive SMS when ready (Korean numbers only)
4. View results anytime via link

---

## 📝 Next Steps (Optional)

### Enhancements

1. **Optimize message length** (keep under 80 bytes for SMS pricing)
2. **Add URL shortener** (reduce byte count)
3. **Customize SMS message** (brand name, custom text)
4. **Add retry logic** (if NCP SENS fails)
5. **Track SMS delivery** (save delivery status in database)
6. **Add internationalization** (Korean/English messages)
7. **Implement batch sending** (up to 100 recipients per call)

### Cost Optimization

- **Keep messages short**: SMS (₩8-15) vs LMS (₩25-50)
- **Use URL shortener**: Reduces message byte count
- **Batch notifications**: Send to multiple users in one API call
- **Use push notifications**: Free alternative (requires app install)

---

**Questions?** 

- **NCP SENS Docs**: https://api.ncloud-docs.com/docs/ai-application-service-sens-smsv2
- **Setup Guide**: See `NCP_SMS_SETUP.md`
- **Migration Guide**: See `TWILIO_TO_NCP_MIGRATION.md`

**Ready to test?** Run `npm run dev` and try uploading an image! 🚀

