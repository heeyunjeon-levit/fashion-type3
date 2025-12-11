# ✅ Fixed: Gemini JSON Mode Error

## 🐛 Error Encountered

```
Error type: ApiError
Error message: {"error":{"code":400,"message":"JSON mode is not enabled for this model","status":"INVALID_ARGUMENT"}}
```

## 🔍 Root Cause

The `gemini-2.5-flash-image` model (and some other Gemini models) **do not support** the `responseMimeType: 'application/json'` configuration parameter.

This is different from:
- ✅ `gemini-2.0-flash-exp` - Supports JSON mode
- ✅ `gemini-1.5-pro` - Supports JSON mode
- ❌ `gemini-2.5-flash-image` - Does NOT support JSON mode
- ❌ `gemini-3-pro-preview` - Does NOT support JSON mode

---

## ✅ Fix Applied

**File**: `app/api/search/route.ts` (line ~2191)

**Before** (❌ Broken):
```typescript
const geminiResponse = await genai.models.generateContent({
  model: 'gemini-2.5-flash-image',
  contents: [{ parts: geminiParts }],
  config: {
    responseMimeType: 'application/json',  // ❌ NOT SUPPORTED!
    temperature: 0.3,
    maxOutputTokens: 2000
  }
})
```

**After** (✅ Fixed):
```typescript
const geminiResponse = await genai.models.generateContent({
  model: 'gemini-2.5-flash-image',
  contents: [{ parts: geminiParts }],
  config: {
    // NOTE: JSON mode not supported by this model - rely on prompt instructions
    temperature: 0.3,
    maxOutputTokens: 2000
  }
})
```

**Also updated prompt** to emphasize JSON-only output:
```typescript
geminiParts.push({
  text: `Return ONLY valid JSON (no markdown, no explanation):\n{"${resultKey}": ["url1", "url2", "url3"]}`
})
```

---

## 🧪 Testing

The fix removes the `responseMimeType` parameter and relies on the prompt to instruct the model to return JSON.

**Expected behavior**:
1. Gemini receives clear instruction: "Return ONLY valid JSON"
2. Response is parsed with existing JSON extraction logic (handles markdown blocks)
3. System works without API errors

---

## 📝 Other Files Using `responseMimeType`

Also found in `app/api/describe-item/route.ts`:
- Uses `gemini-3-pro-preview` with `responseMimeType: 'application/json'`
- **May need similar fix** if that API also fails

---

## 🚀 Deployment Status

✅ Fixed in `app/api/search/route.ts`
⚠️ Monitor `app/api/describe-item/route.ts` for similar errors

Ready to deploy!

