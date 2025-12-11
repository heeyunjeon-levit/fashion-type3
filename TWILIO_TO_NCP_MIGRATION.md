# 🔄 Twilio to NCP SMS Migration Checklist

This document tracks your migration from Twilio to NCP SENS for SMS notifications.

---

## ✅ Completed Steps

- [x] Updated `lib/sms.ts` to use NCP SENS API
- [x] Removed Twilio dependency from `package.json`
- [x] Added HMAC SHA256 signature authentication
- [x] Added Korean phone number validation and formatting
- [x] Added automatic SMS/LMS type detection
- [x] Created NCP_SMS_SETUP.md guide

---

## 📋 Your Next Steps

### 1. Set Up NCP Account (10 minutes)

Follow the guide in `NCP_SMS_SETUP.md`:

- [ ] Create NCP account at https://console.ncloud.com/
- [ ] Enable SENS service
- [ ] Create SMS project
- [ ] Register and verify sender phone number
- [ ] Get API credentials (Access Key + Secret Key)

### 2. Update Environment Variables

Add these to your `.env.local` file:

```bash
# Remove old Twilio variables (or comment them out)
# TWILIO_ACCOUNT_SID=...
# TWILIO_AUTH_TOKEN=...
# TWILIO_PHONE_NUMBER=...

# Add new NCP variables
NCP_ACCESS_KEY=your_access_key_here
NCP_SECRET_KEY=your_secret_key_here
NCP_SMS_SERVICE_ID=your_service_id_here
NCP_FROM_NUMBER=01012345678
```

**Where to find these values:**
- `NCP_ACCESS_KEY` & `NCP_SECRET_KEY`: NCP Console → My Page → API Key Management
- `NCP_SMS_SERVICE_ID`: SENS Console → Your SMS Project → Service ID
- `NCP_FROM_NUMBER`: Your registered sender number (format: 01012345678)

### 3. Clean Up Dependencies

```bash
npm uninstall twilio
npm install
```

This removes Twilio and ensures a clean installation.

### 4. Restart Development Server

```bash
npm run dev
```

### 5. Test SMS Functionality

- [ ] Upload a fashion image
- [ ] Select items to search
- [ ] Enter your Korean phone number (010-xxxx-xxxx)
- [ ] Verify you receive SMS with results link
- [ ] Click link and verify results display correctly

---

## 🔍 What Changed

### Code Changes

#### `lib/sms.ts`

**Before (Twilio):**
```typescript
import twilio from 'twilio'

function getTwilioClient() {
  return twilio(accountSid, authToken)
}

await client.messages.create({
  body: message,
  to: to,
  from: fromNumber
})
```

**After (NCP):**
```typescript
import { createHmac } from 'crypto'

function getSignature(...) {
  // HMAC SHA256 authentication
}

await fetch('https://sens.apigw.ntruss.com/...', {
  method: 'POST',
  headers: {
    'x-ncp-apigw-signature-v2': signature,
    // ...
  },
  body: JSON.stringify({
    type: smsType,
    messages: [{ to, content: message }]
  })
})
```

### New Features

1. **Auto SMS/LMS Detection**: Automatically uses SMS for short messages (≤80 bytes) and LMS for longer messages
2. **Korean Phone Validation**: Validates and auto-formats Korean phone numbers (010xxxxxxxx)
3. **Flexible Input**: Accepts `010-1234-5678`, `01012345678`, or `+821012345678`
4. **Batch Support Ready**: Code structure supports sending to multiple recipients (not used yet, but easy to implement)

### Dependencies

**Removed:**
- `twilio: ^5.10.7`

**Added:**
- Nothing! Uses Node.js built-in `crypto` module

---

## 🆚 Twilio vs NCP Comparison

| Feature | Twilio | NCP SENS |
|---------|--------|----------|
| **Global Coverage** | 180+ countries | Primarily Korea |
| **Phone Format** | International (+82...) | Korean (010...) |
| **Authentication** | Basic Auth | HMAC Signature |
| **SMS Cost (Korea)** | ~$0.06 per message | ~₩8-15 per SMS, ₩25-50 per LMS |
| **Setup Complexity** | Easy (buy number) | Medium (register/verify number) |
| **Batch Sending** | 1 per request | Up to 100 per request |
| **Trial Account** | $15 credit, verified numbers only | Free tier with limits |
| **Message Types** | Auto-detected | SMS/LMS/MMS (auto-detected in our code) |

---

## 🧪 Testing Checklist

### Local Testing

- [ ] Server starts without errors
- [ ] No "Twilio credentials not configured" errors
- [ ] SMS sends successfully (check terminal logs)
- [ ] SMS received on phone
- [ ] Link in SMS works correctly
- [ ] Results page loads properly

### Production Testing (after deployment)

- [ ] Update Vercel environment variables
- [ ] Deploy to production
- [ ] Test with real phone number
- [ ] Verify SMS delivery time (usually instant)
- [ ] Check NCP SENS console for send history

---

## 🐛 Troubleshooting Guide

### Error: "NCP SMS credentials not configured"

**Cause**: Missing environment variables

**Solution**:
1. Check `.env.local` has all 4 NCP variables
2. Restart dev server: `npm run dev`
3. Verify no typos in variable names

### Error: "Invalid phone number format"

**Cause**: Phone number doesn't match Korean format

**Solution**:
- Use format: `010-1234-5678` or `01012345678`
- Must start with `010`
- Must be 11 digits total

### Error: Status 403 (Forbidden)

**Cause**: Sender number not registered/approved

