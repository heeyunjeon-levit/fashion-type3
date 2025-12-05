# Shareable Results Feature 🔗

## Overview
This feature allows users to share their search results via a unique URL that can be accessed by anyone.

## What's New

### 1. Database Schema
- **Table:** `shared_results`
- **Location:** `/supabase_shared_results_schema.sql`
- **Features:**
  - Stores complete search results (products, images, metadata)
  - Tracks view counts and analytics
  - UUID-based sharing (secure and unique)
  - Soft delete support

### 2. API Endpoints

#### POST `/api/share-results`
Creates a new shareable link.

**Request:**
```json
{
  "results": { "category_1": [...products] },
  "originalImageUrl": "https://...",
  "selectedItems": [...items],
  "sessionId": "uuid",
  "userPhone": "+82...",
  "searchMode": "interactive"
}
```

**Response:**
```json
{
  "success": true,
  "shareId": "uuid",
  "shareUrl": "https://yourapp.com/results/uuid"
}
```

#### GET `/api/share-results?id={uuid}`
Retrieves shared results by ID.

**Response:**
```json
{
  "success": true,
  "results": {...},
  "originalImageUrl": "...",
  "selectedItems": [...],
  "searchMode": "...",
  "createdAt": "..."
}
```

### 3. Results Page
- **Route:** `/results/[id]`
- **File:** `/app/results/[id]/page.tsx`
- **Features:**
  - Loads shared results from database
  - Displays results using the same UI as main app
  - Shows metadata (date created)
  - Tracks views automatically

### 4. Share Button
- **Location:** Bottom action bar in `ResultsBottomSheet`
- **Features:**
  - Beautiful gradient button: purple → pink
  - Creates shareable link on click
  - Automatically copies link to clipboard
  - Shows success message with checkmark
  - Changes to green after sharing
  - Only shows when results exist

## How It Works

### User Flow
1. User uploads image and gets search results
2. User clicks "결과 공유하기" (Share Results) button
3. System creates unique share link and copies to clipboard
4. Button shows ✓ confirmation
5. User can paste link anywhere (KakaoTalk, SMS, etc.)
6. Recipients can view results without uploading anything

### Technical Flow
```
User clicks Share
    ↓
POST /api/share-results
    ↓
Insert into Supabase
    ↓
Generate share URL
    ↓
Copy to clipboard
    ↓
Show success UI
```

### Viewing Shared Results
```
User opens /results/{id}
    ↓
GET /api/share-results?id={id}
    ↓
Fetch from Supabase
    ↓
Increment view_count
    ↓
Render results page
```

## Setup Instructions

### 1. Create Database Table
Run the SQL schema file in your Supabase dashboard:

```bash
# In Supabase SQL Editor, run:
supabase_shared_results_schema.sql
```

Or manually:
```sql
psql -h your-db.supabase.co -U postgres -d postgres -f supabase_shared_results_schema.sql
```

### 2. Environment Variables
Ensure these are set (should already be configured):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://yourapp.com  # For share link generation
```

### 3. Deploy
```bash
npm run build
npm run start
# Or deploy to Vercel
```

## Testing

### Manual Testing
1. Upload an image and get results
2. Click "결과 공유하기" button
3. Verify link is copied (try pasting)
4. Open shared link in new incognito tab
5. Verify results display correctly
6. Check view count increments

### Test the Uploaded Image
Use the hoodie image from the user's screenshot:
1. Save the hoodie image from chat
2. Upload to your app
3. Get search results
4. Click share button
5. Test the generated link

## Features Breakdown

### Security
- ✅ UUID-based IDs (not sequential - hard to guess)
- ✅ Row Level Security enabled
- ✅ Anyone can view (intended for sharing)
- ✅ Only system can update view counts

### Analytics
- View count tracking
- Last viewed timestamp
- Session ID linkage
- User phone linkage (if available)

### UI/UX
- Smooth animation on share button
- Clipboard copy (no manual selection needed)
- Success feedback (visual + text)
- Button state changes (loading → success)
- Responsive design (mobile + desktop)

## Database Schema Details

### Table: `shared_results`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| created_at | TIMESTAMP | Creation time |
| results | JSONB | Search results (products) |
| original_image_url | TEXT | Original uploaded image |
| selected_items | JSONB | Detected items metadata |
| session_id | TEXT | Session tracking |
| user_phone | TEXT | User identification |
| search_mode | TEXT | interactive/ocr/fallback |
| view_count | INTEGER | Number of views |
| last_viewed_at | TIMESTAMP | Last view time |
| deleted_at | TIMESTAMP | Soft delete |

### Indexes
- `idx_shared_results_created_at` - Fast recent results lookup
- `idx_shared_results_session_id` - User history tracking

## Future Enhancements

### Potential Features
- [ ] Share link expiration (auto-delete after 30 days)
- [ ] Share via WhatsApp/KakaoTalk buttons
- [ ] QR code generation for easy mobile sharing
- [ ] Share statistics dashboard (views, clicks)
- [ ] Edit/delete shared results
- [ ] Share with custom message/note
- [ ] Private sharing (password-protected)
- [ ] Share analytics (who viewed, when)

### Performance Optimizations
- [ ] Cache frequently viewed results
- [ ] CDN for shared result pages
- [ ] Preload thumbnails
- [ ] Lazy load product images

## Troubleshooting

### "Failed to create share link"
- Check Supabase connection
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check database table exists
- Check RLS policies are enabled

### "Results not found"
- Verify share ID is correct
- Check if result was deleted (`deleted_at IS NULL`)
- Verify database connection

### Link doesn't copy
- Browser might block clipboard access
- Try HTTPS (required for clipboard API)
- Check browser console for errors

## Examples

### Share Link Example
```
https://yourapp.com/results/123e4567-e89b-12d3-a456-426614174000
```

### Shared Results JSON Example
```json
{
  "results": {
    "hoodie_1": [
      {
        "link": "https://example.com/product/1",
        "thumbnail": "https://...",
        "title": "Beige Polo Ralph Lauren Hoodie"
      },
      ...
    ]
  },
  "originalImageUrl": "https://storage.supabase.co/...",
  "selectedItems": [
    {
      "category": "hoodie",
      "description": "Beige cotton fleece hoodie",
      "croppedImageUrl": "data:image/jpeg;base64,..."
    }
  ]
}
```

## Support
For issues or questions, check:
1. Console logs (`🔗` and `💾` emojis mark share-related logs)
2. Network tab (API calls to `/api/share-results`)
3. Supabase dashboard (check `shared_results` table)

---

**Version:** 1.0.0  
**Last Updated:** December 2024  
**Author:** AI Assistant

