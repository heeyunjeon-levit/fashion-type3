import twilio from 'twilio'

// Initialize Twilio client
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  
  if (!accountSid || !authToken) {
    console.error('❌ Twilio credentials not configured')
    return null
  }
  
  return twilio(accountSid, authToken)
}

export interface SendSMSParams {
  to: string
  message: string
}

/**
 * Send SMS notification using Twilio
 */
export async function sendSMS({ to, message }: SendSMSParams): Promise<boolean> {
  try {
    const client = getTwilioClient()
    
    if (!client) {
      console.error('❌ Twilio client not initialized')
      return false
    }
    
    const fromNumber = process.env.TWILIO_PHONE_NUMBER
    
    if (!fromNumber) {
      console.error('❌ TWILIO_PHONE_NUMBER not configured')
      return false
    }
    
    console.log(`📱 Sending SMS to ${to}`)
    
    const result = await client.messages.create({
      body: message,
      to: to,
      from: fromNumber
    })
    
    console.log(`✅ SMS sent successfully. SID: ${result.sid}`)
    return true
    
  } catch (error) {
    console.error('❌ Failed to send SMS:', error)
    return false
  }
}

/**
 * Send search results notification via SMS
 */
export async function sendSearchResultsNotification(phoneNumber: string, jobId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const resultsUrl = `${baseUrl}/results/${jobId}`
  
  const message = `✨ Your fashion search is ready! View your results here: ${resultsUrl}`
  
  return await sendSMS({
    to: phoneNumber,
    message
  })
}

