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
const BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run'
const SEARCH_API_URL = 'http://localhost:3000/api/search'

// PARALLEL PROCESSING SETTINGS
const CONCURRENCY = 2 // Process 2 images at a time (Modal backend has 60s timeout)
const DELAY_BETWEEN_BATCHES = 2000 // 2 seconds between batches

console.log('🔧 Configuration:')
console.log(`- Supabase: ${SUPABASE_URL}`)
console.log(`- Backend: ${BACKEND_URL}`)
console.log(`- Search API: ${SEARCH_API_URL}`)
console.log(`- Concurrency: ${CONCURRENCY} images at a time`)
console.log(`- Delay between batches: ${DELAY_BETWEEN_BATCHES}ms\n`)

// Category mapping (Korean to English)
const CATEGORY_MAP = {
  '전체 코디': 'full_outfit',
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
      
      const cleanedItems = wantedItems.replace(/^"|"$/g, '')
      const items = cleanedItems.split(',').map(s => s.trim()).filter(Boolean)
      
      data.push({ filename, phone, wantedItems: items })
    }
  }
  
  return data
}

// Upload to Supabase
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
  
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/images/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'image/jpeg',
    },
    body: fileBuffer
  })
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${await response.text()}`)
  }
  
  return `${SUPABASE_URL}/storage/v1/object/public/images/${fileName}`
}

// Crop image
async function cropImage(imageUrl, categories) {
  const response = await fetch(`${BACKEND_URL}/crop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, categories })
  })
  
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`)
  }
  
  return await response.json()
}

// Search for products
async function searchProducts(categories, croppedImages) {
  const response = await fetch(SEARCH_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories, croppedImages })
  })
  
  if (!response.ok) {
    throw new Error(await response.text())
  }
  
  return await response.json()
}

// Process a single image
async function processImage(imagePath, phone, wantedItems, index, total) {
  const filename = path.basename(imagePath)
  const startTime = Date.now()
  
  const result = {
    index,
    filename,
    phone,
    requested_categories_kr: wantedItems,
    requested_categories_en: [],
    status: 'pending',
    upload_time: 0,
    crop_time: 0,
    search_time: 0,
    total_time: 0,
    error: null,
    cropped_items: 0,
    search_results: {},
    source_counts: null
  }
  
  try {
    // Map categories
    result.requested_categories_en = wantedItems.map(item => CATEGORY_MAP[item] || item)
    
    console.log(`\n[${index}/${total}] 📸 ${filename}`)
    console.log(`   🎯 Requested: ${wantedItems.join(', ')} → ${result.requested_categories_en.join(', ')}`)
    
    // Step 1: Upload
    const t0 = Date.now()
    const imageUrl = await uploadToSupabase(imagePath)
    result.upload_time = ((Date.now() - t0) / 1000).toFixed(2)
    console.log(`   ✅ Uploaded in ${result.upload_time}s`)
    
    // Step 2: Crop
    const t1 = Date.now()
    const cropData = await cropImage(imageUrl, result.requested_categories_en)
    result.crop_time = ((Date.now() - t1) / 1000).toFixed(2)
    
    // Build crops object
    const crops = {}
    if (cropData.croppedImageUrl) {
      crops[result.requested_categories_en[0]] = cropData.croppedImageUrl
      result.cropped_items = 1
    } else if (cropData.croppedImageUrls) {
      cropData.croppedImageUrls.forEach((url, idx) => {
        const category = result.requested_categories_en[idx] || `item${idx + 1}`
        crops[category] = url
      })
      result.cropped_items = cropData.croppedImageUrls.length
    }
    
    console.log(`   ✂️  Cropped ${result.cropped_items} items in ${result.crop_time}s`)
    
    // Step 3: Search
    const t2 = Date.now()
    const searchResult = await searchProducts(result.requested_categories_en, crops)
    result.search_time = ((Date.now() - t2) / 1000).toFixed(2)
    
    if (searchResult.results) {
      result.search_results = searchResult.results
      
      if (searchResult.meta?.sourceCounts) {
        result.source_counts = searchResult.meta.sourceCounts
        console.log(`   🔍 Searched in ${result.search_time}s (GPT=${searchResult.meta.sourceCounts.gpt}, Fallback=${searchResult.meta.sourceCounts.fallback})`)
      } else {
        console.log(`   🔍 Searched in ${result.search_time}s`)
      }
    }
    
    result.total_time = ((Date.now() - startTime) / 1000).toFixed(2)
    result.status = 'success'
    console.log(`   ✅ Completed in ${result.total_time}s`)
    
  } catch (error) {
    result.status = 'failed'
    result.error = error.message
    result.total_time = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`   ❌ FAILED: ${error.message}`)
  }
  
  return result
}

// Process images in parallel batches
async function processBatch(batch, startIndex, total) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🚀 Processing batch ${Math.floor(startIndex / CONCURRENCY) + 1} (${batch.length} images)`)
  console.log('='.repeat(80))
  
  const promises = batch.map((item, idx) => 
    processImage(item.imagePath, item.phone, item.wantedItems, startIndex + idx + 1, total)
  )
  
  return await Promise.all(promises)
}

