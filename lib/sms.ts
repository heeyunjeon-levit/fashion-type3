import crypto from 'crypto'

export interface SendSMSParams {
  to: string
  message: string
}

/**
 * Normalize phone number to 010XXXXXXXX format (Korean local format for NCP)
 * Handles various input formats:
 * - 010-1234-5678 -> 01012345678
 * - +821012345678 -> 01012345678
 * - 821012345678 -> 01012345678
 */
function normalizePhone(phone: string): string {
  // Remove all hyphens and spaces
  let cleaned = phone.replace(/[-\s]/g, '')
  
  // Remove + prefix if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }
  
  // If starts with 82, replace with 0
  if (cleaned.startsWith('82')) {
    return '0' + cleaned.substring(2)
  }
  
  // If starts with 010, return as is
  if (cleaned.startsWith('010')) {
    return cleaned
  }
  
  // If starts with 10 (without country code or 0), add 0
  if (cleaned.startsWith('10')) {
    return '0' + cleaned
  }
  
  return cleaned
}

/**
 * Validate Korean phone number format (010XXXXXXXX)
 */
function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhone(phone)
  // Should be 010 followed by 8 digits
  return /^010\d{8}$/.test(normalized)
}

/**
 * Generate HMAC SHA256 signature for NCP authentication
 */
function generateSignature(
  method: string,
  url: string,
  timestamp: string,
  accessKey: string,
  secretKey: string
): string {
  const space = ' '
  const newLine = '\n'
  const hmac = crypto.createHmac('sha256', secretKey)
  
  const message = [
    method,
    space,
    url,
    newLine,
    timestamp,
    newLine,
    accessKey
  ].join('')
  
  return hmac.update(message).digest('base64')
}

/**
 * Send SMS/LMS notification via NCP SENS API
 * Automatically chooses SMS (≤80 bytes) or LMS (>80 bytes) based on message length
 */
export async function sendSMS({ to, message }: SendSMSParams): Promise<boolean> {
  console.log(`🚀 sendSMS called with:`, { to, messageLength: message.length })
  
  try {
    // Validate environment variables
    const ACCESS_KEY = process.env.NCP_ACCESS_KEY
    const SECRET_KEY = process.env.NCP_SECRET_KEY
    const SERVICE_ID = process.env.NCP_SMS_SERVICE_ID
    const FROM_NUMBER = process.env.NCP_FROM_NUMBER
    
    console.log(`🔑 Checking NCP SENS credentials:`, {
      hasAccessKey: !!ACCESS_KEY,
      hasSecretKey: !!SECRET_KEY,
      hasServiceId: !!SERVICE_ID,
      hasFromNumber: !!FROM_NUMBER
    })
    
    if (!ACCESS_KEY || !SECRET_KEY || !SERVICE_ID || !FROM_NUMBER) {
      console.error('❌ NCP SMS credentials not configured')
      console.error('Required: NCP_ACCESS_KEY, NCP_SECRET_KEY, NCP_SMS_SERVICE_ID, NCP_FROM_NUMBER')
      console.error('See NCP_SMS_SETUP.md for setup instructions')
      return false
    }
    
    // Normalize and validate phone number
    const normalizedPhone = normalizePhone(to)
    if (!isValidPhoneNumber(to)) {
      console.error(`❌ Invalid phone number format: ${to}`)
      console.error(`   Expected: 010XXXXXXXX, got: ${to}`)
      return false
    }
    
    console.log(`📱 Sending SMS/LMS to ${normalizedPhone}`)
    
    // Determine message type based on length
    // SMS: up to 80 bytes (~40 Korean chars or 80 English chars)
    // LMS: 81-2000 bytes (~1000 Korean chars or 2000 English chars)
    const byteLength = Buffer.byteLength(message, 'utf8')
    const messageType = byteLength <= 80 ? 'SMS' : 'LMS'
    
    console.log(`📝 Message type: ${messageType} (${byteLength} bytes)`)
    
    // Generate timestamp and signature for authentication
    const timestamp = Date.now().toString()
    const method = 'POST'
    const uri = `/sms/v2/services/${SERVICE_ID}/messages`
    const signature = generateSignature(method, uri, timestamp, ACCESS_KEY, SECRET_KEY)
    
    // API endpoint
    const url = `https://sens.apigw.ntruss.com${uri}`
    
    // Request payload
    const payload = {
      type: messageType,
      from: FROM_NUMBER,
      content: message,
      messages: [
        {
          to: normalizedPhone
        }
      ]
    }
    
    console.log(`📤 Sending to NCP SENS API...`)
    console.log(`   URL: ${url}`)
    console.log(`   From: ${FROM_NUMBER}`)
    console.log(`   To: ${normalizedPhone}`)
    
    // Send request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': ACCESS_KEY,
        'x-ncp-apigw-signature-v2': signature
      },
      body: JSON.stringify(payload)
    })
    
    const responseData = await response.json()
    
    // NCP returns 202 for successful message acceptance
    if (response.ok && response.status === 202) {
      console.log(`✅ ${messageType} sent successfully via NCP SENS`)
      console.log(`   Request ID: ${responseData.requestId}`)
      console.log(`   Status: ${responseData.statusName}`)
      return true
    } else {
      console.error(`❌ ${messageType} sending failed:`)
      console.error(`   Status: ${response.status}`)
      console.error(`   Response:`, responseData)
      return false
    }
    
  } catch (error) {
    console.error('❌ Failed to send SMS/LMS:', error)
    return false
  }
}

/**
 * Send search results notification via SMS/LMS (SweetTracker)
 * This is a convenience wrapper around sendSMS
 */
export async function sendSearchResultsNotification(
  phoneNumber: string,
  jobId: string
): Promise<boolean> {
  const baseUrl =
    (process.env.NEXT_PUBLIC_BASE_URL || 'https://fashionsource.vercel.app').replace(/\/$/, '')
  const resultsUrl = `${baseUrl}/search-results/${jobId}`
  const message = `요청하신 상품 검색이 완료되었습니다! 링크를 통해 결과를 확인하세요: ${resultsUrl}`

  // Use the main sendSMS function (handles msgid generation correctly)
  return await sendSMS({
    to: phoneNumber,
    message
  })
}

