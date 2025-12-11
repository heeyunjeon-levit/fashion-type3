# User Results Workflow - Visual Guide

## 📊 Complete Process Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                 Excel File (41 Users)                            │
│          Phone Number + Typeform Image URL                       │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 1: Download Images                             │
│  • Read Excel file (/Desktop/file+phonenumber.xlsx)             │
│  • Download each image from Typeform URL                         │
│  • Save locally: batch_user_results/[phone]_original.jpg        │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: Upload to Backend                           │
│  • POST /api/upload                                              │
│  • Upload image to S3                                            │
│  • Get permanent URL                                             │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 3: Detect & Crop Items                         │
│  • POST /api/crop                                                │
│  • GPU backend detects items (SAM + GPT)                         │
│  • Crop each item (tops, shoes, bags, etc.)                      │
│  • Upload crops to S3                                            │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 4: Search for Products                         │
│  • POST /api/search                                              │
│  • Search each item on Serper (Google Lens)                      │
│  • Get shopping links for each item                              │
│  • Filter and rank top 3 per category                            │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 5: Save Results                                │
│  • Save JSON: batch_user_results/[phone]_results.json           │
│  • Contains: cropped images, shopping links, GPT reasoning       │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 6: Generate HTML Pages                         │
│  • Create beautiful HTML: batch_user_results/html_pages/         │
│  • Each user gets personalized page                              │
│  • Mobile-responsive, professional design                        │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 7: Share Results                               │
│                                                                   │
│  Option A: SMS (Twilio/Aligo)                                    │
│  ├─ "분석 결과가 나왔습니다!"                                      │
│  └─ Include link to HTML page                                    │
│                                                                   │
│  Option B: KakaoTalk (Manual)                                    │
│  ├─ Host HTML pages on Vercel                                    │
│  └─ Send link manually                                           │
│                                                                   │
│  Option C: Email (Future)                                        │
│  └─ Send HTML email with results                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Processing Pipeline Per User

```
User: 1036393835
│
├─ Image URL: https://api.typeform.com/responses/files/623a4...
│
├─ [DOWNLOAD] → 1036393835_original.jpg
│
├─ [UPLOAD] → https://s3.amazonaws.com/.../1036393835.jpg
│
├─ [DETECT & CROP]
│  ├─ Detected: 3 items
│  ├─ Item 1: tops (gray jacket)
│  │  └─ Cropped: https://s3.amazonaws.com/.../crop_1.jpg
│  ├─ Item 2: bottoms (black pants)
│  │  └─ Cropped: https://s3.amazonaws.com/.../crop_2.jpg
│  └─ Item 3: bag (brown handbag)
│     └─ Cropped: https://s3.amazonaws.com/.../crop_3.jpg
│
├─ [SEARCH]
│  ├─ tops: [Link1, Link2, Link3] (Naver, Coupang, etc.)
│  ├─ bottoms: [Link1, Link2, Link3]
│  └─ bag: [Link1, Link2, Link3]
│
├─ [SAVE]
│  └─ 1036393835_results.json
│     {
│       "phone": "1036393835",
│       "status": "success",
│       "cropped_data": {...},
│       "search_results": {...}
│     }
│
├─ [GENERATE HTML]
│  └─ 1036393835.html
│     - Beautiful product cards
│     - Shopping links
│     - Mobile responsive
│
└─ [SHARE]
   └─ SMS/KakaoTalk: "결과가 나왔습니다! [link]"
```

---

## 📱 User Experience Flow

```
User receives message
        │
        ▼
"🎉 이미지 분석 결과가 나왔습니다!"
        │
        ▼
Opens link in browser
        │
        ▼
┌───────────────────────────────────┐
│     Beautiful HTML Page           │
│                                   │
│  [Photo of detected item 1]       │
│  상의 - Gray Jacket                │
│  ┌─────────┐ ┌─────────┐          │
│  │Product 1│ │Product 2│ ...      │
│  │  $49    │ │  $55    │          │
│  │  Buy →  │ │  Buy →  │          │
│  └─────────┘ └─────────┘          │
│                                   │
│  [Photo of detected item 2]       │
│  가방 - Brown Handbag              │
│  ┌─────────┐ ┌─────────┐          │
│  │Product 1│ │Product 2│ ...      │
│  └─────────┘ └─────────┘          │
└───────────────────────────────────┘
        │
        ▼
Clicks "구매하러 가기" button
        │
        ▼
Opens Naver Shopping / Coupang
        │
        ▼
User can purchase! 🛒
```

---

## 🗂 File Structure After Processing

```
mvp/
├── file+phonenumber.xlsx (in ~/Desktop/)
│
├── scripts/
│   ├── quick_start.sh ⭐ START HERE
│   ├── process_and_send_results.py
│   ├── generate_results_pages.py
│   ├── preview_messages.py
│   ├── test_backend_ready.py
│   └── setup_sms_env.sh
│
├── batch_user_results/              📦 GENERATED
│   ├── 1036393835_original.jpg      (downloaded image)
│   ├── 1036393835_results.json      (pipeline results)
│   ├── 1041577851_original.jpg
│   ├── 1041577851_results.json
│   ├── ... (all 41 users)
│   │
│   ├── html_pages/                  🌐 SHAREABLE PAGES
│   │   ├── 1036393835.html
│   │   ├── 1041577851.html
│   │   └── ... (all 41 users)
│   │
│   └── summary_20251113_120000.json (processing summary)
│
└── docs/
    ├── SEND_USER_RESULTS_README.md  📘 Quick start guide
    ├── USER_RESULTS_GUIDE.md        📗 Detailed guide
    └── RESULTS_WORKFLOW.md          📊 This file
```

