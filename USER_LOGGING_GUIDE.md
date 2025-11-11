# User Logging & Analytics System

## 📊 Overview

A comprehensive user tracking system that logs every step of the user journey while collecting phone numbers for user interviews. The system uses a smart UX pattern: users can see results first, but must enter their phone number to access product links.

---

## 🎯 What Gets Tracked

### 1. **User Uploaded Image**
- Image URL
- Upload timestamp
- Session ID

### 2. **GPT Analysis**
- Detected items (categories, descriptions)
- GroundingDINO prompts
- Analysis timestamp
- Number of items found

### 3. **Generated Cropped Images**
- All cropped item URLs
- Item categories and descriptions
- Cropping timestamp

### 4. **User Selected Cropped Images**
- Which items user chose to search
- Selection timestamp
- Number of items selected

### 5. **GPT Selection Reasoning**
- Full search results from Serper
- GPT prompts used for filtering
- Selected links for each item
- Reasoning metadata

### 6. **User Clicked Links**
- Product link URL
- Product title and thumbnail
- Item category and description
- Link position (1st, 2nd, or 3rd link)
- Click timestamp
- Session and user IDs

### 7. **Phone Numbers**
- Phone number (Korean format)
- Country code
- Collection timestamp
- Returning user detection
- Total search count per user

---

## 🗄️ Database Schema

### Tables

#### `users`
Stores unique users identified by phone number.

```sql
- id: UUID (primary key)
- phone_number: TEXT (unique)
- country_code: TEXT (default: '+82')
- created_at: TIMESTAMP
- last_active_at: TIMESTAMP
- total_searches: INTEGER
- notes: TEXT (for user interview notes)
```

#### `sessions`
Tracks each complete user journey from upload to results.

```sql
- id: UUID (primary key)
- session_id: TEXT (unique, client-generated)
- user_id: UUID (references users)
- phone_number: TEXT
- status: TEXT (in_progress, completed, abandoned)
- uploaded_image_url: TEXT
- gpt_analysis: JSONB
- cropped_images: JSONB
- selected_items: JSONB
- search_results: JSONB
- gpt_selection_reasoning: JSONB
- timestamps for each step
```

#### `events`
Detailed event log for all user actions.

```sql
- id: UUID (primary key)
- session_id: UUID (references sessions)
- user_id: UUID (references users)
- event_type: TEXT
- event_data: JSONB
- created_at: TIMESTAMP
```

Event types:
- `image_upload`
- `gpt_analysis`
- `items_cropped`
- `items_selected`
- `search_completed`
- `phone_provided`
- `link_clicked`

#### `link_clicks`
Tracks which product links users clicked.

```sql
- id: UUID (primary key)
- session_id: UUID
- user_id: UUID
- item_category: TEXT
- item_description: TEXT
- product_link: TEXT
- product_title: TEXT
- product_thumbnail: TEXT
- link_position: INTEGER (1, 2, or 3)
- clicked_at: TIMESTAMP
```

---

## 🚀 Setup Instructions

### Step 1: Create Database Tables

1. Go to your Supabase SQL Editor
2. Copy and paste the contents of `supabase_logging_schema.sql`
3. Run the SQL script
4. Verify tables are created

### Step 2: Add Service Role Key

Add this environment variable to your Vercel project:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**How to find it:**
1. Go to Supabase Dashboard → Settings → API
2. Copy the "service_role" key (secret key)
3. **Never expose this key to the client!**

### Step 3: Deploy Updated Code

```bash
git add .
git commit -m "Add user logging and phone number collection"
git push
```

Vercel will automatically deploy the changes.

### Step 4: Test the System

1. Visit your deployed app
2. Upload an image
3. Go through the flow
4. When results appear, you should see the phone modal
5. Enter a test phone number (e.g., 010-1234-5678)
6. Click a product link
7. Check Supabase tables to verify data is logged

---

## 🎨 UX Flow

### The "Post-it" Modal Pattern

```
User uploads image
       ↓
AI analyzes & crops
       ↓
User selects items
       ↓
AI searches products
       ↓
Results appear (BLURRED) + Phone modal pops up ← 📱 You are here!
       ↓
User enters phone number
       ↓
Links become clickable
       ↓
User clicks links (tracked!)
```

**Why this works:**
- ✅ Value-first: Users see results before giving phone
- ✅ Low friction: Only one input field
- ✅ Clear benefit: "Enter phone to access links"
- ✅ Trust: Privacy note included
- ✅ Memorable: Yellow "post-it" design stands out

---

## 📱 Phone Number Collection

### Format
- **Expected:** Korean phone numbers (010-XXXX-XXXX)
- **Auto-formatting:** As user types
- **Validation:** Length and format checks
- **Storage:** Cleaned format (01012345678)

### Returning Users
- Phone number stored in `localStorage`
- System detects returning users
- Shows personalized message: "다시 찾아주셨네요! 👋"
- Tracks total searches per user

---

## 🔍 Querying Data

### View All Sessions with User Info

```sql
SELECT * FROM session_analytics
ORDER BY created_at DESC;
```

### Find Users Who Clicked Multiple Links

