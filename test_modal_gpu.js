/**
 * Test script for GPU-enabled Modal backend
 * Tests the new HuggingFace transformers GroundingDINO
 */

const fetch = require('node-fetch');

// Configuration
const GPU_BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run';
const TEST_IMAGE_URL = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/4aaa14222152-Screenshot_20250922_183517.jpg';
const TEST_CATEGORIES = ['tops', 'bottoms'];

async function testGPUBackend() {
  console.log('🧪 Testing GPU-enabled Modal backend\n');
  console.log(`📍 Backend URL: ${GPU_BACKEND_URL}`);
  console.log(`🖼️  Test image: ${TEST_IMAGE_URL}`);
  console.log(`📋 Categories: ${TEST_CATEGORIES.join(', ')}\n`);
  
  try {
    console.log('⏱️  Starting crop request...');
    const startTime = Date.now();
    
    const response = await fetch(`${GPU_BACKEND_URL}/crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: TEST_IMAGE_URL,
        categories: TEST_CATEGORIES
      })
    });
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Request failed: ${response.status}`);
      console.error(errorText);
      return;
    }
    
    const result = await response.json();
    console.log(`✅ Request completed in ${elapsedTime}s\n`);
    
    console.log('📊 Result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check for crops
    if (result.croppedImageUrl) {
      console.log('\n✅ Single crop generated:');
      console.log(`   ${result.croppedImageUrl}`);
    } else if (result.croppedImageUrls && result.croppedImageUrls.length > 0) {
      console.log(`\n✅ ${result.croppedImageUrls.length} crops generated:`);
      result.croppedImageUrls.forEach((url, idx) => {
        console.log(`   [${idx + 1}] ${url}`);
      });
    } else {
      console.log('\n⚠️  No crops generated (fallback to original)');
    }
    
    // Performance summary
    console.log('\n📈 Performance Summary:');
    console.log(`   Total time: ${elapsedTime}s`);
    console.log(`   Expected time: ~10-15s (GPU) vs ~40-50s (CPU)`);
    
    if (parseFloat(elapsedTime) < 20) {
      console.log('   🚀 EXCELLENT! GPU is working!');
    } else if (parseFloat(elapsedTime) < 35) {
      console.log('   ⚠️  GOOD, but might be using CPU');
    } else {
      console.log('   ❌ SLOW - likely using CPU or first run (cold start)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run test
testGPUBackend();

