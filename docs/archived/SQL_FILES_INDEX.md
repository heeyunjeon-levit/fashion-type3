# 📚 SQL Files Index - Quick Reference

## 🚀 Start Here

**New to these queries?** → Read `RUN_ME_FIRST.md`

**Want to understand the metrics?** → Read `INSIGHTS_GUIDE.md`

---

## 🎯 Main Analytics Queries (Run These Regularly!)

### **1️⃣ `1_USER_GROUPS.sql`** 
**Purpose**: See how your users are segmented
- 📦 Batch SMS Only (saw results, didn't convert)
- ✅ Batch SMS Converts (clicked "다른 이미지도 찾아보기")
- 💼 Colleagues (testing the main app)

**Run**: Weekly or after each campaign

---

### **2️⃣ `2_CONVERSION_RATE.sql`**
**Purpose**: Track your conversion funnel
- SMS Sent → Links Opened → Main App Join → Product Clicks

**Run**: Weekly to track growth

---

### **3️⃣ `3_BATCH_CONVERTS_LIST.sql`**
**Purpose**: Detailed list of all converts
- Who converted?
- How active are they?
- Main app usage stats

**Run**: When you want to analyze individual converts

---

### **4️⃣ `BUSINESS_INSIGHTS.sql`** ⭐ **RECOMMENDED**
**Purpose**: Complete business dashboard
- Campaign performance metrics
- Engagement analysis
- Actionable next steps
- Statistical warnings

**Run**: Weekly for stakeholder updates

---

## 🔧 Diagnostic Queries (Troubleshooting)

### **`VERIFY_PHONE_MISMATCH.sql`**
**Purpose**: Check if phone numbers are matching correctly
- Shows format differences between tables
- Identifies missed conversions

**Run**: Only if conversion numbers seem wrong

---

### **`FIXED_USER_BREAKDOWN.sql`**
**Purpose**: All-in-one comprehensive query (7 sections)
- Note: Supabase may only show last section
- Better to use individual queries above

**Run**: If you want everything in one file

---

## 🗂️ Legacy/Deprecated Files

### ❌ **`REAL_USER_BREAKDOWN.sql`** (OLD - Don't Use!)
**Problem**: Didn't handle phone format mismatch
**Use instead**: `1_USER_GROUPS.sql` + `BUSINESS_INSIGHTS.sql`

### ❌ **`4_KEY_INSIGHTS.sql`** (OLD - Don't Use!)
**Problem**: Silly "winner" comparison with 1 user vs 11 users
**Use instead**: `BUSINESS_INSIGHTS.sql`

### 📁 **Other Old Files** (Keep for Reference)
- `USER_SEGMENTATION.sql` - Old grouping logic (had wrong definitions)
- `ALL_USERS_OVERVIEW.sql` - Had SQL errors, replaced by newer queries
- `CORRECT_USER_TRACKING.sql` - Superseded by BUSINESS_INSIGHTS.sql

---

## 📖 Documentation Files

### **`RUN_ME_FIRST.md`**
**Purpose**: Step-by-step guide to run all queries
**Read**: If this is your first time

### **`INSIGHTS_GUIDE.md`**
**Purpose**: Understand what BUSINESS_INSIGHTS.sql shows
**Read**: To interpret your metrics correctly

### **`CONVERSION_TRACKING_FIX.md`**
**Purpose**: Technical docs on phone number normalization fix
**Read**: If you want to understand the bug we fixed

### **`PHONE_FORMAT_FIX_GUIDE.md`**
**Purpose**: Detailed guide on the phone format issue
**Read**: For deep technical understanding

---

## 🎯 Quick Command Reference

### **Weekly Routine** (5 minutes)
```bash
1. Run BUSINESS_INSIGHTS.sql
2. Review metrics vs. last week
3. Check "Next Steps" section
4. Take action!
```

### **After New Campaign** (2 minutes)
```bash
1. Run 1_USER_GROUPS.sql → See new converts
2. Run 2_CONVERSION_RATE.sql → Check funnel
3. Run 3_BATCH_CONVERTS_LIST.sql → Who are they?
```

### **Monthly Deep Dive** (15 minutes)
```bash
1. Run BUSINESS_INSIGHTS.sql → Full dashboard
2. Export results to spreadsheet
3. Track trends over time
4. Adjust strategy based on insights
```

### **Debugging** (when something looks wrong)
```bash
1. Run VERIFY_PHONE_MISMATCH.sql → Check data integrity
2. Check for NULL values in key fields
3. Verify phone number formats are consistent
```

---

## 🔍 Finding Specific Information

### "How many people converted from my SMS campaign?"
→ `1_USER_GROUPS.sql` or `BUSINESS_INSIGHTS.sql`

### "Who are my converts and what are they doing?"
→ `3_BATCH_CONVERTS_LIST.sql`

### "What's my conversion rate?"
→ `2_CONVERSION_RATE.sql` or `BUSINESS_INSIGHTS.sql`

### "Is my data tracking correctly?"
→ `VERIFY_PHONE_MISMATCH.sql`

### "What should I do next?"
→ `BUSINESS_INSIGHTS.sql` (check "Next Steps" section)

---

## 🎓 Understanding the Phone Number Fix

All the main queries use the `normalize_phone()` function to handle:
- Korean format: `01048545690`
- International format: `821048545690`

This ensures users are correctly matched across tables!

**Created in**: `1_USER_GROUPS.sql` (automatically)

**Used in**: All main analytics queries

---

## 💡 Pro Tips

1. **Bookmark BUSINESS_INSIGHTS.sql** - It's your main dashboard
2. **Track metrics weekly** - Spot trends early
3. **Don't compare groups until 5+ converts** - Statistics need sample size!
4. **Your 45% feedback rate is AMAZING** - Keep that quality up!
5. **1.3% conversion is good** - Industry average for SMS→App is 1-3%

---

## 🚀 Your Current Status (Updated: Dec 2024)

- ✅ Phone format bug: FIXED
- ✅ User segmentation: WORKING (discovered 4 groups!)
- ✅ Conversion tracking: ACCURATE (1 organic + 10 interviewed!)
- ✅ First convert: FOUND (01048545690)
- ✅ Interview conversion: DISCOVERED (10 users = 13.3% rate!)
- 🔜 Next milestone: Set up conversion_source tracking

---

## 📞 Quick Stats

- **Total SQL Files**: 15+
- **Recommended to Use**: 4 main queries
- **Documentation Files**: 6 guides
- **Deprecated**: 3 old queries (keep for reference)

---

**Need help?** Check the relevant `.md` guide or re-run the diagnostic queries!

