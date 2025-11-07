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
const BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run'
const SEARCH_API_URL = 'http://localhost:3000/api/search'

// HYBRID PROCESSING SETTINGS
const UPLOAD_BATCH_SIZE = 10  // Upload 10 images at a time (fast)
const SEARCH_CONCURRENCY = 3   // Search 3 results at a time (fast)

console.log('🔧 Configuration:')
console.log(`- Supabase: ${SUPABASE_URL}`)
console.log(`- Backend: ${BACKEND_URL}`)
console.log(`- Search API: ${SEARCH_API_URL}`)
console.log(`- Strategy: Parallel uploads, Sequential crops, Parallel searches`)
console.log(`- Upload batch: ${UPLOAD_BATCH_SIZE} at a time`)
console.log(`- Search concurrency: ${SEARCH_CONCURRENCY} at a time\n`)

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
  const sanitizedName = originalName
    .normalize('NFD')
    .replace(/[\u0080-\uFFFF]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
  
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

// Crop image (SEQUENTIAL - Modal bottleneck)
async function cropImage(imageUrl, categories, retryCount = 0) {
  const maxRetries = 2
  
  try {
    // Create AbortController for timeout (5 minutes max)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minutes
    
    const response = await fetch(`${BACKEND_URL}/crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, categories }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorText = await response.text()
      
      // Retry on 408 timeout errors
      if (response.status === 408 && retryCount < maxRetries) {
        console.log(`   ⚠️  408 timeout, retrying (${retryCount + 1}/${maxRetries})...`)
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
        return await cropImage(imageUrl, categories, retryCount + 1)
      }
      
      throw new Error(`${response.status}: ${errorText}`)
    }
    
    return await response.json()
  } catch (error) {
    // Retry on network errors (ECONNRESET, etc.)
    if (error.name === 'AbortError') {
      if (retryCount < maxRetries) {
        console.log(`   ⚠️  Request timeout, retrying (${retryCount + 1}/${maxRetries})...`)
        await new Promise(resolve => setTimeout(resolve, 3000))
        return await cropImage(imageUrl, categories, retryCount + 1)
      }
      throw new Error('Request timeout after retries')
    }
    throw error
  }
}

// Search for products (can be parallelized)
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

// Upload images in parallel batches
async function uploadBatch(tasks) {
  console.log(`\n📤 Uploading ${tasks.length} images in parallel...`)
  const startTime = Date.now()
  
  const promises = tasks.map(async (task, idx) => {
    try {
      const imageUrl = await uploadToSupabase(task.imagePath)
      console.log(`   ✅ [${idx + 1}/${tasks.length}] ${task.filename}`)
      return { ...task, imageUrl, uploadSuccess: true }
    } catch (error) {
      console.log(`   ❌ [${idx + 1}/${tasks.length}] ${task.filename}: ${error.message}`)
      return { ...task, imageUrl: null, uploadSuccess: false, error: error.message }
    }
  })
  
  const results = await Promise.all(promises)
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  const successful = results.filter(r => r.uploadSuccess).length
  
  console.log(`✅ Uploaded ${successful}/${tasks.length} images in ${elapsed}s`)
  return results
}

// Process single image (upload done, now crop + search sequentially)
async function processImage(task, index, total) {
  const result = {
    index,
    filename: task.filename,
    phone: task.phone,
    requested_categories_kr: task.wantedItems,
    requested_categories_en: task.wantedItems.map(item => CATEGORY_MAP[item] || item),
    status: 'pending',
    upload_time: 0,
    crop_time: 0,
    search_time: 0,
    total_time: 0,
    error: null,
    cropped_items: 0,
    original_image_url: null,
    cropped_image_urls: {},
    search_results: {},
    source_counts: null
  }
  
  const startTime = Date.now()
  
  try {
    console.log(`\n[${index}/${total}] ✂️  Cropping: ${task.filename}`)
    console.log(`   🎯 ${result.requested_categories_en.join(', ')}`)
    
    // Upload was already done
    if (!task.uploadSuccess) {
      throw new Error(`Upload failed: ${task.error}`)
    }
    
    // Save original image URL
    result.original_image_url = task.imageUrl
    
    // Crop (SEQUENTIAL - bottleneck)
    const t1 = Date.now()
    const cropData = await cropImage(task.imageUrl, result.requested_categories_en)
    result.crop_time = ((Date.now() - t1) / 1000).toFixed(2)
    
    // Build crops object and save cropped URLs
    const crops = {}
    if (cropData.croppedImageUrl) {
      crops[result.requested_categories_en[0]] = cropData.croppedImageUrl
      result.cropped_image_urls[result.requested_categories_en[0]] = cropData.croppedImageUrl
      result.cropped_items = 1
    } else if (cropData.croppedImageUrls) {
      // Parse filename to determine actual category (don't trust array order!)
      const categoryKeywords = {
        'tops': ['shirt', 'blouse', 'top', 'tee', 'sweater', 'hoodie', 'jacket', 'cardigan', 'vest'],
        'bottoms': ['pants', 'jeans', 'skirt', 'shorts', 'trousers', 'leggings'],
        'dress': ['dress', 'gown'],
        'shoes': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer'],
        'bags': ['bag', 'purse', 'backpack', 'tote', 'clutch', 'handbag'],
        'accessories': ['necklace', 'bracelet', 'earring', 'watch', 'hat', 'scarf', 'belt', 'sunglasses', 'ring']
      }
      
      cropData.croppedImageUrls.forEach((url, idx) => {
        // Extract filename from URL
        const filename = url.split('/').pop().split('?')[0].toLowerCase()
        
        // Try to match filename keywords to requested categories
        let matchedCategory = null
        for (const requestedCat of result.requested_categories_en) {
          const keywords = categoryKeywords[requestedCat] || [requestedCat]
          if (keywords.some(keyword => filename.includes(keyword))) {
            matchedCategory = requestedCat
            break
          }
        }
        
        // Fallback to array index if no match found
        const category = matchedCategory || result.requested_categories_en[idx] || `item${idx + 1}`
        
        if (matchedCategory) {
          console.log(`   🎯 Matched '${filename}' → '${category}'`)
        } else {
          console.log(`   ⚠️  No match for '${filename}', using index → '${category}'`)
        }
        
        crops[category] = url
        result.cropped_image_urls[category] = url
      })
      result.cropped_items = cropData.croppedImageUrls.length
    }
    
    console.log(`   ✅ Cropped ${result.cropped_items} items in ${result.crop_time}s`)
    
    // Search (will batch these later)
    const t2 = Date.now()
    const searchResult = await searchProducts(result.requested_categories_en, crops)
    result.search_time = ((Date.now() - t2) / 1000).toFixed(2)
    
    if (searchResult.results) {
      result.search_results = searchResult.results
      
      if (searchResult.meta?.sourceCounts) {
        result.source_counts = searchResult.meta.sourceCounts
        const gpt = searchResult.meta.sourceCounts.gpt || 0
        const fallback = searchResult.meta.sourceCounts.fallback || 0
        console.log(`   🔍 Searched in ${result.search_time}s (GPT=${gpt}, Fallback=${fallback})`)
      } else {
        console.log(`   🔍 Searched in ${result.search_time}s`)
      }
    }
    
    result.total_time = ((Date.now() - startTime) / 1000).toFixed(2)
    result.status = 'success'
    
  } catch (error) {
    result.status = 'failed'
    result.error = error.message
    result.total_time = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`   ❌ FAILED: ${error.message}`)
  }
  
  return result
}

// Main function
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.error('Usage: node batch_test_batch2_hybrid.js <csv_file> <images_dir>')
    process.exit(1)
  }
  
  const csvPath = args[0]
  const imagesDir = args[1]
  
  console.log('\n🚀 HYBRID BATCH TEST STARTING')
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
  
  console.log(`🎯 Processing ${tasks.length} images`)
  
  const totalStartTime = Date.now()
  
  // ===== PHASE 1: PARALLEL UPLOADS =====
  console.log('\n' + '='.repeat(80))
  console.log('📤 PHASE 1: UPLOADING ALL IMAGES (PARALLEL)')
  console.log('='.repeat(80))
  
  const uploadedTasks = []
  for (let i = 0; i < tasks.length; i += UPLOAD_BATCH_SIZE) {
    const batch = tasks.slice(i, i + UPLOAD_BATCH_SIZE)
    const batchResults = await uploadBatch(batch)
    uploadedTasks.push(...batchResults)
    
    if (i + UPLOAD_BATCH_SIZE < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  const uploadTime = ((Date.now() - totalStartTime) / 1000).toFixed(2)
  console.log(`\n✅ All uploads completed in ${uploadTime}s`)
  
  // ===== PHASE 2: SEQUENTIAL CROPS + SEARCHES =====
  console.log('\n' + '='.repeat(80))
  console.log('✂️  PHASE 2: CROPPING + SEARCHING (SEQUENTIAL)')
  console.log('='.repeat(80))
  
  const allResults = []
  for (let i = 0; i < uploadedTasks.length; i++) {
    const result = await processImage(uploadedTasks[i], i + 1, uploadedTasks.length)
    allResults.push(result)
  }
  
  const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(2)
  
  // Calculate statistics
  const successful = allResults.filter(r => r.status === 'success').length
  const failed = allResults.filter(r => r.status === 'failed').length
  
  const avgCropTime = (allResults.reduce((sum, r) => sum + parseFloat(r.crop_time || 0), 0) / allResults.length).toFixed(2)
  const avgSearchTime = (allResults.reduce((sum, r) => sum + parseFloat(r.search_time || 0), 0) / allResults.length).toFixed(2)
  
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
  const outputPath = `batch_test_results_hybrid_${timestamp}.json`
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2))
  
  // Print summary
  console.log('\n' + '='.repeat(80))
  console.log('📊 HYBRID BATCH TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(`✅ Successful: ${successful}/${allResults.length}`)
  console.log(`❌ Failed: ${failed}/${allResults.length}`)
  console.log(``)
  console.log(`⏱️  Phase 1 (Uploads): ${uploadTime}s`)
  console.log(`⏱️  Average Crop Time: ${avgCropTime}s`)
  console.log(`⏱️  Average Search Time: ${avgSearchTime}s`)
  console.log(``)
  console.log(`⏱️  Total Time: ${totalTime}s (${(totalTime / 60).toFixed(2)} minutes)`)
  console.log(`⚡ Time saved on uploads: ~${(tasks.length * 1.5 - parseFloat(uploadTime)).toFixed(0)}s`)
  
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

