/**
 * Quick GPU Backend Test
 * Tests if the deployed GPU backend is working
 */

const fetch = require('node-fetch');

const GPU_URL = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run';
const TEST_IMAGE = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/4aaa14222152-Screenshot_20250922_183517.jpg';

async function quickTest() {
  console.log('🧪 Quick GPU Backend Test\n');
  
  // Test 1: Health check
  console.log('1️⃣  Testing health endpoint...');
  try {
    const healthResponse = await fetch(GPU_URL);
    const health = await healthResponse.json();
    console.log(`   ✅ Status: ${health.status}`);
    console.log(`   ✅ Cropper: ${health.cropper_available ? 'Available' : 'Not Available'}`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
    return;
  }
  
  // Test 2: Crop single image
  console.log('\n2️⃣  Testing crop endpoint...');
  console.log(`   Image: ${TEST_IMAGE}`);
  console.log(`   Categories: tops, bottoms`);
  
  const startTime = Date.now();
  
  try {
    const cropResponse = await fetch(`${GPU_URL}/crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: TEST_IMAGE,
        categories: ['tops', 'bottoms']
      })
    });
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!cropResponse.ok) {
      const errorText = await cropResponse.text();
      console.log(`   ❌ Crop failed: ${cropResponse.status}`);
      console.log(`   Error: ${errorText}`);
      return;
    }
    
    const result = await cropResponse.json();
    console.log(`   ✅ Completed in ${elapsedTime}s`);
    
    if (result.croppedImageUrl) {
      console.log(`   ✅ Got 1 crop`);
    } else if (result.croppedImageUrls) {
      console.log(`   ✅ Got ${result.croppedImageUrls.length} crops`);
    } else {
      console.log(`   ⚠️  No crops (fallback to original)`);
    }
    
    // Performance check
    console.log('\n📊 Performance Analysis:');
    if (parseFloat(elapsedTime) < 20) {
      console.log(`   🚀 EXCELLENT! (${elapsedTime}s) - GPU is working!`);
    } else if (parseFloat(elapsedTime) < 35) {
      console.log(`   ⚠️  GOOD (${elapsedTime}s) - Might be CPU or cold start`);
    } else {
      console.log(`   ❌ SLOW (${elapsedTime}s) - Likely CPU mode`);
    }
    
    console.log('\n✅ All tests passed!');
    console.log('\n🎉 Your GPU backend is ready to use!');
    console.log('   Update your Next.js frontend to use this URL:');
    console.log(`   ${GPU_URL}`);
    
  } catch (error) {
    console.log(`   ❌ Crop request failed: ${error.message}`);
  }
}

quickTest();

