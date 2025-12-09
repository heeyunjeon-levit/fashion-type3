#!/bin/bash

# Add 'export const dynamic = force-dynamic' to all API routes
# This prevents build timeouts

FILES=(
  "app/api/detect-dinox/route.ts"
  "app/api/search-job/route.ts"
  "app/api/search-job/[id]/route.ts"
  "app/api/ocr-search/route.ts"
  "app/api/describe-item/route.ts"
  "app/api/upload-cropped/route.ts"
  "app/api/track-visit/route.ts"
  "app/api/share-results/route.ts"
  "app/api/test-dinox/route.ts"
  "app/api/log/phone/route.ts"
  "app/api/track-page/route.ts"
  "app/api/feedback/route.ts"
  "app/api/log/click/route.ts"
  "app/api/log/session/update/route.ts"
  "app/api/log/event/route.ts"
  "app/api/log/session/init/route.ts"
  "app/api/upload/route.ts"
  "app/api/convert-heic/route.ts"
  "app/api/search/route.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Check if it already has the export
    if ! grep -q "export const dynamic" "$file"; then
      echo "Adding dynamic export to $file"
      # Add after the imports, before the first function/export
      sed -i.bak '1a\
\
// Force dynamic rendering\
export const dynamic = '\''force-dynamic'\'';
' "$file"
      rm -f "$file.bak"
    else
      echo "Skipping $file (already has dynamic export)"
    fi
  fi
done

echo "✅ Done!"

