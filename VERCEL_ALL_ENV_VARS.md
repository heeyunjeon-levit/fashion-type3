# Complete Environment Variables for Vercel

## ⚠️ You Need to Add These 4 Environment Variables to Vercel

Your MVP needs these environment variables to work properly:

### 1. NEXT_PUBLIC_PYTHON_CROPPER_URL
✅ **Already added!**

```
Name: NEXT_PUBLIC_PYTHON_CROPPER_URL
Value: https://heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run
```

### 2. NEXT_PUBLIC_SUPABASE_URL
❌ **Missing - causing the upload failure!**

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: [Get from your .env file or Supabase dashboard]
```

To find this:
- Check your `.env` file in the project
- Or go to https://supabase.com/dashboard → Your Project → Settings → API

### 3. NEXT_PUBLIC_SUPABASE_ANON_KEY
❌ **Missing - causing the upload failure!**

```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Get from your .env file or Supabase dashboard]
```

To find this:
- Check your `.env` file in the project
- Or go to https://supabase.com/dashboard → Your Project → Settings → API → `anon` `public` key

### 4. OPENAI_API_KEY
❌ **Missing - needed for GPT-4o analysis**

```
Name: OPENAI_API_KEY
Value: [Get from your .env file or OpenAI dashboard]
```

To find this:
- Check your `.env` file in the project
- Or go to https://platform.openai.com/api-keys

### 5. SERPER_API_KEY
❌ **Missing - needed for product search**

```
Name: SERPER_API_KEY
Value: [Get from your .env file or Serper dashboard]
```

To find this:
- Check your `.env` file in the project
- Or go to https://serper.dev/api-key

---

## How to Add All Variables to Vercel

### Quick Method: Copy from Local .env

I can help you get the values from your local `.env` file.

### Step-by-Step:

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Click your project (`mvp`)
   - Go to **Settings** → **Environment Variables**

2. **Add each variable:**
   - Click **Add New** for each one
   - Copy the name and value exactly
   - Select **Production**, **Preview**, and **Development**
   - Click **Save**

3. **Redeploy:**
   - After adding all variables, Vercel will auto-redeploy
   - Or manually trigger: Go to **Deployments** → Click **⋯** → **Redeploy**

---

## Quick Copy-Paste Format

Once you have all the values, you can add them in Vercel:

```
NEXT_PUBLIC_PYTHON_CROPPER_URL=https://heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
OPENAI_API_KEY=sk-...
SERPER_API_KEY=your-serper-key-here
```

---

## After Adding All Variables

Your MVP will have full functionality:
- ✅ Image upload (Supabase)
- ✅ Image cropping (Modal backend)
- ✅ Product search (Serper API)
- ✅ Result filtering (OpenAI GPT-4o)

The upload error will be fixed! 🎉

