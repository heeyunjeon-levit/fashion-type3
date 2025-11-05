const fs = require('fs')
const path = require('path')

// Load .env
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
// Force CPU backend (the one that works properly) - override env var if needed
const BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run'
const SEARCH_API_URL = 'http://localhost:3000/api/search'

console.log('🔧 Configuration:')
console.log(`- Supabase: ${SUPABASE_URL}`)
console.log(`- Backend: ${BACKEND_URL}`)
console.log(`- Search API: ${SEARCH_API_URL}\n`)

// Category mapping (Korean to English)
const CATEGORY_MAP = {
  '전체 코디': 'full_outfit', // Will handle specially
  '상의': 'tops',
  '하의': 'bottoms',
  '신발': 'shoes',
  '가방': 'bags',
  '악세사리': 'accessories',
  '드레스': 'dress'
}

// Parse CSV (handles quoted values)
function parseCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.trim().split('\n')
  
  const data = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    
    // Parse CSV line (handle quoted values)
    const values = []
    let current = ''
    let inQuotes = false
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    
    if (values.length >= 3) {
      const filename = values[0]
      const phone = values[1]
      const wantedItems = values[2]
      
      if (filename && wantedItems) {
        // Parse wanted items (remove any remaining quotes)
        const cleanedItems = wantedItems.replace(/^"|"$/g, '')
        const categories = cleanedItems.split(',').map(c => c.trim()).filter(c => c)
        data.push({ filename, phone, categories })
      }
    }
  }
  
  return data
}

// Upload image to Supabase
async function uploadToSupabase(imagePath) {
  const originalName = path.basename(imagePath)
  // Sanitize filename: remove non-ASCII characters (Korean, etc.)
  const sanitizedName = originalName
    .normalize('NFD') // Normalize unicode
    .replace(/[\u0080-\uFFFF]/g, '') // Remove non-ASCII
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
    .replace(/_+/g, '_') // Collapse multiple underscores
  
  const fileName = `batch_test_${Date.now()}_${sanitizedName}`
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
    throw new Error(`Upload failed: ${await uploadResponse.text()}`)
  }
  
  return `${SUPABASE_URL}/storage/v1/object/public/images/${fileName}`
}

