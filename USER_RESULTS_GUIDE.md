# Sending Results to Users - Complete Guide

This guide explains how to process images from your Excel file and send results to users.

## Overview

You have an Excel file (`/Desktop/file+phonenumber.xlsx`) with:
- 41 users
- Phone numbers (Korean format: 10XXXXXXXX)
- Image URLs (from Typeform submissions)

The pipeline will:
1. ✅ Download each image
2. ✅ Upload to your backend (S3)
3. ✅ Detect and crop products using GPU
4. ✅ Search for similar products online
5. ✅ Generate results (JSON + HTML pages)
6. 📱 Send results to users

---

## Quick Start (Recommended)

### Option 1: Generate HTML Pages (No SMS Setup Required)

This is the **easiest and fastest** option. Generate beautiful result pages and share links via KakaoTalk manually.

```bash
cd /Users/levit/Desktop/mvp

# Step 1: Process all images (test mode first - 3 users only)
export BACKEND_URL="https://your-app.vercel.app"  # or http://localhost:3000
python3 scripts/process_and_send_results.py --mode test --skip-sending

# Step 2: Generate HTML pages
python3 scripts/generate_results_pages.py

# Step 3: Review the results
open batch_user_results/html_pages/1036393835.html

# Step 4: If happy, process all 41 users
python3 scripts/process_and_send_results.py --mode production --skip-sending
python3 scripts/generate_results_pages.py
```

Then you can:
- Host the HTML pages on a simple web server
- Share links via KakaoTalk manually: "안녕하세요! 분석 결과가 나왔습니다: [link]"

---

### Option 2: Automated SMS via Twilio

If you want to automate SMS sending:

```bash
# Install Twilio
pip3 install twilio

# Set up environment variables
export SMS_SERVICE=twilio
export TWILIO_ACCOUNT_SID="your_account_sid"
export TWILIO_AUTH_TOKEN="your_auth_token"
export TWILIO_FROM_NUMBER="+1234567890"
export BACKEND_URL="https://your-app.vercel.app"

# Test with 3 users first
python3 scripts/process_and_send_results.py --mode test

# If successful, run for all 41 users
python3 scripts/process_and_send_results.py --mode production
```

**Note:** Twilio costs ~$0.01-0.05 per SMS to Korea. For 41 users ≈ $0.41-$2.05

---

### Option 3: Korean SMS Services (Cheaper)

For Korean users, use a Korean SMS service like Aligo:

1. **Sign up:** https://smartsms.aligo.in/
2. **Get credentials** (API Key, User ID, Sender Number)
3. **Modify the script** (I can help with this)
4. **Send messages** at ~₩15-30 per SMS

---

## Detailed Instructions

### Prerequisites

1. **Backend must be running:**
   - Vercel deployment: `https://your-app.vercel.app`
   - Or local: `http://localhost:3000`

2. **Environment variables:**
   ```bash
   export BACKEND_URL="https://your-app.vercel.app"
   export NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
   export SUPABASE_SERVICE_ROLE_KEY="your_service_key"
   ```

3. **Python dependencies:**
   ```bash
   pip3 install pandas openpyxl requests
   ```

### Script Options

#### `process_and_send_results.py`

Main script to process images and send results.

**Options:**
- `--mode test`: Process only first 3 users (recommended to test first)
- `--mode production`: Process all 41 users
- `--skip-processing`: Skip image processing, only send messages (if results already exist)
- `--skip-sending`: Skip sending messages, only process images

**Examples:**

```bash
# Test run - process 3 users, no SMS
python3 scripts/process_and_send_results.py --mode test --skip-sending

# Process all, no SMS (generate results only)
python3 scripts/process_and_send_results.py --mode production --skip-sending

# Send messages for already-processed results
python3 scripts/process_and_send_results.py --mode production --skip-processing

# Full automation (process + send SMS)
python3 scripts/process_and_send_results.py --mode production
```

#### `generate_results_pages.py`

Generates beautiful HTML pages for each user's results.

```bash
python3 scripts/generate_results_pages.py
```

Output: `batch_user_results/html_pages/[phone].html`

---

## Output Files

After running, you'll get:

