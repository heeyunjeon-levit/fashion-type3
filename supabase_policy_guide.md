# Supabase Storage Policy Setup Guide

You need to create 3 policies for the "images" bucket. Click the **"New policy"** button and create each one:

---

## Policy 1: Allow Public Uploads

Click **"New policy"** → **"For full customization"** (or "Create a policy")

### Settings:
- **Policy name**: `Allow public uploads to images`
- **Policy command**: `INSERT`
- **Target roles**: Select `public` or `anon`
- **USING expression**: Leave empty or use `true`
- **WITH CHECK expression**: 
```sql
bucket_id = 'images'
```

Click **Review** → **Save policy**

---

## Policy 2: Allow Public Reads

Click **"New policy"** again

### Settings:
- **Policy name**: `Allow public reads from images`
- **Policy command**: `SELECT`
- **Target roles**: Select `public` or `anon`
- **USING expression**:
```sql
bucket_id = 'images'
```
- **WITH CHECK expression**: Leave empty

Click **Review** → **Save policy**

---

## Policy 3: Allow Public Deletes (Optional)

Click **"New policy"** again

### Settings:
- **Policy name**: `Allow public deletes from images`
- **Policy command**: `DELETE`
- **Target roles**: Select `public` or `anon`
- **USING expression**:
```sql
bucket_id = 'images'
```
- **WITH CHECK expression**: Leave empty

Click **Review** → **Save policy**

---

## Alternative: Use Policy Templates

If Supabase offers policy templates:
1. Click **"New policy"**
2. Look for **"Allow public access"** or **"Allow anonymous access"** template
3. Select it and customize for the `images` bucket

---

## After Creating Policies

Once you've created the policies, test the upload by running:
```bash
node test_supabase.js
```

You should see "✅ Upload successful!" instead of the RLS error.

