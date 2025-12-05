# Gemini API Key Setup

## New Environment Variable Required

The app now uses a dedicated **Gemini API key** (project-specific) instead of the general GCLOUD_API_KEY.

---

## Setup Instructions

### 1️⃣ Local Development (.env.local)

Add this to your `.env.local` file:

```bash
GEMINI_API_KEY=AIzaSyDihSandfaXG7YBYpbMYVedVMcHxfBMlTg
```

**Full `.env.local` example:**
```bash
# Gemini API (for product descriptions)
GEMINI_API_KEY=AIzaSyDihSandfaXG7YBYpbMYVedVMcHxfBMlTg

# Other existing keys...
GCLOUD_API_KEY=your-old-key-here
OPENAI_API_KEY=your-openai-key
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=your-supabase-key
# etc...
```

---

### 2️⃣ Vercel Production

**Add the environment variable in Vercel Dashboard:**

1. Go to: https://vercel.com/dashboard
2. Select your project (fashion-type3 or similar)
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Set:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** `AIzaSyDihSandfaXG7YBYpbMYVedVMcHxfBMlTg`
   - **Environment:** Check all (Production, Preview, Development)
6. Click **Save**
7. **Redeploy** the app (or it will use on next deploy)

---

## Code Changes

The code now checks for `GEMINI_API_KEY` first, with fallback to `GCLOUD_API_KEY`:

```typescript
// app/api/describe-item/route.ts
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GCLOUD_API_KEY || ''
)
```

**Priority:**
1. `GEMINI_API_KEY` (new, project-specific)
2. `GCLOUD_API_KEY` (fallback, old key)
3. Empty string (will error)

---

## Why This Change?

**Before:** Using general gcloud API key
- ❌ Shared across multiple services
- ❌ Quota limits shared
- ❌ Hard to track usage per service

**After:** Using dedicated Gemini API key
- ✅ Project-specific quota
- ✅ Better usage tracking
- ✅ No conflicts with other services
- ✅ More control over rate limits

---

## Testing

### Local Test (after adding to .env.local):

```bash
# Restart dev server
npm run dev

# Then upload an image
# Check console for:
🤖 Getting Gemini 2.0 Flash Exp description...
✅ Gemini 2.0 Flash Exp Description: "..."
```

### Verify Key Is Working:

If you see this in console:
```
✅ Gemini 2.0 Flash Exp Description: "beige straw hat"
   Prompt tokens: 1393, Completion tokens: 15
```

**Completion tokens > 0 = Key is working!** ✅

---

## Troubleshooting

### Error: "Invalid API key"
- Check the key is copied correctly (no extra spaces)
- Verify key starts with `AIza`
- Make sure it's set in the right environment

### Error: "API key not found"
- Restart dev server after adding to `.env.local`
- In Vercel: Redeploy after adding env variable

### Still timing out?
- Check API quota limits in Google Cloud Console
- Verify the key has Gemini API enabled

---

## Current Status

- ✅ Code updated to use `GEMINI_API_KEY`
- ⏳ Needs to be added to `.env.local` (local dev)
- ⏳ Needs to be added to Vercel (production)

---

**Next Steps:**
1. Add `GEMINI_API_KEY` to `.env.local`
2. Restart dev server
3. Test locally
4. Add to Vercel environment variables
5. Deploy!

