# 🔖 NCP SMS API Quick Reference

Quick reference for using NCP SENS SMS in your application.

---

## 📦 Installation

```bash
# No external dependencies needed!
# Uses Node.js built-in 'crypto' module
```

---

## 🔧 Configuration

### Environment Variables

```bash
NCP_ACCESS_KEY=your_access_key
NCP_SECRET_KEY=your_secret_key
NCP_SMS_SERVICE_ID=ncp:sms:kr:123456789012:project-name
NCP_FROM_NUMBER=01012345678
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## 📝 Usage

### Basic SMS Sending

```typescript
import { sendSMS } from '@/lib/sms'

// Send a simple SMS
const success = await sendSMS({
  to: '010-1234-5678',  // Or '01012345678' or '+821012345678'
  message: 'Hello from NCP SENS!',
  subject: 'Test Message'  // Optional, used for LMS
})

if (success) {
  console.log('SMS sent successfully!')
} else {
  console.error('Failed to send SMS')
}
```

### Search Results Notification

```typescript
import { sendSearchResultsNotification } from '@/lib/sms'

// Send search results link
const success = await sendSearchResultsNotification(
  '010-1234-5678',
  'job_1234567890_abc'
)
```

---

## 📱 Phone Number Formats

All these formats are automatically handled:

```typescript
'010-1234-5678'    // ✅ Korean format with hyphens
'01012345678'      // ✅ Korean format without hyphens
'+821012345678'    // ✅ International format (auto-converted)
```

Invalid formats:
```typescript
'1234567890'       // ❌ Not starting with 010
'010-123-4567'     // ❌ Wrong number of digits
'+1-555-123-4567'  // ❌ Non-Korean number
```

---

## 📨 Message Types

The system automatically detects message type based on byte length:

| Type | Byte Length | Cost (₩) | Use Case |
|------|-------------|----------|----------|
| SMS | ≤80 bytes | 8-15 | Short messages, links |
| LMS | 81-2000 bytes | 25-50 | Long messages, details |
| MMS | Any + image | 150-200 | Messages with images (not implemented) |

### Byte Length Examples

```typescript
// SMS (≤80 bytes)
"검색 완료! bit.ly/xyz123"                    // ~40 bytes → SMS
"Search complete! bit.ly/xyz"                // ~35 bytes → SMS

// LMS (>80 bytes)
"✨ Your fashion search is ready! View your results here: http://example.com/results/job_123"
// ~110 bytes → LMS

"안녕하세요! 패션 검색이 완료되었습니다. 결과를 확인하시려면 다음 링크를 클릭해주세요: http://example.com/results/job_123"
// ~150 bytes → LMS
```

---

## 🔐 Authentication Flow

NCP uses HMAC SHA256 signature authentication:

```typescript
// Automatically handled by sendSMS()
const timestamp = Date.now().toString()
const urlPath = `/sms/v2/services/${serviceId}/messages`
const message = `POST ${urlPath}\n${timestamp}\n${accessKey}`
const signature = createHmac('sha256', secretKey)
  .update(message)
  .digest('base64')
```

---

## 📊 API Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 202 | Accepted | ✅ Message queued successfully |
| 400 | Bad Request | Check phone number format |
| 401 | Unauthorized | Verify API credentials |
| 403 | Forbidden | Check sender number registration |
| 429 | Rate Limited | Wait and retry |
| 500 | Server Error | Contact NCP support |

---

## 🧪 Testing

### Test in Development

```bash
# 1. Start dev server
npm run dev

# 2. Check logs for:
📱 Sending SMS to 01012345678
📨 Message type: SMS
✅ SMS sent successfully. Request ID: 12345...
```

### Test API Directly

```typescript
// In your code or API route
import { sendSMS } from '@/lib/sms'

// Test SMS
await sendSMS({
  to: '010-1234-5678',
  message: 'Test message from dev',
  subject: 'Test'
})
```

---

## 🔍 Debugging

### Enable Detailed Logging

The `lib/sms.ts` already includes detailed console logs:

```typescript
console.log(`📱 Sending SMS to ${cleanedPhone}`)
console.log(`📨 Message type: ${smsType}`)
console.log(`✅ SMS sent successfully. Request ID: ${responseData?.requestId}`)
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "NCP SMS credentials not configured" | Add all 4 env vars to `.env.local` |
| "Invalid phone number format" | Use 010xxxxxxxx format |
| Status 403 | Register sender number in NCP SENS |
| Status 401 | Check API credentials |
| SMS not received | Check NCP console send history |

