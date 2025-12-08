# 📋 3-Step Process: Fix Batch Interview Classification

## 🎯 Goal
Correctly classify the 9 "organic" users by checking if they're actually in your batch SMS list.

---

## 🚀 Run These Files In Order:

### **Step 1: Preview** ⭐ START HERE
**File**: `STEP1_PREVIEW_ORGANIC.sql`

**What it shows:**
- Lists all 9 "organic" users
- For each one: ✅ IN BATCH SMS or ❌ NOT IN BATCH
- Summary count

**Example output:**
```
phone_number   | action
01091368248   | ✅ IN BATCH SMS → will become batch_interview
01046907287   | ❌ NOT IN BATCH → stays organic

SUMMARY:
in_batch_sms: 8
truly_organic: 1
total_organic_now: 9
```

**Don't proceed until you review this!**

---

### **Step 2: Update**
**File**: `STEP2_UPDATE_BATCH_INTERVIEWS.sql`

**What it does:**
- Reclassifies users who ARE in batch SMS
- Changes them from `organic` → `batch_interview`
- Leaves truly organic users alone

**Run this ONLY after reviewing Step 1!**

---

### **Step 3: Verify**
**File**: `STEP3_FINAL_BREAKDOWN.sql`

**What it shows:**
- Final user breakdown by conversion_source
- Batch SMS campaign metrics
- Your true conversion rate

**Example output:**
```
conversion_source    | count | phone_numbers
colleague           | 7     | [...]
batch_interview     | 8     | [...]  ← Updated from organic!
batch_button_click  | 1     | [01048545690]
organic             | 1     | [...]  ← Truly organic users

BATCH SMS CAMPAIGN RESULTS:
Links Visited: 75
Converted After Interview: 8 (10.7%)
Colleagues: 7
Organic: 1
Total Main App Users: 16
```

---

## ❓ What To Expect

### **Most Likely Outcome:**
All 9 "organic" users are in batch SMS → become `batch_interview`
- Your conversion rate: 10/75 = 13.3%

### **Alternative Outcome:**
Some users are truly organic (not in batch SMS)
- Shows you have organic growth starting!
- Lower batch conversion rate, but that's accurate

---

## 🎯 The Key Question

**After Step 1, you'll know:**

How many of those 9 users actually got batch SMS links?

This tells you if your 13.3% conversion rate is real, or if some users came from other sources!

---

## 🚀 Get Started

**Run `STEP1_PREVIEW_ORGANIC.sql` now and show me the results!**

We'll see which users are batch SMS vs. truly organic! 🔍







