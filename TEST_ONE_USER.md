# 🧪 Test with One User First

Before processing all 41 users, let's test with just one to make sure everything works!

## 🚀 Quick Start (One Command)

```bash
cd /Users/levit/Desktop/mvp

# Set your backend URL
export BACKEND_URL="https://your-app.vercel.app"
# OR if testing locally:
# export BACKEND_URL="http://localhost:3000"

# Run the test
./scripts/test_one_user.sh
```

This will:
1. ✅ Process the first user from your Excel (phone: 1036393835)
2. ✅ Download their image
3. ✅ Run through your pipeline (crop + search)
4. ✅ Generate a beautiful HTML page
5. ✅ Copy it to `public/results/` for Vercel deployment

---

## 📱 Getting a Shareable Link

After processing, you'll have 3 options:

### Option 1: Deploy to Vercel (Best - Permanent URL) ⭐

```bash
# Deploy to production
vercel --prod

# Your link will be:
# https://your-app.vercel.app/results/1036393835.html
```

✅ **Pros:** Permanent, professional, works everywhere, HTTPS  
⚠️ **Cons:** Requires Vercel account (but you already have one!)

### Option 2: Use ngrok (Quick Public URL)

If you have ngrok installed:

```bash
# Terminal 1: Start server
cd single_user_test
python3 -m http.server 8000

# Terminal 2: Create tunnel
ngrok http 8000
```

Then you'll get a URL like: `https://xxxx.ngrok.io/1036393835_result.html`

✅ **Pros:** Works immediately, public URL  
⚠️ **Cons:** URL changes each time, requires ngrok

**Install ngrok:**
```bash
brew install ngrok
# or download from: https://ngrok.com/download
```

### Option 3: Local Server (Same Network Only)

```bash
cd single_user_test
python3 -m http.server 8000

# Access at:
# http://localhost:8000/1036393835_result.html
```

✅ **Pros:** Super simple, no setup  
⚠️ **Cons:** Only works on same WiFi network

---

## 🎯 What You'll See

After running the script, you'll get output like:

```
============================================================
Processing User: 1036393835
============================================================

📥 Downloading image...
✅ Downloaded: ./single_user_test/1036393835_original.jpg

📤 Uploading to backend...
✅ Uploaded: https://s3.amazonaws.com/...

✂️  Detecting and cropping items (this may take 15-30s)...
✅ Found 3 items: tops, bottoms, bag

🔍 Searching for products (this may take 20-30s)...
✅ Found 9 shopping links

✅ Processing complete in 52.3s
📄 Saved JSON: ./single_user_test/1036393835_result.json

🎨 Generating HTML page...
✅ HTML created: ./single_user_test/1036393835_result.html

============================================================
SUCCESS! 🎉
============================================================

HTML file created: ./single_user_test/1036393835_result.html

Do you want to deploy to Vercel now? (y/n):
```

---

## 📂 Files Created

```
single_user_test/
├── 1036393835_original.jpg     # Downloaded image
├── 1036393835_result.json      # Full pipeline results
└── 1036393835_result.html      # Beautiful shareable page

public/results/
└── 1036393835.html             # Ready for Vercel deployment
```

---

## 🌐 Accessing the Result

### On Your Computer
```bash
open single_user_test/1036393835_result.html
```

### From Any Device (After Vercel Deploy)
```
https://your-app.vercel.app/results/1036393835.html
```

You can test this on:
- ✅ Your phone
- ✅ Another computer
- ✅ Tablet
- ✅ Any browser

---

## ⏱ Timeline

```
T+0:00  Start script
T+0:05  Download complete
T+0:08  Upload complete
T+0:30  Cropping complete (GPU processing)
T+0:55  Search complete
T+0:56  HTML generated ✅
T+1:00  Vercel deploy (if you choose)
T+1:30  Live on internet! 🎉
```

**Total: ~1-2 minutes**

---

## ❓ Troubleshooting

### "Backend not reachable"
```bash
# Check if your backend is running
curl $BACKEND_URL

# If using local, start it first:
npm run dev
export BACKEND_URL="http://localhost:3000"
```

### "vercel command not found"
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login
```

### "Module not found"
```bash
pip3 install pandas openpyxl requests
```

---

## 🎨 What the Result Looks Like

The HTML page will show:
- 🎯 Detected items (e.g., "상의", "가방")
- 📸 Product images
- 🛒 "구매하러 가기" buttons
- 📱 Mobile-responsive design
- 💜 Beautiful gradient design

---

## ✅ Next Steps

After testing with one user:

1. **Review the HTML page** - Does it look good?
2. **Check the products** - Are the links relevant?
3. **Test on your phone** - Does it work on mobile?

If everything looks good:

```bash
# Process all 41 users
./scripts/quick_start.sh
```

---

## 🚀 Ready to Test?

Run this now:

```bash
cd /Users/levit/Desktop/mvp
export BACKEND_URL="https://your-app.vercel.app"  # Replace with your actual URL
./scripts/test_one_user.sh
```

**Or if you don't know your Vercel URL:**

```bash
# Start local backend first
npm run dev

# Then in another terminal:
cd /Users/levit/Desktop/mvp
export BACKEND_URL="http://localhost:3000"
./scripts/test_one_user.sh
```

---

Good luck! 🎉 In just 1-2 minutes you'll have a working shareable link!