```
batch_user_results/
├── 1036393835_original.jpg         # Downloaded image
├── 1036393835_results.json         # Full pipeline results
├── html_pages/
│   └── 1036393835.html             # Shareable results page
└── summary_20251113_120000.json    # Processing summary
```

### Example Results JSON

```json
{
  "phone": "1036393835",
  "original_url": "https://api.typeform.com/...",
  "uploaded_url": "https://s3.amazonaws.com/...",
  "status": "success",
  "processing_time_seconds": 45.2,
  "cropped_data": {
    "croppedImages": {
      "tops": { "url": "...", "description": "gray jacket" },
      "bag": { "url": "...", "description": "black handbag" }
    }
  },
  "search_results": {
    "results": {
      "tops": [
        {
          "title": "Similar gray jacket...",
          "link": "https://shopping.naver.com/...",
          "thumbnail": "https://..."
        }
      ]
    }
  }
}
```

---

## Cost Estimates

### Processing Cost
- **Backend GPU:** Using Modal/Vercel - depends on your plan
- **Storage:** S3 storage for images (~$0.023/GB/month)
- **API Calls:** Serper API (~$5/1000 searches)

For 41 users with 2-3 items each:
- ~100 Serper searches = ~$0.50
- Storage: negligible
- Total: ~$0.50-$1.00

### Messaging Cost

**Twilio (International SMS):**
- ~$0.01-0.05 per SMS to Korea
- 41 users = ~$0.41-$2.05

**Korean SMS (Aligo):**
- ~₩15-30 per SMS
- 41 users = ~₩615-1,230 ($0.45-$0.90)

**KakaoTalk (Free):**
- Free if you manually send links
- Automated requires KakaoTalk Business API

---

## Hosting HTML Results

### Option 1: Vercel (Free, Easy)

```bash
# Create a simple static site
mkdir /Users/levit/Desktop/mvp/public/results
cp batch_user_results/html_pages/* /Users/levit/Desktop/mvp/public/results/

# Deploy to Vercel
vercel --prod

# Share links: https://your-app.vercel.app/results/1036393835.html
```

### Option 2: GitHub Pages (Free)

```bash
# Create a new repo for results
cd batch_user_results/html_pages
git init
git add .
git commit -m "User results"
git remote add origin https://github.com/yourusername/results.git
git push -u origin main

# Enable GitHub Pages in repo settings
# Share links: https://yourusername.github.io/results/1036393835.html
```

### Option 3: Simple Python Server (Local Testing)

```bash
cd batch_user_results/html_pages
python3 -m http.server 8000

# Access at: http://localhost:8000/1036393835.html
```

---

## Troubleshooting

### "Module not found: pandas"
```bash
pip3 install pandas openpyxl requests
```

### "Backend URL not responding"
Check your backend is running:
```bash
curl https://your-app.vercel.app/api/health
```

### "Twilio authentication failed"
Double-check your credentials:
```bash
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN
```

### "Image download failed"
Some Typeform URLs may expire. Check the image URL in browser first.

---

## Recommendations

For 41 users, I recommend:

1. **Start with test mode** (3 users) to verify everything works
2. **Generate HTML pages** instead of SMS (easier, free)
3. **Host on Vercel** (free, fast, reliable)
4. **Share via KakaoTalk** manually or with a simple message blast

This approach is:
- ✅ Free (no SMS costs)
- ✅ Fast (all pages generated in minutes)
- ✅ Professional (beautiful HTML pages)
- ✅ Flexible (users can revisit results anytime)

---

## Next Steps

1. **Decide on messaging method**
   - HTML pages + KakaoTalk (recommended)
   - Twilio SMS
   - Korean SMS service

2. **Test with 3 users:**
   ```bash
   python3 scripts/process_and_send_results.py --mode test --skip-sending
   python3 scripts/generate_results_pages.py
   open batch_user_results/html_pages/*.html
   ```

3. **Review results**
   - Check if products look good
   - Verify links work
   - Test on mobile

4. **Run for all 41 users**
   ```bash
   python3 scripts/process_and_send_results.py --mode production --skip-sending
   python3 scripts/generate_results_pages.py
   ```

5. **Host and share**
   - Upload to Vercel/GitHub Pages
   - Send links to users via KakaoTalk

---

## Questions?

Let me know if you need help with:
- Setting up SMS services
- Customizing the HTML pages
- Hosting the results
- Anything else!

