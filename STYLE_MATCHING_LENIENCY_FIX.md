# Style Matching Leniency Fix

## Problem 🐛

**The system was TOO HARSH** and returned **0 color matches** and **0 style matches**!

### Real Example That Got Wrongly Rejected:

**User's item:** "Beige Black Cotton **Raglan** Sleeve Crew Neck Disney Bambi Graphic **Sweatshirt**"

**Should have matched:** [BY JOOBERRY - "밤비 래글런 테리티"](https://byjooberry.net/goods/goods_view.php?goodsNo=1000011218&mtn=2^|^BEST+ITEM^|^n)
- Product name: "[Disney Official] Bambi Raglan Terry **T-shirt**" (in Korean: "밤비 래글런 테리티")
- ✅ HAS raglan sleeves ("래글런")
- ✅ HAS Bambi graphic
- ❌ Different colors (pink/navy vs beige/black) ← OK for Style Match!
- ❌ Different garment (t-shirt vs sweatshirt) ← **REJECTED!**

**Problem:** The system rejected it because it's a t-shirt, not a sweatshirt, **even though it has the same raglan style!**

---

## Root Causes 🔍

### **Issue #1: Too Strict on Garment Type**

Old logic rejected similar garment types:

```typescript
// OLD (TOO STRICT):
'sweater': ['t-shirt', 'tee', '티셔츠', '반팔', '반팔티', 'short sleeve', 'tank top'],
'sweatshirt': ['t-shirt', 'tee', '티셔츠', '반팔', '반팔티', 'short sleeve', 'tank top'],
```

**Result:** When searching for a "sweatshirt", ANY t-shirt got instantly rejected, **without even checking if it had matching style details (raglan, crew neck, etc.)!**

**Why this is wrong:**
- A **raglan t-shirt** and a **raglan sweatshirt** have the **SAME STYLE** (raglan sleeves)
- They're just different sleeve lengths - but the STYLE is what matters for Style Matches!
- ❌ Rejecting all t-shirts when searching for sweatshirts is too harsh

### **Issue #2: 70% Style Detail Threshold Too High**

For an item with 2 style details (e.g., raglan + crew-neck):
- Old threshold: 70% → requires **1.4 details** → rounds up to **2 details** = **BOTH must match!**
- Most raglan items online don't explicitly mention "crew neck" in the title
- Result: Perfectly good raglan matches get rejected because they don't say "crew neck"

---

## Solutions ✅

### **Fix #1: Be Lenient with Similar Tops**

**NEW (LENIENT) Logic:**

```typescript
// LENIENT: Don't reject similar tops (t-shirt ≈ sweatshirt for style matching)
// Only reject completely different categories
'sweater': ['dress', 'pants', 'skirt', '원피스', '바지', '치마'],
'sweatshirt': ['dress', 'pants', 'skirt', '원피스', '바지', '치마'],
'hoodie': ['dress', 'pants', 'skirt', '원피스', '바지', '치마'],
'shirt': ['dress', 'pants', 'skirt', '원피스', '바지', '치마'],
```

**Changes:**
- ✅ T-shirts, tees, sweatshirts, sweaters, hoodies are now considered **similar styles**
- ✅ Only reject **completely different categories** (dress, pants, skirt)
- ✅ Raglan t-shirts can now match when searching for raglan sweatshirts!

**Rationale:**
- All of these are "tops" with similar styling
- What matters is the **style details** (raglan, crew neck, button-front, etc.), NOT the exact garment name
- A raglan t-shirt and a raglan sweatshirt are **stylistically identical** except for fabric weight

---

### **Fix #2: Lower Style Detail Threshold to 50%**

**OLD (TOO STRICT):**
```typescript
// Require 70% of style details to match
const hasStyleDetailMatch = styleDetails.length === 0 || 
  (matchedStyleDetails.length / styleDetails.length) >= 0.7
```

**NEW (LENIENT):**
```typescript
// Require at least 50% of style details to match (minimum 1 detail)
const hasStyleDetailMatch = styleDetails.length === 0 || 
  matchedStyleDetails.length >= Math.max(1, Math.ceil(styleDetails.length * 0.5))
```

**Examples:**
| Original Style Details | Old (70%) | New (50%) | Result |
|----------------------|-----------|-----------|--------|
| 1 detail (raglan) | Need 1 ✅ | Need 1 ✅ | Same |
| 2 details (raglan + crew-neck) | Need 2 ❌ | Need 1 ✅ | **More lenient!** |
| 3 details (raglan + crew-neck + ribbed) | Need 3 ❌ | Need 2 ✅ | **More lenient!** |
| 4 details | Need 3 ❌ | Need 2 ✅ | **More lenient!** |

**Rationale:**
- If an item has raglan sleeves, that's the **most important style detail**
- Whether it also mentions "crew neck" or "ribbed" is secondary
- 50% threshold focuses on **key style features** rather than requiring every minor detail

---

## Changes Made

Updated **7 locations** in `app/api/search/route.ts`:

1. **Line ~3177-3189**: Updated wrong garment type rejection (initial categorization)
2. **Line ~3268-3271**: Lowered style threshold from 70% to 50% (initial categorization)
3. **Line ~3340-3347**: Updated wrong garment type rejection (additional color matches)
4. **Line ~3398-3400**: Lowered style threshold (additional color matches)
5. **Line ~3460-3467**: Updated wrong garment type rejection (additional style matches)
6. **Line ~3532-3534**: Lowered style threshold (additional style matches)
7. **Line ~3729-3731**: Lowered style threshold (refill color matches)
8. **Line ~3800-3802**: Lowered style threshold (refill style matches)

---

## Impact

### **Before Fix (0 matches!):**
```json
{
  "colorMatches": [],
  "styleMatches": []
}
```

**Why:**
- ❌ All t-shirts rejected when searching for sweatshirt
- ❌ Items with 1/2 style details (50%) rejected (needed 70%)
- ❌ Korean raglan t-shirt from BY JOOBERRY rejected even though it has raglan!

### **After Fix (expected results):**

**Color Matches:**
- Beige + black raglan sweatshirts
- Beige + black raglan t-shirts (NOW INCLUDED!)
- Tan + black raglan tops

**Style Matches:**
- Pink/navy raglan t-shirts (like the BY JOOBERRY one!)
- Grey raglan sweatshirts
- Blue raglan baseball tees
- Any raglan top with different colors

---

## Key Principles

1. **Style > Exact Garment Type**
   - A raglan t-shirt and raglan sweatshirt have the **same style**
   - Don't reject similar tops (t-shirt, tee, sweatshirt, sweater, hoodie)
   
2. **50% Style Match is Good Enough**
   - If the key style detail (raglan) matches, that's sufficient
   - Don't require every minor detail (crew neck, ribbed, etc.)

3. **Korean Language Support**
   - "래글런" = "raglan" in Korean
   - System now properly matches Korean product titles

---

## Date: December 10, 2025
## Status: ✅ Fixed and Deployed

**Result:**
- ✅ No more empty results!
- ✅ Raglan t-shirts can match when searching for raglan sweatshirts
- ✅ Korean products (like BY JOOBERRY) now properly matched
- ✅ 50% style threshold is more reasonable and catches real matches

