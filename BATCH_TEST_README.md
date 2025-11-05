# 🧪 Batch Testing Script for batch2 Images

## 📋 Overview

This script tests all images in `/Users/levit/Desktop/batch2` with their requested categories from the CSV file.

**What it does:**
1. ✅ Uploads each image to Supabase
2. ✅ Crops the image using the backend (with GPT-4o descriptions)
3. ✅ Checks if item descriptions are in filenames (for sub-type filtering)
4. ✅ Searches for products using your search API
5. ✅ Logs detailed results for each image
6. ✅ Saves a complete JSON report

---

## 🚀 Usage

### **Test ALL images (65 images):**
```bash
cd /Users/levit/Desktop/mvp
node batch_test_batch2.js
```

### **Test only first 5 images (for quick testing):**
```bash
node batch_test_batch2.js /Users/levit/Desktop/batch2_matched_info.csv /Users/levit/Desktop/batch2 5
```

### **Test only first 10 images:**
```bash
node batch_test_batch2.js /Users/levit/Desktop/batch2_matched_info.csv /Users/levit/Desktop/batch2 10
```

---

## 📊 What You'll See

For each image, the script shows:

```
================================================================================
📸 Testing: 41932fac32a3-Screenshot_20250923_095819.jpg
📞 Phone: '+821047219368
🎯 Requested: 가방, 악세사리
================================================================================

📤 Step 1: Uploading...
✅ Uploaded in 1.23s
   URL: https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/...

✂️  Step 2: Cropping for: bags, accessories
✅ Cropped in 28.45s
   Filename: accessories_gold_ring_1762251435336.jpg
   📝 Item description: "gold ring 1762251435336"
   ✅ Sub-type detected - filtering will work!

🔍 Step 3: Searching for products...
✅ Search completed in 12.34s

   📦 accessories: 3 links
      1. https://www.example.com/ring1
      2. https://www.example.com/ring2
      3. https://www.example.com/ring3

✅ COMPLETED in 42.02s
```

---

## ⚠️ Important Checks

The script automatically checks:

### ✅ **Good (Sub-type filtering will work):**
```
   Filename: accessories_gold_ring_1762251435336.jpg
   📝 Item description: "gold ring 1762251435336"
   ✅ Sub-type detected - filtering will work!
```

### ❌ **Bad (Filtering won't work):**
```
   Filename: accessories_accessories_1762251435336.jpg
   📝 Item description: "accessories 1762251435336"
   ⚠️  Generic description - filtering may not work
```

### ❌ **Very Bad (No filtering at all):**
```
   Filename: crop_1762251435336.jpg
   ❌ No item description in filename - filtering will NOT work!
```

---

## 📄 Output

### **Console Output:**
- Real-time progress for each image
- Detailed logs of each step
- Summary at the end

### **JSON Report:**
Saved to: `batch_test_results_YYYY-MM-DDTHH-mm-ss.json`

Contains:
```json
[
  {
    "filename": "41932fac32a3-Screenshot_20250923_095819.jpg",
    "phone": "'+821047219368",
    "requested_categories": "가방, 악세사리",
    "status": "success",
    "upload_time": "1.23",
    "crop_time": "28.45",
    "search_time": "12.34",
    "total_time": "42.02",
    "cropped_urls": {
      "accessories": "https://..."
    },
    "search_results": {
      "accessories": [
        "https://link1.com",
        "https://link2.com",
        "https://link3.com"
      ]
    },
    "errors": []
  }
]
```

---

## 📊 Final Summary

At the end, you'll see:

```
================================================================================
📊 BATCH TEST SUMMARY
================================================================================
✅ Successful: 60/65
❌ Failed: 5/65

⏱️  Average Times:
   Upload: 1.34s
   Crop: 29.12s
   Search: 15.67s
   Total: 46.13s

📄 Full report saved to: batch_test_results_2025-11-04T12-34-56.json

❌ Failed Tests:
   - image1.jpg: Crop failed: timeout
   - image2.jpg: Search failed: No results

✅ Batch test complete!
```

---

## 🎯 Category Mapping

The script automatically converts Korean categories to API categories:

| Korean | English API |
|--------|-------------|
| 전체 코디 | All categories |
| 상의 | tops |
| 하의 | bottoms |
| 신발 | shoes |
| 가방 | bags |
| 악세사리 | accessories |

---

## ⚡ Tips

1. **Start small:** Test 5 images first to verify everything works
2. **Check backend logs:** Modal logs will show GPT-4o responses
3. **Monitor filtering:** Look for "Sub-type detected" messages
4. **Review results:** Check the JSON report for detailed analysis
5. **2-second delay:** Script waits 2s between images to avoid rate limits

---

## 🐛 Troubleshooting

**"File not found" error:**
```bash
# Make sure CSV and batch2 folder paths are correct
ls /Users/levit/Desktop/batch2_matched_info.csv
ls /Users/levit/Desktop/batch2/*.jpg
```

**"Search API failed" error:**
```bash
# Make sure your Next.js dev server is running
npm run dev
```

**"Backend timeout" error:**
- Modal cold start can take 60-90s for first request
- Subsequent requests should be faster (10-30s)

---

## 📝 Notes

- **Total estimated time for 65 images:** ~50 minutes (assuming 45s per image)
- **First image:** May take longer (cold start)
- **Subsequent images:** Faster (warm backend)
- **Rate limits:** 2-second delay between images to be safe

---

**Ready to test!** 🚀

Start with 5 images to verify everything works:
```bash
cd /Users/levit/Desktop/mvp
node batch_test_batch2.js /Users/levit/Desktop/batch2_matched_info.csv /Users/levit/Desktop/batch2 5
```