```sql
SELECT 
    u.phone_number,
    u.total_searches,
    COUNT(lc.id) as total_clicks
FROM users u
LEFT JOIN link_clicks lc ON u.id = lc.user_id
GROUP BY u.id
HAVING COUNT(lc.id) > 1
ORDER BY total_clicks DESC;
```

### Get Session Details

```sql
SELECT 
    s.session_id,
    s.phone_number,
    s.uploaded_image_url,
    s.gpt_analysis->'items' as detected_items,
    s.selected_items,
    s.created_at
FROM sessions s
WHERE s.phone_number IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 10;
```

### Track Conversion Funnel

```sql
SELECT 
    COUNT(DISTINCT CASE WHEN uploaded_image_url IS NOT NULL THEN session_id END) as uploaded,
    COUNT(DISTINCT CASE WHEN gpt_analysis IS NOT NULL THEN session_id END) as analyzed,
    COUNT(DISTINCT CASE WHEN selected_items IS NOT NULL THEN session_id END) as selected,
    COUNT(DISTINCT CASE WHEN phone_number IS NOT NULL THEN session_id END) as provided_phone,
    COUNT(DISTINCT lc.session_id) as clicked_links
FROM sessions s
LEFT JOIN link_clicks lc ON s.id = lc.session_id;
```

### Find Most Popular Product Categories

```sql
SELECT 
    item_category,
    COUNT(*) as click_count
FROM link_clicks
GROUP BY item_category
ORDER BY click_count DESC;
```

### Get Users for Interviews (Most Active)

```sql
SELECT 
    phone_number,
    total_searches,
    created_at as first_visit,
    last_active_at as last_visit,
    (SELECT COUNT(*) FROM link_clicks WHERE user_id = users.id) as total_clicks
FROM users
WHERE total_searches >= 2  -- Visited at least twice
ORDER BY total_searches DESC, total_clicks DESC
LIMIT 20;
```

---

## 🛡️ Privacy & Security

### What We Do
- ✅ Store only phone numbers (no names, emails, etc.)
- ✅ Use Supabase Row Level Security (RLS)
- ✅ Service role key kept on server only
- ✅ Clear privacy notice in modal

### What Users See
"🔒 전화번호는 안전하게 보관되며 사용자 인터뷰 목적으로만 사용됩니다"

Translation: "Phone numbers are securely stored and used only for user interviews"

### GDPR / Data Protection
If you need to delete user data:

```sql
-- Delete all data for a specific phone number
DELETE FROM users WHERE phone_number = '01012345678';
-- (Cascading deletes will remove related sessions, events, clicks)
```

---

## 📊 Analytics Dashboard Ideas

You can build a dashboard using:
1. **Supabase + Retool** (no-code dashboard)
2. **Metabase** (open-source BI tool)
3. **Custom Next.js page** with charts (Recharts, Chart.js)

### Key Metrics to Track
- Total sessions
- Conversion rate (upload → phone submission)
- Average items detected per image
- Most clicked product categories
- Returning user rate
- Average time to phone submission

---

## 🐛 Troubleshooting

### Phone modal doesn't appear
- Check console for errors
- Verify `PhoneModal` component is imported
- Check `showPhoneModal` state in Results.tsx

### Data not saving to Supabase
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- Check Supabase logs for RLS policy errors
- Make sure tables were created with SQL script

### "User already exists" error
- This is normal for returning users
- The system updates their `last_active_at` and `total_searches`

### Session tracking not working
- Check if `sessionManager` is initialized
- Verify `lib/sessionManager.ts` is imported
- Check browser console for session ID

---

## 📞 Conducting User Interviews

### Step 1: Export User List

```sql
SELECT 
    phone_number,
    total_searches,
    last_active_at,
    notes
FROM users
WHERE total_searches >= 2
ORDER BY last_active_at DESC;
```

### Step 2: Review Their Sessions

```sql
SELECT 
    s.*,
    (SELECT COUNT(*) FROM link_clicks WHERE session_id = s.id) as clicks_count
FROM sessions s
WHERE s.phone_number = '01012345678'
ORDER BY s.created_at DESC;
```

### Step 3: Call & Interview

Sample questions:
- "What were you looking for when you used our service?"
- "Did the product links match what you expected?"
- "What could we improve?"

### Step 4: Add Notes

```sql
UPDATE users 
SET notes = '긍정적인 피드백. 상의 검색 정확도 높음. 더 많은 브랜드 원함.'
WHERE phone_number = '01012345678';
```

---

## 🎉 Success!

Your logging system is now tracking:
- ✅ Every uploaded image
- ✅ Every GPT analysis
- ✅ Every cropped image
- ✅ Every user selection
- ✅ Every product search
- ✅ Every link click
- ✅ Every phone number
- ✅ Returning user detection

You can now:
- 📊 Analyze user behavior
- 📞 Conduct targeted user interviews
- 🔍 Find your most engaged users
- 💡 Improve your product based on data

**Next steps:**
1. Monitor the first 50 sessions
2. Identify patterns in user behavior
3. Reach out to returning users for interviews
4. Iterate based on feedback

Good luck! 🚀