---

## ⏱ Timeline Example (41 Users)

```
T+0:00   Start processing
         └─ Export BACKEND_URL
         └─ Run: ./scripts/quick_start.sh

T+0:05   Backend test complete ✅

T+0:10   User 1/41 processing...
         ├─ Download image (5s)
         ├─ Upload to S3 (3s)
         ├─ Crop items (20s)
         └─ Search products (15s)
         ✅ Done (43s)

T+0:50   User 2/41 processing...

T+30:00  All 41 users processed ✅
         └─ 41/41 successful

T+31:00  Generating HTML pages...
         ✅ 41 HTML pages created

T+32:00  Preview messages
         └─ Check message content

T+35:00  Host on Vercel
         └─ vercel --prod

T+37:00  Share links via KakaoTalk ✅
         └─ "결과가 나왔습니다! [link]"

DONE! 🎉
```

---

## 💰 Cost Breakdown (41 Users)

```
┌─────────────────────────────────────────────────┐
│ Processing Costs                                │
├─────────────────────────────────────────────────┤
│ Serper API (Google Lens search)                 │
│  • ~3 searches per user                         │
│  • 41 users × 3 = 123 searches                  │
│  • $5 per 1000 searches                         │
│  • Cost: $0.62                                  │
├─────────────────────────────────────────────────┤
│ AWS S3 Storage                                  │
│  • ~41 original images                          │
│  • ~123 cropped images                          │
│  • ~100MB total                                 │
│  • Cost: $0.02/month                            │
├─────────────────────────────────────────────────┤
│ GPU Backend (Modal)                             │
│  • Included in plan                             │
│  • Cost: $0.00                                  │
├─────────────────────────────────────────────────┤
│ PROCESSING SUBTOTAL: ~$0.62                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Messaging Costs (Optional)                      │
├─────────────────────────────────────────────────┤
│ Option A: Twilio (International SMS)            │
│  • $0.02-0.05 per SMS                           │
│  • 41 users                                     │
│  • Cost: $0.82 - $2.05                          │
├─────────────────────────────────────────────────┤
│ Option B: Aligo (Korean SMS)                    │
│  • ₩15-30 per SMS                               │
│  • 41 users                                     │
│  • Cost: ₩615-1,230 ($0.45-$0.90)              │
├─────────────────────────────────────────────────┤
│ Option C: KakaoTalk (Manual)                    │
│  • Free!                                        │
│  • Cost: $0.00                                  │
├─────────────────────────────────────────────────┤
│ Option D: Host HTML + Share Link                │
│  • Vercel hosting: Free                         │
│  • Share via KakaoTalk: Free                    │
│  • Cost: $0.00                                  │
└─────────────────────────────────────────────────┘

╔═════════════════════════════════════════════════╗
║ TOTAL COST:                                     ║
║  • Processing only: $0.62                       ║
║  • With Twilio SMS: $1.44 - $2.67               ║
║  • With Korean SMS: $1.07 - $1.52               ║
║  • With HTML pages: $0.62 (RECOMMENDED) ✅      ║
╚═════════════════════════════════════════════════╝
```

---

## 🎯 Decision Matrix

### When to use SMS

✅ **Use SMS when:**
- Users expect immediate notification
- You have budget for messaging
- Users don't all use KakaoTalk
- You want to automate completely

❌ **Don't use SMS when:**
- Budget is tight
- Results are not urgent
- Users are tech-savvy (can check links)
- You're doing a test run

### When to use HTML Pages + KakaoTalk

✅ **Use HTML Pages when:**
- You want professional presentation
- Users can revisit results later
- You want to avoid SMS costs
- Results contain many items/links

✅ **Use KakaoTalk when:**
- Users are in Korea (95% of Koreans use it)
- You want free messaging
- You're okay with manual sending
- You have access to KakaoTalk

---

## 🚀 Quick Decision Guide

**Answer these questions:**

1. **Do you need to send results TODAY?**
   - Yes → Use Twilio SMS (fastest setup)
   - No → Use HTML pages

2. **Do you have $2 budget for SMS?**
   - Yes → Use Twilio
   - No → Use HTML pages (free)

3. **Are all users in Korea?**
   - Yes → Use Korean SMS or KakaoTalk
   - No → Use Twilio

4. **Do you want users to revisit results later?**
   - Yes → Use HTML pages (required)
   - No → SMS with text only

**My Recommendation:** 🏆
```
1. Generate HTML pages (beautiful, free)
2. Host on Vercel (free, fast)
3. Share via KakaoTalk manually (free, personal touch)
```

---

## 📞 Support

Need help? Check these guides:
- 📘 `SEND_USER_RESULTS_README.md` - Quick start
- 📗 `USER_RESULTS_GUIDE.md` - Detailed instructions
- 📊 `RESULTS_WORKFLOW.md` - This file

Or just run: `./scripts/quick_start.sh` 🚀