// Main function
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.error('Usage: node batch_test_batch2_parallel.js <csv_file> <images_dir>')
    process.exit(1)
  }
  
  const csvPath = args[0]
  const imagesDir = args[1]
  
  console.log('\n🚀 PARALLEL BATCH TEST STARTING')
  console.log(`📄 CSV: ${csvPath}`)
  console.log(`📁 Images: ${imagesDir}\n`)
  
  // Parse CSV
  const csvData = parseCSV(csvPath)
  console.log(`📊 Found ${csvData.length} images in CSV`)
  
  // Find matching images
  const tasks = []
  for (const entry of csvData) {
    const imagePath = path.join(imagesDir, entry.filename)
    if (fs.existsSync(imagePath)) {
      tasks.push({ ...entry, imagePath })
    } else {
      console.log(`⚠️  Image not found: ${entry.filename}`)
    }
  }
  
  console.log(`🎯 Processing ${tasks.length} images\n`)
  
  // Process in batches
  const allResults = []
  const totalStartTime = Date.now()
  
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY)
    const batchResults = await processBatch(batch, i, tasks.length)
    allResults.push(...batchResults)
    
    // Wait between batches (except for the last one)
    if (i + CONCURRENCY < tasks.length) {
      console.log(`\n⏸️  Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`)
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
    }
  }
  
  const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(2)
  
  // Calculate statistics
  const successful = allResults.filter(r => r.status === 'success').length
  const failed = allResults.filter(r => r.status === 'failed').length
  
  const avgUploadTime = (allResults.reduce((sum, r) => sum + parseFloat(r.upload_time || 0), 0) / allResults.length).toFixed(2)
  const avgCropTime = (allResults.reduce((sum, r) => sum + parseFloat(r.crop_time || 0), 0) / allResults.length).toFixed(2)
  const avgSearchTime = (allResults.reduce((sum, r) => sum + parseFloat(r.search_time || 0), 0) / allResults.length).toFixed(2)
  const avgTotalTime = (allResults.reduce((sum, r) => sum + parseFloat(r.total_time || 0), 0) / allResults.length).toFixed(2)
  
  // Calculate source statistics
  const totalSourceCounts = { gpt: 0, fallback: 0, none: 0, error: 0 }
  allResults.forEach(r => {
    if (r.source_counts) {
      totalSourceCounts.gpt += r.source_counts.gpt || 0
      totalSourceCounts.fallback += r.source_counts.fallback || 0
      totalSourceCounts.none += r.source_counts.none || 0
      totalSourceCounts.error += r.source_counts.error || 0
    }
  })
  
  // Save results
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
  const outputPath = `batch_test_results_parallel_${timestamp}.json`
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2))
  
  // Print summary
  console.log('\n' + '='.repeat(80))
  console.log('📊 PARALLEL BATCH TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(`✅ Successful: ${successful}/${allResults.length}`)
  console.log(`❌ Failed: ${failed}/${allResults.length}`)
  console.log(``)
  console.log(`⏱️  Average Times:`)
  console.log(`   Upload:  ${avgUploadTime}s`)
  console.log(`   Crop:    ${avgCropTime}s`)
  console.log(`   Search:  ${avgSearchTime}s`)
  console.log(`   Total:   ${avgTotalTime}s per image`)
  console.log(``)
  console.log(`⏱️  Wall Clock Time: ${totalTime}s (${(totalTime / 60).toFixed(2)} minutes)`)
  console.log(`⚡ Speedup: ${(allResults.length * parseFloat(avgTotalTime) / parseFloat(totalTime)).toFixed(2)}x faster than sequential`)
  
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
  
  console.log(`\n💾 Results saved to: ${outputPath}`)
  console.log('='.repeat(80))
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})

