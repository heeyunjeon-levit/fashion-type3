# Shareable Results Feature - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                               │
└─────────────────────────────────────────────────────────────────────┘

1. User uploads image
        ↓
2. AI detects items
        ↓
3. Search results displayed
        ↓
4. User clicks "Share" button ────────────┐
        ↓                                  │
5. Link created & copied to clipboard     │
        ↓                                  │
6. User shares link via:                  │
   - KakaoTalk                            │
   - WhatsApp                             │
   - SMS                                  │
   - Email                                │
        ↓                                  │
7. Recipient opens link ──────────────────┘
        ↓
8. Results displayed (no upload needed!)


┌─────────────────────────────────────────────────────────────────────┐
│                        TECHNICAL FLOW                                │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   Frontend   │
│   (User)     │
└──────┬───────┘
       │ 1. Click "Share"
       ↓
┌──────────────────────┐
│  ResultsBottomSheet  │
│  handleShareResults()│
└──────┬───────────────┘
       │ 2. POST /api/share-results
       ↓
┌──────────────────────┐
│  API Route Handler   │
│  /api/share-results  │
└──────┬───────────────┘
       │ 3. Insert into database
       ↓
┌──────────────────────┐
│  Supabase Database   │
│  shared_results      │
└──────┬───────────────┘
       │ 4. Return UUID + URL
       ↓
┌──────────────────────┐
│  Frontend (User)     │
│  Copy to clipboard   │
│  Show success UI     │
└──────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                     VIEWING SHARED LINK                              │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Recipient   │
│  Opens link  │
└──────┬───────┘
       │ 1. Navigate to /results/{uuid}
       ↓
┌──────────────────────┐
│  Next.js Page Route  │
│  /results/[id]/page  │
└──────┬───────────────┘
       │ 2. GET /api/share-results?id={uuid}
       ↓
┌──────────────────────┐
│  API Route Handler   │
│  Fetch from DB       │
└──────┬───────────────┘
       │ 3. Query Supabase
       ↓
┌──────────────────────┐
│  Supabase Database   │
│  Increment views     │
└──────┬───────────────┘
       │ 4. Return data
       ↓
┌──────────────────────┐
│  Frontend Page       │
│  Render results      │
└──────────────────────┘
```

## Component Hierarchy

```
app/
├── page.tsx (Main App)
│   └── ResultsBottomSheet
│       ├── Share Button (NEW)
│       └── Results Display
│
├── results/[id]/page.tsx (NEW)
│   └── ResultsBottomSheet (reused)
│       └── Results Display (no Share button)
│
└── api/
    └── share-results/route.ts (NEW)
        ├── POST - Create share link
        └── GET - Retrieve shared results
```

## Data Flow

### Creating Share Link

```
┌─────────────────────────────────────────────────────────────────┐
│  Input Data                                                      │
└─────────────────────────────────────────────────────────────────┘

results: {
  "hoodie_1": [
    { link: "...", thumbnail: "...", title: "..." },
    { link: "...", thumbnail: "...", title: "..." },
    { link: "...", thumbnail: "...", title: "..." }
  ],
  "jeans_1": [...]
}

originalImageUrl: "https://storage.supabase.co/.../image.jpg"

selectedItems: [
  {
    category: "hoodie",
    description: "Beige cotton fleece hoodie",
    croppedImageUrl: "data:image/jpeg;base64,..."
  }
]

┌─────────────────────────────────────────────────────────────────┐
│  Database Storage                                                │
└─────────────────────────────────────────────────────────────────┘

INSERT INTO shared_results (
  id,                    -- UUID (auto-generated)
  results,               -- JSONB (products)
  original_image_url,    -- TEXT
  selected_items,        -- JSONB (item metadata)
  session_id,            -- TEXT (tracking)
  user_phone,            -- TEXT (optional)
  search_mode,           -- TEXT (interactive/ocr)
  view_count,            -- INTEGER (starts at 0)
  created_at             -- TIMESTAMP (now)
)

┌─────────────────────────────────────────────────────────────────┐
│  Output                                                          │
└─────────────────────────────────────────────────────────────────┘

shareId: "123e4567-e89b-12d3-a456-426614174000"
shareUrl: "https://yourapp.com/results/123e4567-..."
```

## Database Schema

```sql
┌────────────────────────────────────────────────────────────────┐
│  Table: shared_results                                          │
├────────────────────────────────────────────────────────────────┤
│  id                 UUID PRIMARY KEY                            │
│  created_at         TIMESTAMP WITH TIME ZONE                    │
│  results            JSONB NOT NULL                              │
│  original_image_url TEXT                                        │
│  selected_items     JSONB                                       │
│  session_id         TEXT                                        │
│  user_phone         TEXT                                        │
│  search_mode        TEXT                                        │
│  view_count         INTEGER DEFAULT 0                           │
│  last_viewed_at     TIMESTAMP WITH TIME ZONE                    │
│  deleted_at         TIMESTAMP WITH TIME ZONE                    │
└────────────────────────────────────────────────────────────────┘

Indexes:
- idx_shared_results_created_at (DESC)
- idx_shared_results_session_id

Row Level Security:
- Anyone can SELECT (where deleted_at IS NULL)
- Anyone can INSERT
- Only service role can UPDATE
```

## State Management

### ResultsBottomSheet Component

```typescript
// New state for share feature
const [isSharing, setIsSharing] = useState(false)
const [shareUrl, setShareUrl] = useState<string | null>(null)
const [showShareSuccess, setShowShareSuccess] = useState(false)