**Solution**:
1. Go to NCP Console → SENS → Your Project
2. Check **발신번호 관리** (Sender Number Management)
3. Verify your number is **승인 완료** (Approved)
4. If pending, wait for approval or complete verification

### Error: Status 401 (Unauthorized)

**Cause**: Invalid API credentials

**Solution**:
1. Verify `NCP_ACCESS_KEY` and `NCP_SECRET_KEY` are correct
2. Check for extra spaces or line breaks
3. Regenerate keys in NCP console if needed

### SMS Not Received

**Steps to debug**:
1. Check terminal for "SMS sent successfully" message
2. Check NCP SENS console → **발송 내역** (Send History)
3. Verify phone number is correct
4. Check if NCP account has sufficient balance
5. Try sending to different number

---

## 📊 Monitoring & Logging

### Application Logs

Your app logs these events:

```
📱 Sending SMS to 01012345678
📨 Message type: SMS (or LMS)
✅ SMS sent successfully. Request ID: 12345...
```

or:

```
❌ SMS sending failed. Status: 403
❌ Failed to send SMS: [error details]
```

### NCP Console Monitoring

**To view send history:**
1. Go to NCP Console → SENS
2. Click your SMS project
3. Go to **발송 내역** (Send History)
4. View all sent messages, statuses, and timestamps

**To view usage/billing:**
1. NCP Console → My Page → **이용 현황** (Usage Status)
2. Filter by date range
3. See SMS count and costs

---

## 💰 Cost Estimation

### NCP SMS Pricing (Korea, 2025)

- **SMS** (≤80 bytes): ₩8-15 per message
- **LMS** (81-2000 bytes): ₩25-50 per message

### Your Current Message

```
"✨ Your fashion search is ready! View your results here: http://localhost:3000/search-results/job_12345"
```

- Length: ~110 bytes
- Type: **LMS**
- Cost: ~₩25-50 per send

### Cost Optimization Tips

1. **Shorten message**: Use URL shortener to reduce byte count
2. **Korean message**: More efficient byte usage
3. **Remove emoji**: Saves bytes

**Example optimized message (SMS tier):**
```
검색 완료! yourdomain.com/r/job_123
```
- Length: ~50 bytes
- Type: **SMS**
- Cost: ~₩8-15 per send (50% savings!)

---

## 🎯 Production Deployment

### Vercel Environment Variables

When deploying to Vercel:

1. Go to Vercel Dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables for **Production**:

```
NCP_ACCESS_KEY=your_production_access_key
NCP_SECRET_KEY=your_production_secret_key
NCP_SMS_SERVICE_ID=your_production_service_id
NCP_FROM_NUMBER=01012345678
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

⚠️ **Important**: 
- Use different API keys for dev/prod (security best practice)
- Update `NEXT_PUBLIC_BASE_URL` to your production domain
- Don't commit `.env.local` to git

### Deployment Checklist

- [ ] Add all NCP env variables to Vercel
- [ ] Update `NEXT_PUBLIC_BASE_URL` to production domain
- [ ] Remove/comment out Twilio variables
- [ ] Test in production with real phone number
- [ ] Monitor first few sends in NCP console
- [ ] Set up usage alerts in NCP (optional)

---

## 🔒 Security Best Practices

### API Key Security

✅ **DO:**
- Store keys in environment variables
- Use different keys for dev/staging/prod
- Rotate keys every 3-6 months
- Restrict API key permissions in NCP console
- Monitor API usage regularly

❌ **DON'T:**
- Commit keys to git
- Share keys in chat/email
- Use production keys in development
- Log keys in console/logs
- Expose keys in client-side code

### Phone Number Privacy

- Phone numbers stored in `search_jobs` table
- Not exposed in public results page
- Consider hashing for extra privacy
- Follow GDPR/data privacy regulations

---

## 📚 Additional Resources

### Official Documentation

- **NCP SENS API Docs**: https://api.ncloud-docs.com/docs/ai-application-service-sens-smsv2
- **NCP Console**: https://console.ncloud.com/
- **SENS Pricing**: https://www.ncloud.com/product/applicationService/sens

### Your Documentation

- **Setup Guide**: `NCP_SMS_SETUP.md`
- **This Migration Guide**: `TWILIO_TO_NCP_MIGRATION.md`
- **SMS Code**: `lib/sms.ts`
- **Background Processing**: `START_HERE_BACKGROUND_PROCESSING.md`

---

## ✅ Final Checklist

Before marking migration as complete:

- [ ] NCP account created and SENS enabled
- [ ] Sender phone number registered and verified
- [ ] API credentials obtained from NCP console
- [ ] Environment variables updated in `.env.local`
- [ ] Twilio dependency removed (`npm uninstall twilio`)
- [ ] Dependencies reinstalled (`npm install`)
- [ ] Development server restarted
- [ ] Local testing successful (SMS received)
- [ ] Code reviewed and understood
- [ ] Production environment variables updated (when ready)
- [ ] Production deployment tested (when ready)

---

## 🎉 You're Done!

Once you complete the checklist above, your app will be successfully using NCP SENS for SMS notifications!

**Next steps:**
1. Test thoroughly in development
2. Deploy to production when ready
3. Monitor SMS delivery and costs
4. Consider additional optimizations (URL shortening, message templates, etc.)

---

**Need help?** Refer to:
- `NCP_SMS_SETUP.md` for detailed setup instructions
- NCP SENS documentation for API details
- This file for migration-specific guidance

Happy messaging! 📱✨

