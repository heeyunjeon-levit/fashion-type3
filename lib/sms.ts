export interface SendSMSParams {
  to: string
  message: string
}

/**
 * Normalize phone number to 82XXXXXXXXXX format (Korea country code)
 * Handles various input formats:
 * - 010-1234-5678 -> 821012345678
 * - 01012345678 -> 821012345678
 * - +821012345678 -> 821012345678
 * - 821012345678 -> 821012345678
 */
function normalizePhone(phone: string): string {
  // Remove all hyphens and spaces
  let cleaned = phone.replace(/[-\s]/g, '')
  
  // Remove + prefix if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }
  
  // If starts with 010, replace with 8210
  if (cleaned.startsWith('010')) {
    return '82' + cleaned.substring(1)
  }
  
  // If starts with 82, return as is
  if (cleaned.startsWith('82')) {
    return cleaned
  }
  
  // If starts with 0, replace with 82
  if (cleaned.startsWith('0')) {
    return '82' + cleaned.substring(1)
  }
  
  // Otherwise assume it's just the local number without 0
  return '82' + cleaned
}

/**
 * Validate Korean phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhone(phone)
  // Should be 82 followed by 10 (for mobile starting with 10) or 9 digits
  return /^8210\d{8}$/.test(normalized)
}

/**
 * Send SMS/LMS notification via SweetTracker API
 * Automatically chooses SMS (≤90 bytes) or LMS (>90 bytes) based on message length
 */
export async function sendSMS({ to, message }: SendSMSParams): Promise<boolean> {
  console.log(`🚀 sendSMS called with:`, { to, messageLength: message.length })
  
  try {
    // Validate environment variables
    const PROFILE_KEY = process.env.SWEETTRACKER_PROFILE_KEY
    const USER_ID = process.env.SWEETTRACKER_USER_ID
    
    console.log(`🔑 Checking SweetTracker credentials:`, {
      hasProfileKey: !!PROFILE_KEY,
      hasUserId: !!USER_ID
    })
    
    if (!PROFILE_KEY || !USER_ID) {
      console.error('❌ SweetTracker credentials not configured')
      console.error('Required: SWEETTRACKER_PROFILE_KEY, SWEETTRACKER_USER_ID')
      return false
    }
    
    // Normalize and validate phone number
    const normalizedPhone = normalizePhone(to)
    if (!isValidPhoneNumber(to)) {
      console.error(`❌ Invalid phone number format: ${to}`)
      return false
    }
    
    console.log(`📱 Sending SMS/LMS to ${normalizedPhone}`)
    
    // Determine message type based on length
    // SMS: up to 90 bytes (~45 Korean chars or 90 English chars)
    // LMS: 91-2000 bytes (~1000 Korean chars or 2000 English chars)
    const byteLength = Buffer.byteLength(message, 'utf8')
    const messageType = byteLength <= 90 ? 'SMS' : 'LMS'
    
    console.log(`📝 Message type: ${messageType} (${byteLength} bytes)`)
    
    // Generate unique message ID (max 20 chars for SweetTracker)
    // Use last 10 digits of timestamp + 5 char random = 15 chars total
    const timestamp = Date.now().toString().slice(-10)
    const random = Math.random().toString(36).substring(2, 7)
    const msgid = `${timestamp}${random}` // e.g., "5377730130q23se" (15 chars)
    
    console.log(`📝 Generated msgid: ${msgid} (${msgid.length} chars)`)
    
    // API endpoint
    const url = `https://alimtalk-api.sweettracker.net/v2/${PROFILE_KEY}/sendMessage`
    
    // Request payload for SMS/LMS (simpler - no template needed!)
    // Note: We use direct SMS/LMS instead of Alimtalk (AI) because:
    // - AI requires template registration with KakaoTalk (complex setup)
    // - SMS/LMS works immediately without templates
    const payload = [
      {
        msgid,                           // ✅ must be unique
        message_type: messageType,       // ✅ SMS or LMS (auto-detected)
        profile_key: PROFILE_KEY,
        receiver_num: normalizedPhone,   // ✅ 8210... format
        message,
        reserved_time: '00000000000000', // ✅ send immediately
        // Future: Can add Alimtalk (AI) with SMS fallback:
        // message_type: 'AI',
        // template_code: 'search_complete',
        // fall_back_yn: true,
        // fall_back_message_type: 'SM'
      }
    ]
    
    // Send request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        userid: USER_ID
      },
      body: JSON.stringify(payload)
    })
    
    const responseData = await response.json()
    
    if (response.ok) {
      console.log(`✅ ${messageType} sent successfully`)
      console.log(`   Response:`, responseData)
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
    process.env.NEXT_PUBLIC_BASE_URL || 'https://fashionsource.vercel.app'
  const resultsUrl = `${baseUrl}/search-results/${jobId}`
  const message = `✨ Your fashion search is ready!\nView your results here:\n${resultsUrl}`

  // Use the main sendSMS function (handles msgid generation correctly)
  return await sendSMS({
    to: phoneNumber,
    message
  })
}

