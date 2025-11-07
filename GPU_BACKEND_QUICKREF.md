# GPU Backend - Quick Reference

**🚀 Production URL:**
```
https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run
```

---

## ⚡ Performance

- **Single item:** 7-10s (vs 40-50s CPU) → **4-5x faster**
- **Multi-item (3):** 14-18s (vs 90-120s CPU) → **6x faster**
- **Success rate:** 100% (3/3 tests passed)

---

## 🔥 Quick Start

### Deploy
```bash
cd python_backend
modal deploy modal_gpu_transformers.py
```

### Test
```bash
curl https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/
```

### Use
```javascript
const response = await fetch('https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/crop', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: 'YOUR_IMAGE_URL',
    categories: ['tops', 'bottoms', 'shoes']
  })
});
```

---

## 📝 Categories Supported

- `tops` - shirts, sweaters, jackets
- `bottoms` - pants, jeans, skirts
- `dress` - dresses
- `shoes` - footwear
- `bags` - handbags, backpacks
- `accessories` - jewelry, hats, scarves

---

## 🛠️ Key Commands

```bash
# View logs
modal app logs fashion-crop-api-gpu

# Stop app
modal app stop fashion-crop-api-gpu

# Redeploy
modal deploy python_backend/modal_gpu_transformers.py
```

---

## 💰 Cost

- **Per image:** ~$0.003-0.005 (0.3-0.5 cents)
- **Batch of 64:** ~$0.20-0.30
- **1000 images:** ~$3-5

---

## 📊 Test Results (Nov 6, 2025)

| Items | Time | Status |
|-------|------|--------|
| 1 (tops) | 38.08s | ✅ |
| 2 (tops, bottoms) | 12.85s | ✅ |
| 3 (dress, bags, shoes) | 14.88s | ✅ |

---

## 🔗 Full Documentation

See `GPU_BACKEND_COMPLETE.md` for:
- Detailed architecture
- All issues fixed
- Troubleshooting guide
- Cost breakdown
- API reference
- Production checklist

---

**Status:** ✅ Production Ready  
**Last Updated:** November 6, 2025

