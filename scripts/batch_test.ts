import fs from 'fs'
import path from 'path'

// Define test cases
interface TestCase {
  name?: string  // Optional: will be auto-generated from filename if not provided
  imageUrl?: string  // Optional: for remote images
  imagePath?: string // Optional: for local images (relative to project root)
  categories: string[] // e.g., ['tops', 'bottoms', 'shoes']
}

const testCases: TestCase[] = [
  {
    name: 'Light gray ribbed shirt',
    imageUrl: 'https://i.ibb.co/9FTjvrf/d37dda80ed7d.jpg',
    categories: ['tops']
  },
  // Add more test cases here
  // {
  //   imagePath: 'test_images/outfit1.jpg',
  //   categories: ['tops', 'bottoms']
  // },
]

async function uploadLocalImage(imagePath: string): Promise<string> {
  console.log(`📤 Uploading local image: ${imagePath}`)
  
  // Read the file
  const fullPath = path.join(process.cwd(), imagePath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Image file not found: ${fullPath}`)
  }
  
  const fileBuffer = fs.readFileSync(fullPath)
  const base64 = fileBuffer.toString('base64')
  
  // Upload to imgbb
  const imgbbFormData = new FormData()
  imgbbFormData.append('image', base64)
  imgbbFormData.append('key', process.env.IMGBB_API_KEY || '')
  
  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: imgbbFormData,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Imgbb upload failed: ${errorText}`)
  }
  
  const data = await response.json()
  console.log(`✅ Uploaded to: ${data.data.url}`)
  
  return data.data.url
}

async function uploadImage(testCase: TestCase): Promise<string> {
  // If imageUrl is provided, use it directly
  if (testCase.imageUrl) {
    console.log(`📤 Using remote image: ${testCase.imageUrl}`)
    return testCase.imageUrl
  }
  
  // If imagePath is provided, upload the local image
  if (testCase.imagePath) {
    return await uploadLocalImage(testCase.imagePath)
  }
  
  throw new Error('Either imageUrl or imagePath must be provided')
}

async function cropImages(imageUrl: string, categories: string[]): Promise<Record<string, string>> {
  console.log(`🔄 Cropping for categories: ${categories.join(', ')}`)
  
  const PYTHON_BACKEND_URL = process.env.PYTHON_CROPPER_URL || 'http://localhost:8000'
  
  // Crop each category separately (Python backend processes one at a time)
  const croppedImages: Record<string, string> = {}
  
  for (const category of categories) {
    console.log(`   📸 Cropping ${category}...`)
    const response = await fetch(`${PYTHON_BACKEND_URL}/crop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl,
        categories: [category],
      }),
    })
    
    if (!response.ok) {
      console.error(`   ⚠️ Cropping failed for ${category}: ${response.statusText}`)
      // Continue with other categories even if one fails
      continue
    }
    
    const data = await response.json()
    if (data.croppedImageUrl) {
      croppedImages[category] = data.croppedImageUrl
      console.log(`   ✅ ${category} cropped: ${data.croppedImageUrl.substring(0, 50)}...`)
    }
  }
  
  return croppedImages
}

async function searchProducts(
  categories: string[],
  croppedImages: Record<string, string>,
  originalImageUrl: string
): Promise<Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>>> {
  console.log(`🔍 Searching for: ${categories.join(', ')}`)
  
  const response = await fetch('http://localhost:3000/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      categories,
      croppedImages,
      originalImageUrl,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.results || {}
}

async function runTest(testCase: TestCase): Promise<any> {
  // Auto-generate name from filename if not provided
  const testName = testCase.name || (() => {
    if (testCase.imagePath) {
      const filename = path.basename(testCase.imagePath, path.extname(testCase.imagePath))
      return filename
    }
    if (testCase.imageUrl) {
      const filename = testCase.imageUrl.split('/').pop() || 'unknown'
      return filename.split('.')[0]
    }
    return 'unknown'
  })()
  
  console.log(`\n🚀 Testing: ${testName}`)
  console.log(`   Image: ${testCase.imageUrl || testCase.imagePath}`)
  console.log(`   Categories: ${testCase.categories.join(', ')}`)
  
  const startTime = Date.now()
  
  try {
    // Step 1: Upload image (or use existing URL)
    const uploadedImageUrl = await uploadImage(testCase)
    
    // Step 2: Crop images for each category
    const croppedImages = await cropImages(uploadedImageUrl, testCase.categories)
    console.log(`   ✅ Cropped ${Object.keys(croppedImages).length} images`)
    
    // Step 3: Search for products
    const searchResults = await searchProducts(
      testCase.categories,
      croppedImages,
      uploadedImageUrl
    )
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    // Calculate results summary
    const resultsSummary = Object.entries(searchResults).map(([category, results]: [string, any]) => ({
      category,
      resultCount: results?.length || 0,
      links: results?.map((r: any) => r.link) || []
    }))
    
    console.log(`   ✅ Completed in ${duration}s`)
    console.log(`   📊 Results: ${resultsSummary.map(r => `${r.category}: ${r.resultCount} links`).join(', ')}`)
    
    return {
      testCase: testName,
      categories: testCase.categories,
      imageUrl: testCase.imageUrl,
      imagePath: testCase.imagePath,
      uploadedImageUrl: uploadedImageUrl,
      duration: parseFloat(duration),
      croppedImages,
      results: searchResults,
      resultsSummary,
      success: true,
      error: null
    }
  } catch (error) {
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`)
    
    return {
      testCase: testName,
      categories: testCase.categories,
      imageUrl: testCase.imageUrl,
      imagePath: testCase.imagePath,
      duration: parseFloat(duration),
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function runBatchTests() {
  console.log('🎯 Starting Batch Testing\n')
  console.log(`📋 Total test cases: ${testCases.length}`)
  
  const concurrencyLimit = 2 // Process 2 tests at a time to avoid overwhelming the server
  const results = []
  
  for (let i = 0; i < testCases.length; i += concurrencyLimit) {
    const batch = testCases.slice(i, i + concurrencyLimit)
    console.log(`\n📦 Processing batch ${Math.floor(i / concurrencyLimit) + 1}/${Math.ceil(testCases.length / concurrencyLimit)}`)
    
    const batchResults = await Promise.all(batch.map(testCase => runTest(testCase)))
    results.push(...batchResults)
  }
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = path.join(__dirname, '..', 'batch_test_results', `results-${timestamp}.json`)
  
  // Create directory if it doesn't exist
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Save results
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: testCases.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    results
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2))
  
  console.log('\n📊 Final Summary')
  console.log('================')
  console.log(`✅ Successful: ${summary.successful}/${summary.totalTests}`)
  console.log(`❌ Failed: ${summary.failed}/${summary.totalTests}`)
  console.log(`⏱️  Average duration: ${summary.averageDuration.toFixed(2)}s`)
  console.log(`\n📁 Results saved to: ${outputPath}`)
  
  // Print detailed results
  console.log('\n📋 Detailed Results')
  console.log('===================')
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.testCase}`)
    console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`)
    console.log(`   Duration: ${result.duration}s`)
    if (result.success && result.resultsSummary) {
      result.resultsSummary.forEach((summary: any) => {
        console.log(`   ${summary.category}: ${summary.resultCount} links`)
        summary.links.slice(0, 1).forEach((link: string) => {
          console.log(`      - ${link.substring(0, 80)}...`)
        })
      })
    } else if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  })
}

// Run the batch tests
runBatchTests().catch(console.error)

