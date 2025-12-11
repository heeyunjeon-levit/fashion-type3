# 📱 Phone Number UI Integration Guide

This guide shows how to add phone number collection to your existing UI.

---

## Option 1: Quick Integration (Recommended)

Add phone number collection to your existing search flow in `app/page.tsx`.

### Step 1: Add State for Phone Number

```typescript
// In app/page.tsx, add these state variables:
const [phoneNumber, setPhoneNumber] = useState('')
const [showPhoneModal, setShowPhoneModal] = useState(false)
const [pendingSearchData, setPendingSearchData] = useState<any>(null)
```

### Step 2: Modify Search Handler

```typescript
// Change your existing handleItemsSelected to show phone modal first:
const handleItemsSelected = async (allBboxes: BboxItem[]) => {
  const selected = allBboxes.filter(b => b.selected)
  
  if (selected.length === 0) {
    alert('Please select at least one item')
    return
  }
  
  // Store search data and show phone modal
  setPendingSearchData({ allBboxes, selected })
  setShowPhoneModal(true)
}

// Create new handler for after phone is provided:
const handlePhoneSubmitAndSearch = async (phone: string) => {
  setShowPhoneModal(false)
  setPhoneNumber(phone)
  
  const { allBboxes, selected } = pendingSearchData
  
  // Rest of your existing search logic here...
  // But add phoneNumber to the API call:
  
  const response = await fetch('/api/search-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categories,
      croppedImages,
      descriptions,
      originalImageUrl,
      phoneNumber: phone,  // ⭐ Add this
      countryCode: '+82'   // ⭐ Add this (or detect from phone input)
    })
  })
  
  // Show success message
  alert(`✨ Search started! You'll receive an SMS at ${phone} when ready.`)
}
```

### Step 3: Add Phone Modal Component

```typescript
// Add this component in app/page.tsx or create separate component:
function PhoneNumberModal({ onSubmit, onSkip, onClose }: {
  onSubmit: (phone: string) => void
  onSkip: () => void
  onClose: () => void
}) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  
  const handleSubmit = () => {
    // Basic validation
    if (!phone) {
      setError('Please enter a phone number')
      return
    }
    
    // Format phone (add +82 if not present)
    let formatted = phone.replace(/[^0-9+]/g, '')
    if (!formatted.startsWith('+')) {
      formatted = '+82' + formatted.replace(/^0/, '')
    }
    
    if (formatted.length < 12) {
      setError('Please enter a valid phone number')
      return
    }
    
    onSubmit(formatted)
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-2">Get Results via SMS</h2>
        <p className="text-gray-600 mb-6">
          Enter your phone number to receive your search results via text message
        </p>
        
        <input
          type="tel"
          placeholder="010-1234-5678"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            setError('')
          }}
          className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 mb-2 text-lg"
        />
        
        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            className="flex-1 bg-black text-white py-3 rounded-full font-semibold hover:bg-gray-800 transition"
          >
            Get SMS
          </button>
          <button
            onClick={onSkip}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-full font-semibold hover:bg-gray-300 transition"
          >
            Skip
          </button>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          We'll send you a link to view your results. Standard SMS rates may apply.
        </p>
      </div>
    </div>
  )
}
```

### Step 4: Render Phone Modal

```typescript
// In your component's return statement, add:
{showPhoneModal && (
  <PhoneNumberModal
    onSubmit={handlePhoneSubmitAndSearch}
    onSkip={() => {
      setShowPhoneModal(false)
      // Continue with normal search (without SMS)
      handleItemsSelected(pendingSearchData.allBboxes)
    }}
    onClose={() => setShowPhoneModal(false)}
  />
)}
```

---

## Option 2: Always Collect Phone (Simpler)

If you want to always require phone number before allowing search:

### Step 1: Add Phone Input to Initial UI

```typescript
// Add before the "Start Search" button:
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Phone Number (for SMS notification)
  </label>
  <input
    type="tel"
    placeholder="010-1234-5678"
    value={phoneNumber}
    onChange={(e) => setPhoneNumber(e.target.value)}
    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg"
  />
  <p className="text-xs text-gray-500 mt-1">
    You'll receive an SMS when your search is ready
  </p>
