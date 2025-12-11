# 🔧 NCP SMS Troubleshooting Guide

Quick fixes for common NCP SENS SMS errors.

---

## ❌ Error: Status 404

**Error Message:**
```
❌ SMS sending failed. Status: 404
```

### Cause
The API endpoint was not found. This means your **Service ID** is incorrect or the service doesn't exist.

### Solution

#### 1. Find Your Correct Service ID

**Go to NCP Console:**
1. Open https://console.ncloud.com/
2. Navigate to **SENS** → **SMS**
3. Click on your SMS project
4. Look for **Service ID** at the top

**Service ID formats:**
- Full format: `ncp:sms:kr:271050365095:project_name`
- Short format: `ncs20241210abc123`

#### 2. Update `.env.local`

```bash
# Copy the EXACT Service ID from NCP Console
NCP_SMS_SERVICE_ID=ncp:sms:kr:271050365095:your_project_name
```

#### 3. Restart Server

```bash
npm run dev
```

#### 4. Test Again

The new error logs will show:
```
❌ SMS sending failed:
   Status: 404
   URL: https://sens.apigw.ntruss.com/sms/v2/services/YOUR_SERVICE_ID/messages
   Service ID: YOUR_SERVICE_ID
   Response: {...}
```

Check if the Service ID in the logs matches what you see in NCP Console.

---

## ❌ Error: Status 401 (Unauthorized)

**Error Message:**
```
❌ SMS sending failed. Status: 401
```

### Cause
Invalid API credentials (Access Key or Secret Key).

### Solution

#### 1. Verify Credentials

**Go to NCP Console:**
1. Open https://console.ncloud.com/
2. Go to **My Page** → **API Key Management**
3. Check your Access Key
4. Click "Show" to reveal Secret Key

#### 2. Update `.env.local`

```bash
NCP_ACCESS_KEY=your_correct_access_key
NCP_SECRET_KEY=your_correct_secret_key
```

**Common mistakes:**
- Extra spaces before/after keys
- Wrong account (using keys from different NCP account)
- Expired or deleted keys

#### 3. Regenerate Keys (if needed)

If keys are lost:
1. NCP Console → My Page → API Key Management
2. Delete old key
3. Create new key
4. Update `.env.local`

---

## ❌ Error: Status 403 (Forbidden)

**Error Message:**
```
❌ SMS sending failed. Status: 403
```

### Cause
Sender phone number not registered or not approved.

### Solution

#### 1. Check Sender Number Status

**Go to NCP Console:**
1. SENS → SMS → Your Project
2. Go to **발신번호 관리** (Sender Number Management)
3. Check status of your sender number

**Status should be:**
- ✅ **승인 완료** (Approved) - Good!
- ⏳ **대기중** (Pending) - Wait for approval
- ❌ **거부됨** (Rejected) - Need to re-register

#### 2. Register Number (if not registered)

1. Click **발신번호 등록** (Register Sender Number)
2. Enter phone number: `01012345678`
3. Choose **ARS 인증** for instant verification
4. Complete phone verification
5. Wait for approval (usually instant for ARS)

#### 3. Verify in `.env.local`

Make sure the number matches:

```bash
# Must match the registered number exactly
NCP_FROM_NUMBER=01012345678
```

**Format:** No hyphens, starts with 010, 11 digits total

---

## ❌ Error: Status 400 (Bad Request)

**Error Message:**
```
❌ SMS sending failed. Status: 400
```

### Cause
Invalid request format (usually phone number or message format).

### Solution

#### 1. Check Phone Number Format

**Valid formats:**
```typescript
'01012345678'      // ✅ Correct
'010-1234-5678'    // ✅ Auto-converted
'+821012345678'    // ✅ Auto-converted
```

**Invalid formats:**
```typescript
'1234567890'       // ❌ Doesn't start with 010
'011-1234-5678'    // ❌ Not a mobile number
'821012345678'     // ❌ Missing +
```

#### 2. Check Message Content

- SMS: Max 80 bytes
- LMS: Max 2000 bytes
- No special characters that break JSON

#### 3. Check FROM Number

Make sure `NCP_FROM_NUMBER` is:
- 11 digits
- Starts with 010
- No hyphens
- Matches registered number

---

## ❌ Error: Status 429 (Rate Limited)

**Error Message:**
```
❌ SMS sending failed. Status: 429
```

### Cause
Too many API requests in short time.

### Solution

#### 1. Understand Limits

- **Max messages per call**: 100
- **Recommended delay**: 1 second between batches
- **Daily limits**: Depends on NCP service tier

#### 2. Add Delay (if sending multiple)

```typescript
// Already implemented in reference code
await new Promise((resolve) => setTimeout(resolve, 1000))
```

#### 3. Upgrade Service Tier

If you need higher limits:
1. NCP Console → SENS → Your Project
2. Check service tier and limits
3. Upgrade if needed

---

## ❌ Error: "NCP SMS credentials not configured"

**Error Message:**
```
❌ NCP SMS credentials not configured
Required: NCP_ACCESS_KEY, NCP_SECRET_KEY, NCP_SMS_SERVICE_ID, NCP_FROM_NUMBER
```

### Cause
Missing environment variables in `.env.local`.

### Solution

#### 1. Check `.env.local` Exists

```bash
ls -la .env.local
```

