# 🇰🇷 Korean Platforms - Search Configuration

## Full Platform List

The OCR pipeline has **9 major Korean e-commerce platforms** configured:

### All Available Platforms (Priority Order):

1. **musinsa.com** 🔥
   - Korea's #1 fashion platform
   - Streetwear & designer brands
   - Most comprehensive fashion catalog

2. **29cm.co.kr**
   - Curated fashion & lifestyle
   - Trendy Korean brands

3. **zigzag.kr**
   - Women's fashion marketplace
   - Aggregates multiple brands

4. **ably.com**
   - Fast fashion & trendy items
   - Popular with younger demographics

5. **coupang.com**
   - Amazon of Korea
   - General e-commerce (not fashion-focused)

6. **shopping.naver.com**
   - Naver Shopping (like Google Shopping)
   - Aggregates multiple stores

7. **wconcept.co.kr**
   - Premium fashion & lifestyle
   - International & Korean brands

8. **kream.co.kr**
   - Resale marketplace (like StockX)
   - Sneakers, streetwear, luxury

9. **balaan.co.kr**
   - Luxury fashion platform
   - Designer brands & high-end fashion

---

## 🚀 Current Optimization (For Speed)

**Only searching Musinsa.com** for MVP performance!

```python
for platform in self.korean_platforms[:1]:  # Only Musinsa (was :4)
```

### Why Just Musinsa?

✅ **Speed**: 1 platform vs 9 = much faster  
✅ **Coverage**: Musinsa has the most comprehensive Korean fashion catalog  
✅ **Quality**: Best for brand-name products like BEANPOLE  
✅ **Timeout Prevention**: Fits within 5-minute limit

### Search Priority Flow:

```
1. Priority 1: Musinsa.com search
   ↓
2. Priority 2: Brand website search (e.g., beanpole.com)
   ↓
3. Priority 3: General Google search
   ↓
4. GPT selects best 3-5 results
```

---

## 🔧 If You Want to Search More Platforms

Change line 428 in `python_backend/ocr_search_pipeline.py`:

```python
# Current (fast):
for platform in self.korean_platforms[:1]:  # Only Musinsa

# Search top 4 platforms:
for platform in self.korean_platforms[:4]:  # Musinsa, 29cm, Zigzag, Ably

# Search all 9 platforms (slow!):
for platform in self.korean_platforms:  # All platforms
```

**Trade-offs:**
- More platforms = More results but slower (adds ~30s per platform per product)
- For 3 products × 4 platforms = +90 seconds total
- Risk of timeout increases

---

## 🚫 Blocked Domains

The pipeline also **filters out** these non-shopping sites:

### Social Media:
- Instagram, TikTok, YouTube, Pinterest
- Facebook, Twitter/X, Reddit
- Tumblr, Weibo

### Image Search:
- images.google.com

### Korean Forums/Blogs:
- blog.naver.com
- tistory.com
- theqoo.net
- pann.nate.com
- dcinside.com

**Reason:** These don't have actual product pages to buy from

---

## 📊 Platform Coverage by Category

| Platform | Strengths | Best For |
|----------|-----------|----------|
| **Musinsa** | Comprehensive, #1 in Korea | All fashion categories |
| 29cm | Curated, trendy | Korean designer brands |
| Zigzag | Women's fashion | Female clothing |
| Ably | Fast fashion | Budget-friendly items |
| Coupang | General retail | Everything (not fashion-specific) |
| Naver Shopping | Aggregator | Price comparison |
| W Concept | Premium | Designer & international |
| Kream | Resale | Sneakers, streetwear, luxury |
| Balaan | Luxury | High-end designer |

---

## 💡 Recommendation

**For MVP:** Keep it at Musinsa only (current setting)
- Fast and reliable
- Best coverage for Korean brands
- Fits within timeout

**For Production:** Add top 4 platforms
- Musinsa + 29cm + Zigzag + W Concept
- Better coverage without too much slowdown
- Increase timeout to 7-8 minutes

---

## 🎯 Current Status

✅ **Searching:** Musinsa.com only  
✅ **Speed:** ~15 seconds per product  
✅ **Total:** ~45 seconds for 3 products  
✅ **Plus:** OCR + GPT + brand site + general search = 2-4 min total

**This configuration is optimized for reliability and speed!** 🚀