// New prop for shared views
interface Props {
  ...existingProps
  isSharedView?: boolean  // Disables share button, phone modal
}
```

## UI States

```
┌─────────────────────────────────────────────────────────────────┐
│  Share Button States                                            │
└─────────────────────────────────────────────────────────────────┘

State 1: INITIAL
┌────────────────────────────────────────────────────────┐
│  🔗  결과 공유하기                                        │
│  (Purple-Pink Gradient)                                │
└────────────────────────────────────────────────────────┘

State 2: LOADING
┌────────────────────────────────────────────────────────┐
│  ⟳  링크 생성 중...                                      │
│  (Spinning icon, 50% opacity)                          │
└────────────────────────────────────────────────────────┘

State 3: SUCCESS
┌────────────────────────────────────────────────────────┐
│  ✓  링크가 클립보드에 복사되었습니다!                       │
│  (Green background)                                    │
└────────────────────────────────────────────────────────┘
        │
        ↓ (3 seconds later)
        
State 4: PERSISTENT SUCCESS
┌────────────────────────────────────────────────────────┐
│  ✓  링크가 클립보드에 복사되었습니다!                       │
│  (Stays green, still clickable)                        │
└────────────────────────────────────────────────────────┘
```

## API Contracts

### POST /api/share-results

```typescript
// Request
interface ShareRequest {
  results: Record<string, ProductOption[]>
  originalImageUrl: string
  selectedItems: DetectedItem[]
  sessionId?: string
  userPhone?: string
  searchMode?: string
}

// Response
interface ShareResponse {
  success: boolean
  shareId: string
  shareUrl: string
}

// Error Response
interface ErrorResponse {
  error: string
}
```

### GET /api/share-results?id={uuid}

```typescript
// Response
interface GetShareResponse {
  success: boolean
  results: Record<string, ProductOption[]>
  originalImageUrl: string
  selectedItems: DetectedItem[]
  searchMode: string
  createdAt: string
}

// Error Response
interface ErrorResponse {
  error: string
}
```

## Security Considerations

### ✅ Implemented
- UUID-based IDs (non-sequential, hard to guess)
- Row Level Security enabled
- Public read access (intended for sharing)
- Service role required for updates
- Soft delete support

### 🔒 Optional Future Enhancements
- Link expiration dates
- Password protection
- View limit enforcement
- IP rate limiting
- Spam detection

## Performance Metrics

### Expected Performance
```
Share Link Creation:
- API call:        < 500ms
- DB insert:       < 200ms
- Total time:      < 1s

Share Link Loading:
- API call:        < 300ms
- DB query:        < 100ms
- Page render:     < 2s

View Counter Update:
- Background:      < 500ms
- Non-blocking:    ✓
```

## Error Handling

```
┌─────────────────────────────────────────────────────────────────┐
│  Error Scenarios                                                 │
└─────────────────────────────────────────────────────────────────┘

1. Network Error
   → Show alert: "공유 링크 생성에 실패했습니다"
   → Keep button enabled for retry

2. Database Error
   → Log to console
   → Return 500 error
   → Show user-friendly message

3. Invalid Share ID
   → Return 404
   → Show "결과를 찾을 수 없습니다" page

4. Clipboard API Not Available
   → Still create link
   → Show link in alert for manual copy

5. Deleted Result
   → Return 404 (deleted_at IS NOT NULL)
   → Show not found page
```

## Analytics Tracking

### Metrics Collected
```
1. Share Creation
   - Session ID
   - User phone (if available)
   - Search mode
   - Number of products
   - Number of categories

2. Share Viewing
   - View count (automatic)
   - Last viewed timestamp
   - Time since creation

3. Engagement (future)
   - Product clicks from shared link
   - Recipient session starts
   - Conversion to own search
```

## Testing Strategy

```
Unit Tests (Future):
- ✓ API route handlers
- ✓ Database queries
- ✓ Share link generation
- ✓ Clipboard functionality

Integration Tests (Future):
- ✓ End-to-end share flow
- ✓ Share link viewing
- ✓ View counter increment
- ✓ Multi-category handling

Manual Tests (Now):
- ✓ Create share link
- ✓ Copy to clipboard
- ✓ Open shared link
- ✓ View counter works
- ✓ Phone modal skipped
- ✓ Mobile responsive
```

## Deployment Checklist

```
Before deploying to production:

Database:
[ ] Run supabase_shared_results_schema.sql
[ ] Verify RLS policies
[ ] Test INSERT/SELECT permissions
[ ] Verify indexes created

Environment:
[ ] NEXT_PUBLIC_SUPABASE_URL set
[ ] SUPABASE_SERVICE_ROLE_KEY set
[ ] NEXT_PUBLIC_APP_URL set to production URL

Code:
[ ] All linter errors fixed
[ ] Console.logs cleaned (or kept for debugging)
[ ] Error handling tested
[ ] Mobile responsive verified

Testing:
[ ] Create share link works
[ ] Shared link loads correctly
[ ] Clipboard copy works
[ ] View counter increments
[ ] No console errors

HTTPS Required:
[ ] Clipboard API requires HTTPS
[ ] Verify production uses HTTPS
```

---

**Version:** 1.0.0  
**Author:** AI Assistant  
**Last Updated:** December 2024