// Crop image
async function cropImage(imageUrl, categories) {
  const cropResponse = await fetch(`${BACKEND_URL}/crop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: imageUrl,
      categories: categories
    })
  })
  
  if (!cropResponse.ok) {
    throw new Error(`Crop failed: ${await cropResponse.text()}`)
  }
  
  return await cropResponse.json()
}

// Search products
async function searchProducts(fullImageUrl, croppedImages) {
  const categories = Object.keys(croppedImages)
  
  const searchResponse = await fetch(SEARCH_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categories: categories,
      croppedImages: croppedImages,
      originalImageUrl: fullImageUrl
    })
  })
  
  if (!searchResponse.ok) {
    throw new Error(`Search failed: ${await searchResponse.text()}`)
  }
  
  return await searchResponse.json()
}

// Test single image
async function testImage(filename, categories, phone, batchDir) {
  const imagePath = path.join(batchDir, filename)
  
  if (!fs.existsSync(imagePath)) {
    throw new Error(`File not found: ${filename}`)
  }
  
  console.log(`\n${'='.repeat(100)}`)
  console.log(`📸 Testing: ${filename}`)
  console.log(`📞 Phone: ${phone}`)
  console.log(`🎯 Requested: ${categories.join(', ')}`)
  console.log(`${'='.repeat(100)}`)
  
  const result = {
    filename,
    phone,
    requested_categories: categories.join(', '),
    status: 'pending',
    upload_time: 0,
    crop_time: 0,
    search_time: 0,
    total_time: 0,
    original_image_url: '',
    cropped_urls: {},
    search_results: {},
    errors: []
  }
  
  const startTime = Date.now()
  
  try {
    // Step 1: Upload
    console.log('\n📤 Step 1: Uploading...')
    const uploadStart = Date.now()
    const imageUrl = await uploadToSupabase(imagePath)
    result.upload_time = ((Date.now() - uploadStart) / 1000).toFixed(2)
    result.original_image_url = imageUrl
    console.log(`✅ Uploaded in ${result.upload_time}s`)
    console.log(`   URL: ${imageUrl}`)
    
    // Map categories
    let apiCategories = categories.map(cat => CATEGORY_MAP[cat]).filter(c => c)
    
    // Handle "전체 코디" (full outfit) - use all categories
    if (categories.includes('전체 코디')) {
      apiCategories = ['tops', 'bottoms', 'shoes', 'bags', 'accessories']
    }
    
    // Remove duplicates
    apiCategories = [...new Set(apiCategories)]
    
    console.log(`\n✂️  Step 2: Cropping for: ${apiCategories.join(', ')}`)
    const cropStart = Date.now()
    const cropResult = await cropImage(imageUrl, apiCategories)
    result.crop_time = ((Date.now() - cropStart) / 1000).toFixed(2)
    
    // Build cropped images object
    const croppedImages = {}
    if (cropResult.croppedImageUrl) {
      // Single URL (backward compatibility)
      croppedImages[apiCategories[0]] = cropResult.croppedImageUrl
      result.cropped_urls[apiCategories[0]] = cropResult.croppedImageUrl
      
      // Extract item description from filename
      const croppedFilename = cropResult.croppedImageUrl.split('/').pop().split('?')[0]
      console.log(`✅ Cropped in ${result.crop_time}s`)
      console.log(`   Filename: ${croppedFilename}`)
      
      // Check if item description is present
      const hasDescription = croppedFilename.includes('_') && !croppedFilename.startsWith('crop_')
      if (hasDescription) {
        const parts = croppedFilename.split('_')
        const description = parts.slice(1, -1).join(' ').replace('.jpg', '').replace('.jpeg', '')
        console.log(`   📝 Item description: "${description}"`)
        
        // Check for sub-type keywords
        const desc = description.toLowerCase()
        if (desc.includes('ring') || desc.includes('necklace') || desc.includes('bracelet') || 
            desc.includes('jacket') || desc.includes('sweater') || desc.includes('boot') || desc.includes('sneaker')) {
          console.log(`   ✅ Sub-type detected - filtering will work!`)
        } else {
          console.log(`   ⚠️  Generic description - filtering may not work`)
        }
      } else {
        console.log(`   ❌ No item description in filename - filtering will NOT work!`)
        result.errors.push('No item description in cropped filename')
      }
    } else if (cropResult.croppedImageUrls) {
      // Multiple URLs
      cropResult.croppedImageUrls.forEach((url, idx) => {
        const category = apiCategories[idx] || `item${idx + 1}`
        croppedImages[category] = url
        result.cropped_urls[category] = url
      })
      console.log(`✅ Cropped ${Object.keys(croppedImages).length} images in ${result.crop_time}s`)
    } else {
      throw new Error('No cropped images returned')
    }
    
    // Step 3: Search
    console.log(`\n🔍 Step 3: Searching for products...`)
    const searchStart = Date.now()
    const searchResult = await searchProducts(imageUrl, croppedImages)
    result.search_time = ((Date.now() - searchStart) / 1000).toFixed(2)
    
    if (searchResult.results) {
      result.search_results = searchResult.results
      
      // Track result sources (GPT vs Fallback)
      if (searchResult.meta?.sourceCounts) {
        result.source_counts = searchResult.meta.sourceCounts
        console.log(`✅ Search completed in ${result.search_time}s`)
        console.log(`   📈 Sources: GPT=${searchResult.meta.sourceCounts.gpt}, Fallback=${searchResult.meta.sourceCounts.fallback}`)
      } else {
        console.log(`✅ Search completed in ${result.search_time}s`)
      }
      
      // Display results
      for (const [category, links] of Object.entries(searchResult.results)) {
        if (links && links.length > 0) {
          console.log(`\n   📦 ${category}: ${links.length} links`)
          links.forEach((link, idx) => {
            // Handle both string and object formats
            const linkStr = typeof link === 'string' ? link : (link.url || link.link || JSON.stringify(link))
            console.log(`      ${idx + 1}. ${linkStr.substring(0, 80)}${linkStr.length > 80 ? '...' : ''}`)
          })
        } else {
          console.log(`\n   ⚠️  ${category}: No results`)
        }
      }
    }
    
    result.status = 'success'
    result.total_time = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log(`\n✅ COMPLETED in ${result.total_time}s`)
    
  } catch (error) {
    result.status = 'failed'
    result.errors.push(error.message)
    result.total_time = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log(`\n❌ FAILED: ${error.message}`)
  }
  
  return result
}

// Main function
async function main() {
  const args = process.argv.slice(2)
  const csvPath = args[0] || '/Users/levit/Desktop/batch2_matched_info.csv'
  const batchDir = args[1] || '/Users/levit/Desktop/batch2'
  const limitCount = args[2] ? parseInt(args[2]) : null
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`)
    process.exit(1)
  }
  
  if (!fs.existsSync(batchDir)) {
    console.error(`❌ Batch directory not found: ${batchDir}`)
    process.exit(1)
  }
  
  console.log(`\n🚀 BATCH TEST STARTING`)
  console.log(`📄 CSV: ${csvPath}`)
  console.log(`📁 Images: ${batchDir}`)
  if (limitCount) {
    console.log(`🔢 Limit: First ${limitCount} images`)
  }
  
  const data = parseCSV(csvPath)
  const testData = limitCount ? data.slice(0, limitCount) : data
  
  console.log(`\n📊 Found ${data.length} images in CSV`)
  console.log(`🎯 Testing ${testData.length} images\n`)
  
  const results = []
  let successCount = 0
  let failCount = 0
  
  for (let i = 0; i < testData.length; i++) {
    const item = testData[i]
    console.log(`\n[${i + 1}/${testData.length}]`)
    
    const result = await testImage(item.filename, item.categories, item.phone, batchDir)
    results.push(result)
    
    if (result.status === 'success') {
      successCount++
    } else {
      failCount++
    }
    
    // Small delay between requests
    if (i < testData.length - 1) {
      console.log('\n⏸️  Waiting 2 seconds before next test...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(100)}`)
  console.log(`📊 BATCH TEST SUMMARY`)
  console.log(`${'='.repeat(100)}`)
  console.log(`✅ Successful: ${successCount}/${testData.length}`)
  console.log(`❌ Failed: ${failCount}/${testData.length}`)
  
  const avgUploadTime = (results.reduce((sum, r) => sum + parseFloat(r.upload_time || 0), 0) / results.length).toFixed(2)
  const avgCropTime = (results.reduce((sum, r) => sum + parseFloat(r.crop_time || 0), 0) / results.length).toFixed(2)
  const avgSearchTime = (results.reduce((sum, r) => sum + parseFloat(r.search_time || 0), 0) / results.length).toFixed(2)
  const avgTotalTime = (results.reduce((sum, r) => sum + parseFloat(r.total_time || 0), 0) / results.length).toFixed(2)
  
  console.log(`\n⏱️  Average Times:`)
  console.log(`   Upload: ${avgUploadTime}s`)
  console.log(`   Crop: ${avgCropTime}s`)
  console.log(`   Search: ${avgSearchTime}s`)
  console.log(`   Total: ${avgTotalTime}s`)
  
  // Calculate aggregate source statistics
  const totalSourceCounts = { gpt: 0, fallback: 0, none: 0, error: 0 }
  results.forEach(r => {
    if (r.source_counts) {
      totalSourceCounts.gpt += r.source_counts.gpt || 0
      totalSourceCounts.fallback += r.source_counts.fallback || 0
      totalSourceCounts.none += r.source_counts.none || 0
      totalSourceCounts.error += r.source_counts.error || 0
    }
  })
  
  const totalSources = totalSourceCounts.gpt + totalSourceCounts.fallback + totalSourceCounts.none + totalSourceCounts.error
  if (totalSources > 0) {
    const gptPercent = ((totalSourceCounts.gpt / totalSources) * 100).toFixed(1)
    const fallbackPercent = ((totalSourceCounts.fallback / totalSources) * 100).toFixed(1)
    console.log(`\n📈 Result Source Statistics:`)
    console.log(`   GPT Selected: ${totalSourceCounts.gpt} (${gptPercent}%)`)
    console.log(`   Fallback Used: ${totalSourceCounts.fallback} (${fallbackPercent}%)`)
    console.log(`   No Results: ${totalSourceCounts.none}`)
    console.log(`   Errors: ${totalSourceCounts.error}`)
  }
  
  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = path.join(__dirname, `batch_test_results_${timestamp}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
  
  console.log(`\n📄 Full report saved to: ${reportPath}`)
  
  // Show failed tests
  const failed = results.filter(r => r.status === 'failed')
  if (failed.length > 0) {
    console.log(`\n❌ Failed Tests:`)
    failed.forEach(f => {
      console.log(`   - ${f.filename}: ${f.errors.join(', ')}`)
    })
  }
  
  console.log(`\n✅ Batch test complete!\n`)
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})

