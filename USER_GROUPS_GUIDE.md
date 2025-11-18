# 👥 User Groups: Friends' Friends vs. Naver Community Members

## 🎯 Your Two User Groups (CORRECTED!)

### 1. **👥 Friends' Friends** (Organic/Word-of-Mouth)
**Source**: Complete strangers who found you through friends sharing

**Identifier**: Phone in `users` table but NOT in `result_page_visits`

**Journey**:
1. Friend tells them about your app (word-of-mouth)
2. They go directly to your main app
3. Upload their own fashion photo
4. Register with phone number → `users` table
5. See results and click products → `link_clicks` table
6. Maybe submit feedback → `user_feedback` table

**What you DON'T know about them**:
- You don't have their phone numbers initially
- You don't know who they are until they register
- Pure organic growth!

---

### 2. **🌐 Naver Community Members** (You Handpick & Send SMS)
**Source**: You find them in Naver communities, they already posted fashion images

**Identifier**: Phone exists in `result_page_visits` table

**Journey**:
1. They post a fashion image in Naver community
2. **YOU find their post** and handpick them
3. **YOU send them SMS** with their batch result link
4. They visit batch HTML page → `result_page_visits`
5. They see their results (products already found)
6. Maybe click products on batch page → `clicked_products = true`
7. Maybe click "다른 이미지도 찾아보기" → converts to main app
8. Maybe register in main app → `users` table
9. Maybe click products in main app → `link_clicks`
10. Maybe submit feedback → `user_feedback`

**What you DO know about them**:
- You have their phone numbers (from Naver)
- You know what image they posted
- You proactively reached out to them

---

## 📊 Key Differences

| Aspect | Friends' Friends 👥 | Naver Community 🌐 |
|--------|---------------------|-------------------|
| **Discovery** | They find you (organic) | You find them (outreach) |
| **Entry Point** | Main app first page | SMS batch result link |
| **Phone Number** | You learn when they register | You have it from Naver |
| **Image** | They upload fresh | You process their Naver post |
| **Cost** | $0 (organic) | SMS cost + your time |
| **Intent** | High (they sought you) | Medium (you reached them) |
| **Scale** | Limited by word-of-mouth | Limited by your time handpicking |

---

## 🔍 How to Identify Each Group

### In SQL:

```sql
-- Friends' Friends (Organic)
SELECT * FROM users 
WHERE phone_number NOT IN (SELECT phone_number FROM result_page_visits);

-- Naver Community (You Sent SMS)
SELECT * FROM users 
WHERE phone_number IN (SELECT phone_number FROM result_page_visits);
```

---

## 📈 What Metrics Matter for Each Group

### Friends' Friends (Organic):
- ✅ **Growth rate** - How fast is word-of-mouth spreading?
- ✅ **Conversion to clicks** - Do they engage once they join?
- ✅ **Retention** - Do they come back? (total_searches)
- ✅ **Viral coefficient** - Does 1 user bring more users?

### Naver Community (Outreach):
- ✅ **Response rate** - % who click your SMS link
- ✅ **Engagement on batch page** - Time spent, products clicked
- ✅ **Conversion to main app** - % who join after seeing results
- ✅ **ROI** - Is your outreach effort worth it?

---

## 🎯 Current Status (Based on Your Data)

### Main App (17 users):
- Some are Friends' Friends (organic) 👥
- Some converted from Naver after seeing batch results 🌐

### Batch SMS Sent:
- **75 unique Naver community members** 🌐
- **231 batch page visits**
- **34 feedback submissions**

### Need to Calculate:
1. Of the 17 main app users, how many are Friends vs. Naver?
2. Of the 75 Naver members, how many converted to main app?
3. Which group clicks more products?

**Run `USER_SEGMENTATION.sql` to find out!** 📊

---

## 🚀 How to Use This Data

### For Friends' Friends (Organic):
**Goal**: Maximize word-of-mouth growth

**Actions**:
- Make app more shareable
- Add referral incentives
- Track which features they share most
- Optimize onboarding for new users

### For Naver Community (Outreach):
**Goal**: Optimize your outreach ROI

**Actions**:
- Track which Naver posts convert best
- A/B test SMS messages
- Measure time spent handpicking vs. results
- Decide if outreach is sustainable

---

## 💡 Strategic Insights You'll Get

### Engagement Comparison:
```
👥 Friends' Friends:
  - Higher intent (they sought you out)
  - Lower volume (limited by word-of-mouth)
  - Possibly higher conversion rates

🌐 Naver Community:
  - Lower intent (you interrupted them)
  - Higher volume (you control outreach)
  - Possibly lower conversion rates
```

### Growth Strategy:
- If **Friends' Friends** engage better → Focus on product, let it spread
- If **Naver Community** converts well → Scale your outreach

---

## 📊 Run This Query Structure:

```sql
-- Quick check: How many in each group?
SELECT 
    CASE 
        WHEN phone_number IN (SELECT phone_number FROM result_page_visits) 
        THEN '🌐 Naver (You Sent)'
        ELSE '👥 Friends (Organic)'
    END as user_group,
    COUNT(*) as users
FROM users
GROUP BY user_group;
```

---

## 🎊 Next Steps

1. **Run `USER_SEGMENTATION.sql`** - See both groups side by side
2. **Analyze conversion rates** - Which group engages more?
3. **Calculate ROI** - Is Naver outreach worth your time?
4. **Make decisions** - Double down on what works!

---

## 🔥 Key Question to Answer:

**"Should I spend time handpicking Naver posts, or just make the app better so Friends' Friends spread it?"**

The segmentation queries will tell you! 📈
