/**
 * Test cropping quality for a specific image
 */

const fs = require('fs')
const path = require('path')

const IMAGE_PATH = '/Users/levit/Desktop/photos/36d2e0eeb84b-Screenshot_20250922_181119_Instagram.jpg'
const BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run'

// Load .env file manually
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
}

// Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Supabase URL:', SUPABASE_URL ? '✅ Loaded' : '❌ Missing')
console.log('Supabase Key:', SUPABASE_KEY ? '✅ Loaded' : '❌ Missing')
console.log('')

async function uploadToSupabase(filePath) {
  console.log('📤 Step 1: Uploading to Supabase...')
  
  const fileName = `test_${Date.now()}_${path.basename(filePath)}`
  const fileBuffer = fs.readFileSync(filePath)
  
  const uploadResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/images/${fileName}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/jpeg',
      },
      body: fileBuffer,
    }
  )

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text()
    throw new Error(`Upload failed: ${error}`)
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${fileName}`
  console.log(`✅ Uploaded: ${publicUrl}\n`)
  return publicUrl
}

async function testCropping(imageUrl) {
  console.log('✂️  Step 2: Testing cropping backend...')
  console.log(`Backend: ${BACKEND_URL}\n`)
  
  const startTime = Date.now()
  
  const response = await fetch(`${BACKEND_URL}/crop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageUrl: imageUrl,
      categories: ['shoes', 'tops', 'bottoms']
    })
  })

  const cropTime = Date.now() - startTime
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Crop failed: ${error}`)
  }

  const data = await response.json()
  console.log(`✅ Cropping completed in ${cropTime}ms\n`)
  
  console.log('📊 Detected items:')
  console.log('==================')
  
  if (data.cropped_images) {
    Object.keys(data.cropped_images).forEach(key => {
      console.log(`✓ ${key}`)
    })
  } else {
    console.log('❌ No items detected')
  }
  
  console.log('\n')
  return data
}

async function inspectCroppedShoes(croppedData) {
  console.log('🔍 Step 3: Inspecting cropped shoes quality...')
  console.log('==============================================\n')
  
  const shoesKeys = Object.keys(croppedData.cropped_images || {}).filter(k => k.startsWith('shoes'))
  
  if (shoesKeys.length === 0) {
    console.log('❌ No shoes detected in the image!')
    console.log('\n🤔 Possible reasons:')
    console.log('   1. Shoes too small in image')
    console.log('   2. Shoes partially obscured')
    console.log('   3. Detection confidence too low')
    console.log('   4. Shoes at edge of image (cropped out)')
    return null
  }
  
  console.log(`✅ Found ${shoesKeys.length} shoes detection(s):\n`)
  
  shoesKeys.forEach((key, idx) => {
    const url = croppedData.cropped_images[key]
    console.log(`${idx + 1}. ${key}:`)
    
    if (url.startsWith('http')) {
      console.log(`   Format: URL`)
      console.log(`   Link: ${url}`)
      console.log(`   👉 Open this in browser to inspect quality`)
    } else if (url.startsWith('data:image')) {
      const sizeKB = Math.round((url.length * 0.75) / 1024) // base64 is ~33% overhead
      console.log(`   Format: Base64`)
      console.log(`   Size: ~${sizeKB}KB`)
      console.log(`   👉 Copy base64 string and paste in browser address bar to inspect`)
      
      // Save to file for easier inspection
      const base64Data = url.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const outputPath = `/Users/levit/Desktop/mvp/cropped_shoes_${idx + 1}.jpg`
      fs.writeFileSync(outputPath, buffer)
      console.log(`   💾 Saved to: ${outputPath}`)
    }
    console.log('')
  })
  
  return croppedData.cropped_images[shoesKeys[0]]
}

async function testSearch(shoesImageUrl, originalImageUrl) {
  console.log('🔍 Step 4: Testing search with cropped shoes...')
  console.log('===============================================\n')
  
  const startTime = Date.now()
  
  const searchResponse = await fetch('http://localhost:3000/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      categories: ['shoes'],
      croppedImages: { shoes: shoesImageUrl },
      originalImageUrl: originalImageUrl
    })
  })

  const searchTime = Date.now() - startTime
  
  if (!searchResponse.ok) {
    const error = await searchResponse.text()
    console.log(`❌ Search failed: ${error}`)
    return
  }

  const searchData = await searchResponse.json()
  console.log(`✅ Search completed in ${searchTime}ms\n`)
  
  console.log('📊 Search Results:')
  console.log('==================')
  
  if (searchData.shoes && Array.isArray(searchData.shoes)) {
    console.log(`Found ${searchData.shoes.length} result(s):\n`)
    searchData.shoes.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title || 'No title'}`)
      console.log(`   ${result.link}`)
      console.log('')
    })
  } else {
    console.log('❌ No results found')
  }
}

async function main() {
  try {
    console.log('🧪 Testing Crop Quality for Shoes')
    console.log('==================================\n')
    console.log(`Image: ${IMAGE_PATH}\n`)
    
    // Check if image exists
    if (!fs.existsSync(IMAGE_PATH)) {
      console.log(`❌ Image not found at: ${IMAGE_PATH}`)
      return
    }
    
    // Upload to Supabase
    const imageUrl = await uploadToSupabase(IMAGE_PATH)
    
    // Test cropping
    const croppedData = await testCropping(imageUrl)
    
    // Inspect shoes
    const shoesUrl = await inspectCroppedShoes(croppedData)
    
    // Test search (optional - requires local dev server running)
    if (shoesUrl) {
      console.log('\n💡 To test search:')
      console.log('   1. Start dev server: npm run dev')
      console.log('   2. Run: node test_specific_image.js search')
      console.log('')
    }
    
    console.log('✅ Test complete!\n')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

main()