---

## 📖 Code Examples

### Example 1: Simple Notification

```typescript
import { sendSMS } from '@/lib/sms'

async function notifyUser(phoneNumber: string) {
  const success = await sendSMS({
    to: phoneNumber,
    message: '주문이 완료되었습니다!',
    subject: '주문 완료'
  })
  
  if (!success) {
    // Handle error (log, retry, notify admin, etc.)
    console.error('Failed to send notification')
  }
}
```

### Example 2: Search Results (Current Implementation)

```typescript
import { sendSearchResultsNotification } from '@/lib/sms'

// In your background job processor
const job = getJob(jobId)
if (job?.phoneNumber) {
  const smsSent = await sendSearchResultsNotification(
    job.phoneNumber,
    jobId
  )
  
  if (smsSent) {
    console.log(`✅ SMS sent to ${job.phoneNumber}`)
  } else {
    console.error(`❌ Failed to send SMS`)
  }
}
```

### Example 3: Custom Message with Variables

```typescript
import { sendSMS } from '@/lib/sms'

async function sendCustomMessage(
  phoneNumber: string,
  userName: string,
  orderNumber: string
) {
  const message = `안녕하세요 ${userName}님! 주문번호 ${orderNumber}이(가) 발송되었습니다.`
  
  await sendSMS({
    to: phoneNumber,
    message: message,
    subject: '배송 시작'
  })
}
```

---

## 🚀 Advanced Features

### Batch Sending (Future Enhancement)

The NCP API supports sending to multiple recipients in one call:

```typescript
// Not implemented yet, but easy to add
const body = {
  type: 'SMS',
  from: fromNumber,
  messages: [
    { to: '01011111111', content: 'Message 1' },
    { to: '01022222222', content: 'Message 2' },
    // ... up to 100
  ]
}
```

To implement:
1. Modify `sendSMS()` to accept array of recipients
2. Map recipients to messages array
3. Handle batch responses

### Message Templates (Future Enhancement)

Create reusable templates:

```typescript
const TEMPLATES = {
  SEARCH_COMPLETE: (url: string) => 
    `✨ 검색 완료! 결과 확인: ${url}`,
  
  ORDER_SHIPPED: (orderNum: string) => 
    `주문 ${orderNum} 발송됨`,
}

await sendSMS({
  to: phoneNumber,
  message: TEMPLATES.SEARCH_COMPLETE(resultsUrl)
})
```

---

## 💰 Cost Optimization

### 1. Keep Messages Short

```typescript
// Bad: LMS (₩25-50)
"✨ Your fashion search is ready! View your results here: http://localhost:3000/search-results/job_1234567890_abcdef"

// Good: SMS (₩8-15)
"검색 완료! yourdomain.com/r/abc123"
```

### 2. Use URL Shortener

```typescript
import { shortenUrl } from './urlShortener'

const fullUrl = `${baseUrl}/search-results/${jobId}`
const shortUrl = await shortenUrl(fullUrl)  // yourdomain.com/r/abc

const message = `검색 완료! ${shortUrl}`  // Much shorter → SMS tier
```

### 3. Optimize Korean vs English

```typescript
// Korean (more efficient)
"검색 완료! bit.ly/xyz"  // ~25 bytes → SMS

// English (less efficient)
"Search complete! bit.ly/xyz"  // ~35 bytes → SMS
```

---

## 📚 Related Files

- **Implementation**: `/Users/levit/Desktop/mvp/lib/sms.ts`
- **Usage**: `/Users/levit/Desktop/mvp/app/api/search-job/route.ts`
- **Setup Guide**: `NCP_SMS_SETUP.md`
- **Migration Guide**: `TWILIO_TO_NCP_MIGRATION.md`
- **Legacy Guide**: `SMS_NOTIFICATION_SETUP.md`

---

## 🔗 External Resources

- **NCP SENS API Docs**: https://api.ncloud-docs.com/docs/ai-application-service-sens-smsv2
- **NCP Console**: https://console.ncloud.com/
- **SENS Dashboard**: https://console.ncloud.com/sens

---

## ✅ Quick Checklist

Before using in production:

- [ ] All 4 env variables configured
- [ ] Sender number registered and verified
- [ ] Tested in development
- [ ] Logs show successful sends
- [ ] NCP console shows delivery
- [ ] Error handling implemented
- [ ] Production env variables set

---

**Happy messaging! 📱✨**

