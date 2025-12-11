# 📱 NCP SMS API Setup Guide

Your app now uses **Naver Cloud Platform (NCP) SENS** for sending SMS notifications! This guide will help you configure NCP SMS to send search results to users.

---

## 🚀 Quick Setup (10 minutes)

### 1. Create NCP Account

1. Go to [Naver Cloud Platform Console](https://console.ncloud.com/)
2. Sign up for a new account (requires Korean phone verification)
3. Verify your email and complete registration

### 2. Enable SENS (Simple & Easy Notification Service)

1. In NCP Console, go to **Services** → **AI·NAVER API** → **SENS**
2. Click **이용 신청** (Apply for Service) to enable SENS
3. Accept the terms and conditions

### 3. Create SMS Service

1. In SENS Dashboard, click **SMS** tab
2. Click **프로젝트 생성** (Create Project)
3. Enter a project name (e.g., "FashionSearch")
4. Click **생성** (Create)
5. Note the **Service ID** (you'll need this later)

### 4. Register Sender Phone Number

⚠️ **Important**: In Korea, you must register and verify a sender phone number

1. In your SMS project, go to **발신번호 관리** (Sender Number Management)
2. Click **발신번호 등록** (Register Sender Number)
3. Enter your Korean phone number (format: `01012345678`)
4. Select verification method:
   - **문서 인증** (Document verification) - requires business registration
   - **ARS 인증** (ARS verification) - instant phone call verification
5. Complete the verification process
6. Wait for approval (usually instant for ARS, 1-2 business days for document)

### 5. Get API Credentials

1. In NCP Console, go to **My Page** → **계정 관리** → **인증키 관리** (API Key Management)
2. Click **API 인증키 관리** (API Key Management)
3. If you don't have keys, click **신규 API 인증키 생성** (Create New API Key)
4. Note these values:
   - **Access Key ID**: Your NCP access key
   - **Secret Key**: Your NCP secret key (show/hide toggle)

### 6. Add Environment Variables

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

### 7. Remove Twilio Dependencies

Run this command to clean up Twilio:

```bash
npm uninstall twilio
npm install
```

### 8. Restart Your Server

```bash
npm run dev
```

---

## ✅ Testing

### Test SMS Notifications

1. Start your dev server: `npm run dev`
2. Upload a fashion image
3. Select items to search
4. **Enter your Korean phone number** (format: `010-1234-5678` or `01012345678`)
5. Click search
6. **Wait 1-2 minutes**
7. **You'll receive an SMS** with a link like: `http://localhost:3000/search-results/job_abc123`
8. Click the link to view your results!

### Phone Number Formats Supported

The system automatically handles these formats:
- `01012345678` (preferred)
- `010-1234-5678` (auto-converted)
- `+821012345678` (auto-converted to 010 format)

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

### 2. Pricing

NCP SMS pricing (as of 2025):
- **SMS (up to 80 bytes)**: ~₩8-15 per message
- **LMS (81-2000 bytes)**: ~₩25-50 per message
- **MMS (with images)**: ~₩150-200 per message

💡 The system automatically detects message length and sends as SMS or LMS accordingly.

### 3. Rate Limits

- **Up to 100 messages per API call**
- **Recommended delay**: 1 second between batches
- Daily limits depend on your NCP service tier

---

## 💡 How It Works

### SMS Type Auto-Detection

The system automatically determines the message type:

- **SMS**: Messages ≤ 80 bytes (English: ~80 chars, Korean: ~40 chars)
- **LMS**: Messages > 80 bytes (up to 2000 bytes)

```typescript
// Example: Short message → SMS
"✨ 검색 완료! http://..."  // ~30 bytes → SMS

// Example: Long message → LMS
"✨ Your fashion search is ready! View your results here: http://..."  // ~120 bytes → LMS
```

### Authentication Flow

NCP uses HMAC SHA256 signature authentication:

```
1. Generate timestamp
2. Create signature: HMAC-SHA256(method + url + timestamp + accessKey, secretKey)
3. Send request with headers:
   - x-ncp-apigw-timestamp
   - x-ncp-iam-access-key
   - x-ncp-apigw-signature-v2
```

### API Response Codes

- **202**: Message accepted (queued for delivery)
- **400**: Invalid request (check phone format)
- **401**: Authentication failed (check credentials)
- **403**: Sender number not registered
- **429**: Rate limit exceeded

---

## 🔧 Technical Details

### Key Differences from Twilio

| Feature | Twilio | NCP SENS |
|---------|--------|----------|
| **Auth** | Basic Auth (SID + Token) | HMAC Signature |
| **Phone Format** | International (+82...) | Korean (010...) |
| **Batch Size** | 1 message per call | Up to 100 per call |
| **Message Types** | Auto-detected | Manual (SMS/LMS/MMS) |
| **Sender ID** | Purchased number | Registered number |
| **Geography** | Global | Korea-focused |

### Code Structure

The updated `lib/sms.ts` includes:

1. **`getSignature()`** - HMAC SHA256 authentication
2. **`isValidPhoneNumber()`** - Korean number validation (010xxxxxxxx)
3. **`cleanPhoneNumber()`** - Format conversion (+82 → 010)
4. **`getSmsType()`** - Auto-detect SMS vs LMS based on byte length
5. **`sendSMS()`** - Main function to send messages via NCP
6. **`sendSearchResultsNotification()`** - Helper for search results

---

## 🐛 Troubleshooting

### "NCP SMS credentials not configured"

**Solution**: Make sure you added all 4 NCP env variables to `.env.local`:
- `NCP_ACCESS_KEY`
- `NCP_SECRET_KEY`
- `NCP_SMS_SERVICE_ID`
- `NCP_FROM_NUMBER`

Then restart your server: `npm run dev`

### "Invalid phone number format"

**Solution**: 
- Phone numbers must be Korean (010xxxxxxxx)
- System accepts: `010-1234-5678`, `01012345678`, or `+821012345678`
- Non-Korean numbers are not supported

### "Status 403: Forbidden"

**Possible causes**:
1. **Sender number not registered**: Register your number in SENS console
2. **Sender number not approved**: Wait for approval (check SENS dashboard)
3. **Service not enabled**: Enable SENS in NCP console

### "Status 401: Unauthorized"

**Solution**: Check your API credentials:
1. Access Key and Secret Key are correct
2. Keys are from the correct NCP account
3. No extra spaces in `.env.local`

### "SMS not received"

**Possible causes**:
1. **Check logs**: Look for "SMS sent successfully" in terminal
2. **Check NCP console**: Go to SENS → SMS → 발송 내역 (Send History)
3. **Phone carrier issues**: Some carriers may delay messages
4. **Insufficient balance**: Check NCP billing

### "Message too long"

**Solution**: 
- SMS: Max 80 bytes (~80 English chars, ~40 Korean chars)
- LMS: Max 2000 bytes (automatically used for longer messages)
- Shorten your message or split into multiple sends

---

## 📊 Monitoring

### Check SMS Status

1. Go to NCP Console → **SENS** → **SMS**
2. Click your project
3. Go to **발송 내역** (Send History)
4. View:
   - Send time
   - Recipient number
   - Status (발송 성공/실패)
   - Error messages

### Track Usage & Billing

1. NCP Console → **My Page** → **이용 현황** (Usage Status)
2. View SMS count and costs by date
3. Set up usage alerts

---

## 🔒 Security Notes

### API Key Security

- ✅ Keep credentials in `.env.local` (never commit to git)
- ✅ Use different keys for dev/staging/production
- ✅ Rotate keys periodically (every 3-6 months)
- ❌ Never expose keys in client-side code
- ❌ Never log keys in console/logs

### Phone Number Privacy

- Phone numbers are stored in Supabase `search_jobs` table
- Only completed jobs are publicly readable (via RLS policy)
- Phone numbers are NOT exposed in results page
- Consider hashing phone numbers for extra privacy

### Rate Limiting

- System includes 1-second delay between batches
- Prevents NCP rate limit errors
- Adjust in code if needed for higher throughput

---

## 📈 Optimization Tips

### Cost Optimization

1. **Keep messages short**: SMS (₩8-15) is cheaper than LMS (₩25-50)
2. **Use shortened URLs**: Reduces byte count
3. **Batch notifications**: If multiple searches complete simultaneously

### Performance

1. **Parallel sending**: System supports batch sends (up to 100)
2. **Async processing**: SMS sent in background, doesn't block user
3. **Error handling**: Failed sends don't crash the app

### User Experience

1. **Clear messaging**: Tell users to expect SMS
2. **Delivery time**: Usually instant, but up to 1-2 minutes
3. **Fallback**: Consider showing results in-app too (not just SMS)

---

## 🎉 You're All Set!

Your app now supports:
- ✅ NCP SENS SMS notifications
- ✅ Korean phone number validation
- ✅ Auto SMS/LMS detection
- ✅ HMAC signature authentication
- ✅ Batch sending (up to 100 per call)

Users can now:
1. Start a search
2. Enter their Korean phone number
3. Receive SMS when ready
4. View results anytime via link

---

## 📝 Migration from Twilio

If you had Twilio set up previously:

### Environment Variables

**Remove** (Twilio):
```bash
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

**Add** (NCP):
```bash
NCP_ACCESS_KEY=...
NCP_SECRET_KEY=...
NCP_SMS_SERVICE_ID=...
NCP_FROM_NUMBER=...
```

### Dependencies

```bash
npm uninstall twilio
npm install
```

### Code Changes

✅ Already done! The updated `lib/sms.ts` now uses NCP SENS instead of Twilio.

---

## 🌟 Key Features

### 1. Auto Message Type Detection

```typescript
// Short message (≤80 bytes) → SMS
sendSMS({
  to: '01012345678',
  message: '검색 완료!',
})

// Long message (>80 bytes) → LMS
sendSMS({
  to: '01012345678',
  message: 'Your fashion search is ready! Click here to view...',
})
```

### 2. Flexible Phone Formats

```typescript
// All these work:
sendSMS({ to: '01012345678', message: '...' })
sendSMS({ to: '010-1234-5678', message: '...' })
sendSMS({ to: '+821012345678', message: '...' })
```

### 3. Batch Sending (Future Enhancement)

The NCP API supports batch sending. Example from reference code:

```typescript
// Send to multiple recipients in one call
messages: [
  { to: '01011111111', content: 'Message 1' },
  { to: '01022222222', content: 'Message 2' },
  // ... up to 100
]
```

Currently, the app sends one message at a time, but you can easily extend this for bulk notifications.

---

**Questions?** 

- NCP SENS Docs: https://api.ncloud-docs.com/docs/ai-application-service-sens-smsv2
- NCP Console: https://console.ncloud.com/

**Ready to test?** Run `npm run dev` and try uploading an image! 🚀

