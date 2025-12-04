/**
 * Centralized Image Format Configuration
 * Tracks all supported image formats across the pipeline
 */

export const IMAGE_FORMATS = {
  // Formats that work natively in browsers
  NATIVE: {
    JPEG: { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'], quality: 0.9 },
    PNG: { mime: 'image/png', extensions: ['.png'] },
    WEBP: { mime: 'image/webp', extensions: ['.webp'], quality: 0.9 },
    GIF: { mime: 'image/gif', extensions: ['.gif'] },
  },
  
  // Formats that need server-side conversion
  NEEDS_CONVERSION: {
    HEIC: { mime: 'image/heic', extensions: ['.heic'], convertTo: 'image/jpeg' },
    HEIF: { mime: 'image/heif', extensions: ['.heif'], convertTo: 'image/jpeg' },
  },
  
  // Canvas export preferences (order matters - try first to last)
  CANVAS_EXPORT: [
    { format: 'image/jpeg', quality: 0.9, name: 'JPEG' },  // Smaller file size
    { format: 'image/png', name: 'PNG' },                  // Fallback (supports transparency)
  ],
} as const

/**
 * Check if file type is supported
 */
export function isSupportedImageType(file: File): boolean {
  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()
  
  // Check native formats
  const nativeFormats = Object.values(IMAGE_FORMATS.NATIVE)
  const isNative = nativeFormats.some(format => 
    format.mime === fileType || 
    format.extensions.some(ext => fileName.endsWith(ext))
  )
  
  if (isNative) return true
  
  // Check convertible formats
  const convertibleFormats = Object.values(IMAGE_FORMATS.NEEDS_CONVERSION)
  const isConvertible = convertibleFormats.some(format =>
    format.mime === fileType ||
    format.extensions.some(ext => fileName.endsWith(ext))
  )
  
  return isConvertible
}

/**
 * Check if file needs server-side conversion
 */
export function needsConversion(file: File): boolean {
  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()
  
  const convertibleFormats = Object.values(IMAGE_FORMATS.NEEDS_CONVERSION)
  return convertibleFormats.some(format =>
    format.mime === fileType ||
    format.extensions.some(ext => fileName.endsWith(ext))
  )
}

/**
 * Get human-readable list of supported formats
 */
export function getSupportedFormatsString(): string {
  const native = Object.values(IMAGE_FORMATS.NATIVE)
    .flatMap(f => f.extensions)
    .join(', ')
  
  const convertible = Object.values(IMAGE_FORMATS.NEEDS_CONVERSION)
    .flatMap(f => f.extensions)
    .join(', ')
  
  return `${native}, ${convertible}`
}

/**
 * Image Pipeline Documentation
 * 
 * 1. UPLOAD:
 *    - Native formats (JPEG, PNG, WebP, GIF) → Direct upload to Supabase
 *    - HEIC/HEIF → Convert to JPEG via /api/convert-heic → Upload to Supabase
 *    - All formats → Generate local data URL (FileReader) for cropping
 * 
 * 2. DETECTION:
 *    - Uses Supabase URL (public HTTP URL for DINOx API)
 * 
 * 3. CROPPING:
 *    - Uses local data URL (avoid CORS taint)
 *    - Canvas export: Try JPEG first (smaller), fallback to PNG
 * 
 * 4. DESCRIPTION:
 *    - Uses cropped data URL (JPEG or PNG)
 *    - OpenAI GPT-4o-mini accepts both formats
 * 
 * 5. SEARCH:
 *    - Uploads cropped data URL to Supabase → Get HTTP URL
 *    - Uses Supabase URL (Serper requires public HTTP URL)
 */