</div>
```

### Step 2: Validate Phone Before Search

```typescript
const handleItemsSelected = async (allBboxes: BboxItem[]) => {
  const selected = allBboxes.filter(b => b.selected)
  
  if (selected.length === 0) {
    alert('Please select at least one item')
    return
  }
  
  if (!phoneNumber) {
    alert('Please enter your phone number to receive results')
    return
  }
  
  // Continue with search...
}
```

---

## Option 3: Phone Number in Results Page (After Search)

Collect phone after search starts:

```typescript
// Show phone input during processing:
{isSearching && !phoneNumber && (
  <div className="fixed bottom-0 left-0 right-0 bg-white p-6 shadow-lg">
    <p className="text-sm text-gray-600 mb-3">
      Want to receive results via SMS? Enter your number:
    </p>
    <div className="flex gap-3">
      <input
        type="tel"
        placeholder="010-1234-5678"
        onChange={(e) => setPhoneNumber(e.target.value)}
        className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-2"
      />
      <button
        onClick={async () => {
          // Send phone to backend to update job
          await fetch(`/api/search-job/${jobId}/update-phone`, {
            method: 'POST',
            body: JSON.stringify({ phoneNumber })
          })
          alert('✅ Phone number saved! You will receive SMS.')
        }}
        className="bg-black text-white px-6 py-2 rounded-lg font-semibold"
      >
        Save
      </button>
    </div>
  </div>
)}
```

---

## Phone Number Formatting

### Korean Phone Numbers

```typescript
function formatKoreanPhone(input: string): string {
  // Remove all non-digits
  let digits = input.replace(/[^0-9]/g, '')
  
  // Remove leading 0 if present
  if (digits.startsWith('0')) {
    digits = digits.substring(1)
  }
  
  // Add +82 country code
  return '+82' + digits
}

// Example:
formatKoreanPhone('010-1234-5678')  // → '+821012345678'
formatKoreanPhone('01012345678')    // → '+821012345678'
```

### International Phone Numbers

Consider using `react-phone-number-input` library:

```bash
npm install react-phone-number-input
```

```typescript
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

<PhoneInput
  placeholder="Enter phone number"
  value={phoneNumber}
  onChange={setPhoneNumber}
  defaultCountry="KR"
  className="..."
/>
```

---

## Testing Checklist

- [ ] Phone input shows up at the right time
- [ ] Phone validation works (rejects invalid numbers)
- [ ] Country code is added automatically
- [ ] Search proceeds after phone is entered
- [ ] SMS is received (check terminal logs)
- [ ] SMS link works when clicked
- [ ] Results page displays correctly

---

## Example: Complete Phone Modal Component

Here's a production-ready phone modal you can copy-paste:

```typescript
// app/components/PhoneNumberModal.tsx
'use client'

import { useState } from 'react'

interface PhoneNumberModalProps {
  onSubmit: (phoneNumber: string) => void
  onSkip?: () => void
  onClose: () => void
}

export default function PhoneNumberModal({ 
  onSubmit, 
  onSkip, 
  onClose 
}: PhoneNumberModalProps) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formatPhone = (input: string): string => {
    // Remove all non-digits
    let digits = input.replace(/[^0-9]/g, '')
    
    // Handle Korean numbers (010-XXXX-XXXX)
    if (digits.startsWith('0')) {
      digits = digits.substring(1)
    }
    
    // Add +82 for Korean numbers
    if (digits.length === 10 || digits.length === 11) {
      return '+82' + digits
    }
    
    // If already has +, keep it
    if (input.startsWith('+')) {
      return '+' + digits
    }
    
    return digits
  }

  const validatePhone = (phone: string): boolean => {
    // Must have at least 10 digits
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length < 10) {
      setError('Phone number is too short')
      return false
    }
    
    // Must start with + or digit
    if (!phone.match(/^[+0-9]/)) {
      setError('Invalid phone number format')
      return false
    }
    
    return true
  }

  const handleSubmit = async () => {
    if (!phone.trim()) {
      setError('Please enter a phone number')
      return
    }

    const formatted = formatPhone(phone)
    
    if (!validatePhone(formatted)) {
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      onSubmit(formatted)
    } catch (err) {
      setError('Failed to submit phone number')
      setIsSubmitting(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            📱 Get Results via SMS
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          Searching can take 1-2 minutes. Enter your phone number and we'll text you when it's ready!
        </p>

        {/* Phone Input */}
        <div className="mb-4">
          <input
            type="tel"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setError('')
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSubmit()
              }
            }}
            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg focus:border-black focus:outline-none transition"
            autoFocus
          />
          
          {error && (
            <p className="text-red-500 text-sm mt-2">⚠️ {error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 bg-black text-white py-3 rounded-full font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : '✨ Get SMS Notification'}
          </button>
        </div>

        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full text-gray-600 text-sm hover:text-gray-800 transition underline"
          >
            Skip (wait on this page instead)
          </button>
        )}

        {/* Fine Print */}
        <p className="text-xs text-gray-500 text-center mt-4">
          We'll send you a link when your results are ready. Standard SMS rates may apply.
        </p>
      </div>
    </div>
  )
}
```

---

## Next Steps

1. Choose integration option that fits your UX
2. Add phone input component
3. Update search handler to pass `phoneNumber`
4. Test with a real phone number
5. Check terminal logs for "SMS sent successfully"
6. Click the SMS link to verify results page works

---

**Questions?** Refer to `SMS_NOTIFICATION_SETUP.md` for backend setup details.

