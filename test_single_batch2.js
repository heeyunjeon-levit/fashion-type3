const fs = require('fs');
const path = require('path');

// Configuration
const BATCH2_DIR = '/Users/levit/Desktop/batch2';
const API_BASE = 'http://localhost:3000/api';
const BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run';

// Category mapping (Korean to English)
const CATEGORY_MAP = {
  '상의': 'tops',
  '하의': 'bottoms',
  '신발': 'shoes',
  '가방': 'bags',
  '악세사리': 'accessories'
};

// Pick first image from CSV
const TEST_IMAGE = '0173bf6501b1-IMG_6324.png';
const TEST_CATEGORIES_KR = ['상의']; // tops in Korean
const TEST_CATEGORIES = TEST_CATEGORIES_KR.map(cat => CATEGORY_MAP[cat] || cat); // Translate to English

async function testSingleImage() {
  console.log('\n🧪 Testing Single Image from Batch2\n');
  console.log('='.repeat(80));
  
  const imagePath = path.join(BATCH2_DIR, TEST_IMAGE);
  
  // Check if image exists
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image not found: ${imagePath}`);
    return;
  }
  
  console.log(`📸 Image: ${TEST_IMAGE}`);
  console.log(`📋 Categories (Korean): ${TEST_CATEGORIES_KR.join(', ')}`);
  console.log(`📋 Categories (English): ${TEST_CATEGORIES.join(', ')}`);
  console.log('');
  
  try {
    // Step 1: Upload image to Supabase
    console.log('📤 Step 1: Uploading to Supabase...');
    const uploadStart = Date.now();
    
    const imageBuffer = fs.readFileSync(imagePath);
    const uploadFormData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    uploadFormData.append('file', blob, TEST_IMAGE);
    
    const uploadRes = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: uploadFormData
    });
    
    if (!uploadRes.ok) {
      throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
    }
    
    const uploadData = await uploadRes.json();
    const imageUrl = uploadData.url || uploadData.imageUrl;
    const uploadTime = ((Date.now() - uploadStart) / 1000).toFixed(2);
    
    if (!imageUrl) {
      console.error('Upload response:', uploadData);
      throw new Error('No image URL in upload response');
    }
    
    console.log(`✅ Uploaded in ${uploadTime}s`);
    console.log(`   URL: ${imageUrl.substring(0, 80)}...`);
    console.log('');
    
    // Step 2: Crop items
    console.log('✂️  Step 2: Cropping items with GroundingDINO...');
    const cropStart = Date.now();
    
    const cropRes = await fetch(`${BACKEND_URL}/crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: imageUrl,
        categories: TEST_CATEGORIES
      })
    });
    
    if (!cropRes.ok) {
      const errorText = await cropRes.text();
      throw new Error(`Crop failed: ${cropRes.status} ${errorText}`);
    }
    
    const cropData = await cropRes.json();
    const cropTime = ((Date.now() - cropStart) / 1000).toFixed(2);
    
    console.log(`✅ Cropped in ${cropTime}s`);
    console.log('   Full crop response:', JSON.stringify(cropData, null, 2));
    
    // Build cropped images object (matching batch_test_batch2.js logic)
    const crops = {};
    if (cropData.croppedImageUrl) {
      // Single URL - map to first category
      crops[TEST_CATEGORIES[0]] = cropData.croppedImageUrl;
      console.log(`   ✅ Mapped single crop to category: ${TEST_CATEGORIES[0]}`);
    } else if (cropData.croppedImageUrls) {
      // Multiple URLs - map to categories in order
      cropData.croppedImageUrls.forEach((url, idx) => {
        const category = TEST_CATEGORIES[idx] || `item${idx + 1}`;
        crops[category] = url;
      });
    }
    console.log(`   Items detected: ${Object.keys(crops).length}`);
    
    // Show detected items
    if (Object.keys(crops).length > 0) {
      for (const [category, cropUrl] of Object.entries(crops)) {
        console.log(`   - ${category}: ${cropUrl.substring(0, 70)}...`);
      }
    } else {
      console.log('   ⚠️  No items detected - checking if it\'s the category translation issue');
    }
    console.log('');
    
    // Step 3: Search for products
    console.log('🔍 Step 3: Searching for products...');
    const searchStart = Date.now();
    
    const searchRes = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: imageUrl,
        categories: TEST_CATEGORIES,
        croppedImages: crops  // Use the crops object we built earlier!
      })
    });
    
    if (!searchRes.ok) {
      const errorText = await searchRes.text();
      throw new Error(`Search failed: ${searchRes.status} ${errorText}`);
    }
    
    const searchData = await searchRes.json();
    const searchTime = ((Date.now() - searchStart) / 1000).toFixed(2);
    
    console.log(`✅ Search completed in ${searchTime}s`);
    
    // Show search results
    if (searchData.results) {
      for (const [category, links] of Object.entries(searchData.results)) {
        console.log(`\n📦 ${category}:`);
        if (Array.isArray(links)) {
          links.forEach((link, i) => {
            console.log(`   ${i + 1}. ${link.link}`);
            if (link.thumbnailUrl) {
              console.log(`      🖼️  ${link.thumbnailUrl.substring(0, 60)}...`);
            }
          });
        }
      }
    }
    
    // Show source statistics
    if (searchData.meta?.sourceCounts) {
      const { gpt, fallback, none, error } = searchData.meta.sourceCounts;
      console.log(`\n📈 Result Sources:`);
      console.log(`   GPT Selected: ${gpt}`);
      console.log(`   Fallback Used: ${fallback}`);
      console.log(`   No Results: ${none}`);
      console.log(`   Errors: ${error}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Test Complete!');
    console.log(`⏱️  Total time: ${((Date.now() - uploadStart) / 1000).toFixed(2)}s`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testSingleImage().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

