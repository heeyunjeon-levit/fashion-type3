# English Version Guide 🌍

## What's New?

Your MVP now has **full English language support** with an easy toggle button! Perfect for your NYC trip to get feedback from your friends.

## How It Works

### Language Toggle Button
- A **language toggle button** appears in the **top-right corner** of the screen
- Click it to switch between English and Korean
- The language preference is **saved automatically** in the browser
- Shows "English" when in Korean mode, "한국어" when in English mode

### What's Translated

Everything in your app is now bilingual:

#### 1. **Upload Screen**
- Title: "Find the clothes you want!"
- Instructions and buttons

#### 2. **AI Analysis Screen**
- "AI is analyzing..."
- "Finding items in your image"

#### 3. **Gallery Screen**
- "Detected Items"
- "Select items to search for"
- "AI found X items!"
- Category names (Top, Bottom, Bag, Shoes, Accessory, Dress)

#### 4. **Phone Modal**
- All text including privacy notice
- Phone number format adjusts (555-123-4567 for English, 010-1234-5678 for Korean)
- Validation is more lenient for English (allows any 10+ digit number)

#### 5. **Results Screen**
- Product categories
- All buttons and hints
- Feedback prompts

#### 6. **Feedback Modal**
- "How was your experience?"
- Satisfaction buttons
- Submit button

## For Your NYC Demo

### Getting Started
1. Open your app
2. Click the language toggle button (top-right)
3. It will switch to English
4. All text will now be in English

### Testing Tips
- The language setting persists across page refreshes
- Each user's browser saves their preference independently
- Phone number validation accepts US format (555-123-4567)

### Key Features in English

**Upload Page:**
```
Find the clothes
you want!
```

**Analysis:**
```
AI is analyzing...
Finding items in your image
```

**Results:**
```
Search X selected items
Top, Bottom, Bag, Shoes, Accessory, Dress
```

## Technical Details

### Implementation
- Uses React Context API for state management
- Translations stored in `/app/contexts/LanguageContext.tsx`
- Language preference saved to `localStorage`
- All components updated to use translation keys

### Adding New Translations
If you need to add more text:

1. Open `/app/contexts/LanguageContext.tsx`
2. Add your translation key to both `en` and `ko` objects:
   ```typescript
   en: {
     'yourSection.yourKey': 'English text',
   },
   ko: {
     'yourSection.yourKey': '한국어 텍스트',
   }
   ```
3. Use in components with:
   ```typescript
   const { t } = useLanguage()
   return <div>{t('yourSection.yourKey')}</div>
   ```

### Files Modified
- ✅ `app/contexts/LanguageContext.tsx` (new)
- ✅ `app/components/LanguageToggle.tsx` (new)
- ✅ `app/layout.tsx`
- ✅ `app/page.tsx`
- ✅ `app/components/ImageUpload.tsx`
- ✅ `app/components/CroppedImageGallery.tsx`
- ✅ `app/components/PhoneModal.tsx`
- ✅ `app/components/FeedbackModal.tsx`
- ✅ `app/components/ResultsBottomSheet.tsx`
- ✅ `app/constants/categories.ts`

## Deployment

The changes are ready to deploy:

```bash
# If using Vercel
vercel --prod

# Or push to your git repository
git add .
git commit -m "Add English language support"
git push
```

## Tips for NYC

1. **Set to English before showing:** Click the toggle so your friends see it in English from the start
2. **Explain the toggle:** Show them they can switch languages to see the Korean version
3. **Collect feedback:** The feedback modal works in both languages
4. **Phone numbers:** They can enter US format phone numbers

## Quick Toggle Commands (Browser Console)

To quickly switch languages programmatically:
```javascript
// Switch to English
localStorage.setItem('language', 'en')
location.reload()

// Switch to Korean
localStorage.setItem('language', 'ko')
location.reload()
```

---

**Enjoy your NYC trip! 🗽**

Get great feedback from your friends and refine your product. The bilingual support makes your MVP accessible to both Korean and English-speaking users!