If not found:
```bash
touch .env.local
```

#### 2. Add All 4 Variables

```bash
NCP_ACCESS_KEY=your_access_key
NCP_SECRET_KEY=your_secret_key
NCP_SMS_SERVICE_ID=your_service_id
NCP_FROM_NUMBER=01012345678
```

#### 3. Verify Variables Are Set

```bash
# Check if variables are in file
cat .env.local | grep NCP
```

Should show all 4 variables.

#### 4. Restart Server

```bash
npm run dev
```

---

## ❌ Error: "Invalid phone number format"

**Error Message:**
```
❌ Invalid phone number format: 1234567890
```

### Cause
Phone number doesn't match Korean mobile format.

### Solution

#### Must Be Korean Mobile Number

**Requirements:**
- Starts with `010`
- 11 digits total
- Format: `010XXXXXXXX` or `010-XXXX-XXXX`

**Valid:**
```
01012345678
010-1234-5678
+821012345678  (auto-converted to 010...)
```

**Invalid:**
```
1234567890     (no country/area code)
011-1234-5678  (not mobile - landline)
821012345678   (missing +)
```

---

## 🔍 Debug Checklist

When you get an error, check these in order:

### 1. Environment Variables

```bash
# Check all 4 are set
cat .env.local | grep NCP

# Should show:
# NCP_ACCESS_KEY=...
# NCP_SECRET_KEY=...
# NCP_SMS_SERVICE_ID=...
# NCP_FROM_NUMBER=...
```

### 2. NCP Console - Service ID

1. SENS → SMS → Your Project
2. Copy Service ID from top of page
3. Compare with `.env.local`

### 3. NCP Console - Sender Number

1. SENS → SMS → Your Project → 발신번호 관리
2. Check status: **승인 완료** (Approved)
3. Copy number
4. Compare with `NCP_FROM_NUMBER` in `.env.local`

### 4. NCP Console - API Keys

1. My Page → API Key Management
2. Verify Access Key exists
3. Verify not expired
4. Compare with `.env.local`

### 5. Terminal Logs

After the update, you'll see detailed errors:
```
❌ SMS sending failed:
   Status: 404
   URL: https://sens.apigw.ntruss.com/sms/v2/services/XXX/messages
   Service ID: XXX
   Response: {...}
```

Use this info to identify the issue.

### 6. NCP Console - Send History

1. SENS → SMS → Your Project
2. Go to **발송 내역** (Send History)
3. Check if any attempts are logged
4. Check error messages

---

## 🧪 Test Your Setup

### Quick Test Script

Add this to a test file or API route:

```typescript
import { sendSMS } from '@/lib/sms'

async function testSMS() {
  console.log('🧪 Testing NCP SMS...')
  
  const result = await sendSMS({
    to: '010-YOUR-NUMBER',
    message: '테스트 메시지입니다.',
    subject: 'Test'
  })
  
  if (result) {
    console.log('✅ Test passed!')
  } else {
    console.log('❌ Test failed - check logs above')
  }
}

testSMS()
```

---

## 📊 Common Status Codes

| Code | Meaning | Common Fix |
|------|---------|------------|
| 202 | ✅ Success | None - working! |
| 400 | Bad Request | Check phone format |
| 401 | Unauthorized | Check API credentials |
| 403 | Forbidden | Register sender number |
| 404 | Not Found | Fix Service ID |
| 429 | Rate Limited | Add delay between calls |
| 500 | Server Error | Contact NCP support |

---

## 🆘 Still Not Working?

### 1. Check NCP Service Status

NCP might be having issues:
- https://www.ncloud.com/support/notice

### 2. Try NCP API Directly

Test with curl to isolate the issue:

```bash
# Get timestamp
TIMESTAMP=$(date +%s000)

# Generate signature (complex - use online tools)
# https://api.ncloud-docs.com/docs/common-ncpapi

# Test API call
curl -X POST https://sens.apigw.ntruss.com/sms/v2/services/YOUR_SERVICE_ID/messages \
  -H "Content-Type: application/json" \
  -H "x-ncp-apigw-timestamp: $TIMESTAMP" \
  -H "x-ncp-iam-access-key: YOUR_ACCESS_KEY" \
  -H "x-ncp-apigw-signature-v2: YOUR_SIGNATURE" \
  -d '{
    "type": "SMS",
    "from": "01012345678",
    "content": "test",
    "messages": [{"to": "01012345678"}]
  }'
```

### 3. Contact NCP Support

If nothing works:
1. NCP Console → Support → 1:1 문의
2. Provide:
   - Service ID
   - Error status code
   - Timestamp of failed attempt
   - Screenshot of error

---

## 📚 Additional Resources

- **NCP SENS API Docs**: https://api.ncloud-docs.com/docs/ai-application-service-sens-smsv2
- **Setup Guide**: `NCP_SMS_SETUP.md`
- **Quick Reference**: `NCP_SMS_REFERENCE.md`
- **Migration Guide**: `TWILIO_TO_NCP_MIGRATION.md`

---

## ✅ Success Indicators

You'll know it's working when you see:

```
📱 Sending SMS to 01012345678
📨 Message type: SMS
✅ SMS sent successfully. Request ID: 1234567890
```

And your phone receives the SMS! 📱

---

**Having a specific error?** Find it in the sections above or check the detailed logs after restarting your server.

