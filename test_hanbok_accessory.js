const fs = require('fs')
const path = require('path')

// Load environment variables
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run'

const IMAGE_PATH = '/Users/levit/Desktop/batch2/8837d550aade-Screenshot_20250726_104132_NAVER.jpg'

async function uploadToSupabase(imagePath) {
  const originalName = path.basename(imagePath)
  const sanitizedName = originalName
    .normalize('NFD')
    .replace(/[\u0080-\uFFFF]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
  
  const fileName = `test_hanbok_${Date.now()}_${sanitizedName}`
  const fileBuffer = fs.readFileSync(imagePath)
  
  const uploadResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/images/${fileName}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/jpeg',
      },
      body: fileBuffer
    }
  )
  
  if (!uploadResponse.ok) {
    const error = await uploadResponse.text()
    throw new Error(`Upload failed: ${error}`)
  }
  
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${fileName}`
  return publicUrl
}

async function testHanbokAccessory() {
  console.log('🎎 TESTING HANBOK ACCESSORY DETECTION')
  console.log('=====================================\n')
  
  try {
    // Step 1: Upload image
    console.log('📤 Step 1: Uploading hanbok image...')
    const imageUrl = await uploadToSupabase(IMAGE_PATH)
    console.log(`✅ Uploaded: ${imageUrl}\n`)
    
    // Step 2: Call crop API with "accessory"
    console.log('🔍 Step 2: Analyzing image for accessories...')
    console.log('   Category: 악세사리 (accessory)\n')
    
    const cropResponse = await fetch(`${BACKEND_URL}/crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: imageUrl,
        categories: ['accessory']
      })
    })
    
    if (!cropResponse.ok) {
      const error = await cropResponse.text()
      throw new Error(`Crop API failed: ${error}`)
    }
    
    const cropResult = await cropResponse.json()
    console.log('📊 CROP API RESPONSE:')
    console.log('=====================\n')
    console.log(JSON.stringify(cropResult, null, 2))
    
    // Extract GPT-4o analysis from the response
    if (cropResult.croppedImages && cropResult.croppedImages.accessory) {
      console.log('\n✅ GPT-4o found accessories!')
      console.log(`   Cropped URL: ${cropResult.croppedImages.accessory}`)
      
      // Extract description from filename
      const filename = cropResult.croppedImages.accessory.split('/').pop()
      console.log(`   Filename: ${filename}`)
      
      // Try to extract description
      if (filename.includes('_')) {
        const parts = filename.split('_')
        const description = parts.slice(1, -1).join(' ').replace('.jpg', '').replace('.jpeg', '')
        console.log(`   🎯 DETECTED ACCESSORY: "${description}"`)
      }
    } else {
      console.log('\n❌ No accessories detected by GPT-4o')
    }
    
    // Show any errors
    if (cropResult.errors && Object.keys(cropResult.errors).length > 0) {
      console.log('\n⚠️ ERRORS:')
      console.log(JSON.stringify(cropResult.errors, null, 2))
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testHanbokAccessory()


