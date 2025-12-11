/**
 * Frontend Image Cropping Utility
 * Uses Canvas API to crop images client-side (no backend needed!)
 */

import { IMAGE_FORMATS } from './imageFormats'

export interface CropOptions {
  imageUrl: string
  bbox: [number, number, number, number] // [x1, y1, x2, y2] normalized 0-1
  padding?: number // Optional padding around crop (default: 0.05)
}

/**
 * Crop image using Canvas API
 * Returns a data URL of the cropped image
 */
export async function cropImage(options: CropOptions): Promise<string> {
  const { imageUrl, bbox, padding = 0.05 } = options
  const [x1, y1, x2, y2] = bbox

  console.log('🖼️  cropImage called:', {
    imageUrlType: imageUrl.startsWith('data:') ? 'data URL' : imageUrl.startsWith('http') ? 'HTTP URL' : 'unknown',
    imageUrlStart: imageUrl.substring(0, 100),
    imageUrlLength: imageUrl.length,
    bbox
  })

  return new Promise((resolve, reject) => {
    const img = new Image()
    
    // Only set crossOrigin for HTTP URLs (not needed for data URLs)
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
      console.log('   ℹ️  Set crossOrigin=anonymous for HTTP URL')
    } else {
      console.log('   ℹ️  Data URL - no CORS needed')
    }
    
    img.onload = () => {
      console.log('   ✅ Image loaded successfully:', {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      })
      try {
        const imgWidth = img.naturalWidth
        const imgHeight = img.naturalHeight

        // Convert normalized coordinates to pixel coordinates
        let cropX = Math.floor(x1 * imgWidth)
        let cropY = Math.floor(y1 * imgHeight)
        let cropW = Math.floor((x2 - x1) * imgWidth)
        let cropH = Math.floor((y2 - y1) * imgHeight)

        // Add padding
        if (padding > 0) {
          const padX = Math.floor(cropW * padding)
          const padY = Math.floor(cropH * padding)
          
          cropX = Math.max(0, cropX - padX)
          cropY = Math.max(0, cropY - padY)
          cropW = Math.min(imgWidth - cropX, cropW + padX * 2)
          cropH = Math.min(imgHeight - cropY, cropH + padY * 2)
        }

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = cropW
        canvas.height = cropH
        
        console.log(`   📐 Canvas dimensions: ${cropW}x${cropH}`)
        
        const ctx = canvas.getContext('2d', { willReadFrequently: false })

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Draw cropped image
        ctx.drawImage(
          img,
          cropX, cropY, cropW, cropH,  // Source rectangle
          0, 0, cropW, cropH            // Destination rectangle
        )
        
        console.log(`   ✅ Image drawn to canvas`)

        // Convert to data URL
        try {
          // Try formats in order from IMAGE_FORMATS.CANVAS_EXPORT
          let dataUrl: string = ''
          
          for (const exportFormat of IMAGE_FORMATS.CANVAS_EXPORT) {
            console.log(`   🎨 Converting canvas to ${exportFormat.name}...`)
            dataUrl = exportFormat.quality !== undefined 
              ? canvas.toDataURL(exportFormat.format, exportFormat.quality)
              : canvas.toDataURL(exportFormat.format)
            
            console.log(`   📊 ${exportFormat.name} result: ${dataUrl.length} bytes, starts with: ${dataUrl.substring(0, 50)}`)
            
            // Check if export succeeded
            if (dataUrl && dataUrl !== 'data:,' && dataUrl.length >= 100) {
              console.log(`   ✅ Successfully exported as ${exportFormat.name}: ${Math.round(dataUrl.length / 1024)}KB`)
              resolve(dataUrl)
              return
            }
            
            console.warn(`   ⚠️ ${exportFormat.name} export failed, trying next format...`)
          }
          
          // If we get here, all formats failed
          console.log(`   📊 Final attempt result: ${dataUrl.length} bytes, starts with: ${dataUrl.substring(0, 50)}`)
          
          // All export formats failed - canvas is tainted
          console.error('❌ TAINTED CANVAS: All export formats failed!')
          console.error('   Tried formats:', IMAGE_FORMATS.CANVAS_EXPORT.map(f => f.name).join(', '))
          console.error('   Canvas dimensions:', canvas.width, 'x', canvas.height)
          console.error('   Original imageUrl:', imageUrl.substring(0, 100))
          console.error('   This is a browser security restriction - canvas is tainted')
          reject(new Error(`Canvas tainted - all export formats failed: ${IMAGE_FORMATS.CANVAS_EXPORT.map(f => f.name).join(', ')}`))
          return
        } catch (error) {
          console.error('❌ toDataURL exception:', error)
          reject(new Error(`Canvas export failed: ${error}`))
        }
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = (error) => {
      console.error('❌ Image load error:', error)
      console.error('   Failed URL:', imageUrl.substring(0, 100))
      reject(new Error(`Failed to load image: ${error}`))
    }

    img.src = imageUrl
  })
}

/**
 * Crop multiple images in parallel
 */
export async function cropImages(options: CropOptions[]): Promise<string[]> {
  return Promise.all(options.map(opt => cropImage(opt)))
}

/**
 * Generate multiple bounding box variations
 * This helps reduce influence of background objects by trying different crop regions
 */
export function generateBboxVariations(
  bbox: [number, number, number, number],
  numVariations: number = 7
): [number, number, number, number][] {
  const [x1, y1, x2, y2] = bbox
  const width = x2 - x1
  const height = y2 - y1
  
  const variations: [number, number, number, number][] = [
    // 1. Original bbox (baseline)
    [x1, y1, x2, y2],
    
    // 2. Tighter crop (shrink by 8% on all sides - removes outer background)
    [
      Math.max(0, x1 + width * 0.08),
      Math.max(0, y1 + height * 0.08),
      Math.min(1, x2 - width * 0.08),
      Math.min(1, y2 - height * 0.08)
    ],
    
    // 3. Slightly tighter (shrink by 5% on all sides)
    [
      Math.max(0, x1 + width * 0.05),
      Math.max(0, y1 + height * 0.05),
      Math.min(1, x2 - width * 0.05),
      Math.min(1, y2 - height * 0.05)
    ],
    
    // DIRECTIONAL VARIATIONS (remove 15% from each side to avoid edge objects)
    
    // 4. Remove bottom 15% (helps if bag/shoes at bottom)
    [
      x1,
      y1,
      x2,
      Math.min(1, y2 - height * 0.15)
    ],
    
    // 5. Remove top 15% (helps if hat/background at top)
    [
      x1,
      Math.max(0, y1 + height * 0.15),
      x2,
      y2
    ],
    
    // 6. Remove right 15% (helps if person/object on right side)
    [
      x1,
      y1,
      Math.min(1, x2 - width * 0.15),
      y2
    ],
    
    // 7. Remove left 15% (helps if person/object on left side)
    [
      Math.max(0, x1 + width * 0.15),
      y1,
      x2,
      y2
    ]
  ]
  
  // Return requested number of variations (no "wider" version - we already search full image separately)
  return variations.slice(0, numVariations)
}

/**
 * Crop multiple variations of the same item with different bounding boxes
 * This helps improve search accuracy by reducing influence of background objects
 */
export async function cropImageVariations(
  imageUrl: string,
  bbox: [number, number, number, number],
  numVariations: number = 7,
  padding: number = 0.05
): Promise<string[]> {
  const bboxVariations = generateBboxVariations(bbox, numVariations)
  
  console.log(`🎯 Generating ${bboxVariations.length} bbox variations for improved accuracy`)
  console.log(`   Strategy: Original + Tighter crops + 4 directional variations (no wider - we search full image separately)`)
  bboxVariations.forEach((variation, idx) => {
    const labels = [
      'Original',
      'Tighter -8%',
      'Tighter -5%',
      'Remove bottom 15%',
      'Remove top 15%',
      'Remove right 15%',
      'Remove left 15%'
    ]
    console.log(`   ${idx + 1}. ${labels[idx]}: [${variation.map(v => v.toFixed(3)).join(', ')}]`)
  })
  
  // Crop all variations in parallel
  const cropOptions: CropOptions[] = bboxVariations.map(bboxVar => ({
    imageUrl,
    bbox: bboxVar,
    padding
  }))
  
  return cropImages(cropOptions)
}

/**
 * Upload cropped image data URL to Supabase
 */
export async function uploadCroppedImage(
  dataUrl: string,
  category: string
): Promise<string> {
  const response = await fetch('/api/upload-cropped', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, category })
  })

  if (!response.ok) {
    throw new Error('Failed to upload cropped image')
  }

  const data = await response.json()
  return data.url
}

