/**
 * Test script to diagnose cropping quality issues
 * Usage: node test_crop_quality.js <image_url_or_path>
 */

const fs = require('fs')
const path = require('path')

// Backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_CROPPER_URL || 
  'https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run'

async function testCropQuality(imageInput) {
  console.log('🔍 Testing Crop Quality')
  console.log('=====================\n')
  console.log(`Backend: ${BACKEND_URL}`)
  console.log(`Input: ${imageInput}\n`)

  let imageUrl = imageInput
  
  // If it's a local file, we'd need to upload it first
  if (!imageInput.startsWith('http')) {
    console.log('❌ Please provide a URL (not a local file path)')
    console.log('   Upload your image first via the web UI, then use the Supabase URL')
    return
  }

  try {
    console.log('📤 Step 1: Sending to backend for cropping...')
    const startTime = Date.now()
    
    const response = await fetch(`${BACKEND_URL}/crop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: imageUrl,
        categories: ['shoes', 'tops', 'bottoms', 'bag']
      })
    })

    const cropTime = Date.now() - startTime
    console.log(`⏱️  Crop took: ${cropTime}ms\n`)

    if (!response.ok) {
      const error = await response.text()
      console.log('❌ Crop failed:', error)
      return
    }

    const data = await response.json()
    console.log('✅ Crop successful!\n')
    console.log('📊 Results:')
    console.log('==========')
    
    if (data.cropped_images) {
      Object.entries(data.cropped_images).forEach(([key, url]) => {
        console.log(`\n${key}:`)
        console.log(`  URL: ${url}`)
        console.log(`  Length: ${url.length} chars`)
        
        // Check if it's base64 or URL
        if (url.startsWith('data:image')) {
          console.log(`  Format: Base64 (${Math.round(url.length / 1024)}KB)`)
        } else if (url.startsWith('http')) {
          console.log(`  Format: URL`)
        }
      })
    }

    // Now test searching with the cropped shoes image
    if (data.cropped_images?.shoes) {
      console.log('\n\n🔍 Step 2: Testing search with cropped shoes...')
      const searchStart = Date.now()
      
      const searchResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: ['shoes'],
          croppedImages: { shoes: data.cropped_images.shoes },
          originalImageUrl: imageUrl
        })
      })

      const searchTime = Date.now() - searchStart
      console.log(`⏱️  Search took: ${searchTime}ms\n`)

      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        console.log('✅ Search results:')
        console.log(JSON.stringify(searchData, null, 2))
      } else {
        const error = await searchResponse.text()
        console.log('❌ Search failed:', error)
      }
    } else {
      console.log('\n⚠️  No shoes detected in image')
    }

    // Output instructions
    console.log('\n\n📋 Manual Inspection:')
    console.log('===================')
    console.log('To visually inspect the cropped image quality:')
    if (data.cropped_images?.shoes) {
      if (data.cropped_images.shoes.startsWith('http')) {
        console.log(`1. Open in browser: ${data.cropped_images.shoes}`)
      } else {
        console.log('1. Copy the base64 data')
        console.log('2. Paste into browser address bar')
        console.log('3. Check if the cropped region includes the full shoes with good quality')
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Run test
const imageInput = process.argv[2]
if (!imageInput) {
  console.log('Usage: node test_crop_quality.js <image_url>')
  console.log('\nExample:')
  console.log('  node test_crop_quality.js https://your-supabase-url.com/image.jpg')
  process.exit(1)
}

testCropQuality(imageInput)

