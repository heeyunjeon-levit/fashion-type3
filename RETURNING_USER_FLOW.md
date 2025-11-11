# 🔄 Returning User Detection Flow

## How "Welcome Back! Phone: 010xxx" Works

### The Flow:

```
1️⃣ First Visit:
   User enters phone → 010-9084-8563
                    ↓
   API saves to database (users table)
                    ↓
   API returns userId (UUID)
                    ↓
   SessionManager stores in localStorage:
     ├─ localStorage.setItem('userId', 'uuid-xxx')
     └─ localStorage.setItem('phoneNumber', '01090848563')

2️⃣ User Closes Browser & Comes Back Later:
   SessionManager constructor runs
                    ↓
   Checks localStorage:
     ├─ userId = localStorage.getItem('userId')
     └─ phoneNumber = localStorage.getItem('phoneNumber')
                    ↓
   If both exist → isReturningUser() = true
                    ↓
   Console logs: "Welcome back! Phone: 010xxx"
                    ↓
   Phone modal shows: "다시 찾아주셨네요! 👋"
```

---

## The Code:

### 1. Storing Phone Number (First Visit)

**File:** `lib/sessionManager.ts`

```typescript
// When user submits phone number
async logPhoneNumber(phoneNumber: string) {
  const response = await fetch('/api/log/phone', {
    body: JSON.stringify({ sessionId, phoneNumber })
  })
  
  const data = await response.json()
  // data = { userId: 'uuid-xxx', isReturningUser: false }
  
  if (data.userId) {
    this.setUserInfo(data.userId, phoneNumber)  // ← Stores in localStorage!
  }
  
  return data
}

// Store in localStorage
setUserInfo(userId: string, phoneNumber: string) {
  this.userId = userId
  this.phoneNumber = phoneNumber
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('userId', userId)           // ← Persistent!
    localStorage.setItem('phoneNumber', phoneNumber) // ← Persistent!
  }
}
```

### 2. Checking on Return (Next Visit)

**File:** `lib/sessionManager.ts`

```typescript
constructor() {
  if (typeof window !== 'undefined') {
    // Read from localStorage
    this.userId = localStorage.getItem('userId')           // ← Reads stored value
    this.phoneNumber = localStorage.getItem('phoneNumber') // ← Reads stored value
  }
}

isReturningUser(): boolean {
  return this.userId !== null && this.phoneNumber !== null  // ← True if both exist
}

getPhoneNumber(): string | null {
  return this.phoneNumber  // ← Returns stored phone
}
```

### 3. Showing Welcome Message

**File:** `app/page.tsx`

```typescript
useEffect(() => {
  const manager = getSessionManager()
  
  if (manager.isReturningUser()) {
    console.log('Welcome back! Phone:', manager.getPhoneNumber())  // ← You see this!
  }
}, [])
```

### 4. Different Modal for Returning Users

**File:** `app/components/PhoneModal.tsx`

```tsx
export default function PhoneModal({ isReturningUser }) {
  return (
    <h2>
      {isReturningUser ? '다시 찾아주셨네요! 👋' : '잠깐만요! 📱'}
    </h2>
  )
}
```

---

## localStorage vs sessionStorage

| Storage Type | Lifetime | Scope |
|--------------|----------|-------|
| **localStorage** | ✅ Permanent (until cleared) | Same domain |
| **sessionStorage** | ❌ Current tab only | Single tab |

We use:
- **localStorage** for `userId` and `phoneNumber` (persistent across sessions)
- **sessionStorage** for `sessionId` (new session per tab/visit)

---

## Why They Come Back as "New" User Sometimes

If user:
- Clears browser cache/localStorage → Data lost
- Uses different browser → localStorage is per-browser
- Uses incognito mode → localStorage cleared on close
- Uses different device → localStorage is per-device

---

## Database Check

When user returns with existing phone:

**Query:**
```sql
SELECT * FROM users WHERE phone_number = '01090848563';
```

**Result:**
```
id: a1b2c3...
phone_number: 01090848563
total_searches: 2    ← Increments each visit!
created_at: 2025-11-11 10:00:00
last_active_at: 2025-11-11 12:30:00  ← Updates each visit!
```

---

## Testing Returning User Flow

### Simulate Returning User:

**1. Check localStorage in browser console:**
```javascript
localStorage.getItem('userId')        // Should show UUID
localStorage.getItem('phoneNumber')   // Should show 01090848563
```

**2. See returning user detection:**
```javascript
// Console should show:
Session ID: session_1762831021631_ynupzbpaf1j
Welcome back! Phone: 01090848563
```

**3. Clear localStorage to test "new user" flow:**
```javascript
localStorage.clear()
// Now refresh - should be treated as new user
```

---

## Summary

**Why you saw "Welcome back! Phone: 010xxx":**
1. You entered your phone on a previous visit
2. System stored `userId` and `phoneNumber` in **localStorage**
3. When you returned, SessionManager checked localStorage
4. Found existing values → Recognized you as returning user
5. Console logged welcome message
6. Phone modal showed "다시 찾아주셨네요! 👋"

**All this happens automatically!** No login required, just localStorage persistence. 🎉

