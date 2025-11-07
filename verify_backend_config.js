/**
 * Verify Backend Configuration
 * 
 * This script checks:
 * 1. Local .env file
 * 2. GPU backend health
 * 3. Deployed frontend (if URL provided)
 */

const fs = require('fs');
const path = require('path');

const GPU_BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run';
const CPU_BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run';

async function checkLocalEnv() {
  console.log('📁 Step 1: Checking Local .env File');
  console.log('━'.repeat(60));
  
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/NEXT_PUBLIC_PYTHON_CROPPER_URL=(.+)/);
  
  if (!match) {
    console.log('⚠️  NEXT_PUBLIC_PYTHON_CROPPER_URL not found in .env');
    return false;
  }
  
  const url = match[1].trim();
  console.log(`📌 Current URL: ${url}`);
  
  if (url === GPU_BACKEND_URL) {
    console.log('✅ Local .env is correctly set to GPU backend');
    return true;
  } else if (url === CPU_BACKEND_URL) {
    console.log('⚠️  Local .env is still pointing to CPU backend');
    console.log(`   Update to: ${GPU_BACKEND_URL}`);
    return false;
  } else {
    console.log('⚠️  Local .env is pointing to unknown backend');
    return false;
  }
}

async function checkGPUBackendHealth() {
  console.log('\n🏥 Step 2: Checking GPU Backend Health');
  console.log('━'.repeat(60));
  
  try {
    const fetch = require('node-fetch');
    const response = await fetch(GPU_BACKEND_URL + '/', { timeout: 10000 });
    
    if (!response.ok) {
      console.log(`❌ GPU backend returned status: ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    console.log('📊 Backend Response:', JSON.stringify(data, null, 2));
    
    if (data.status === 'online' && data.cropper_available === true) {
      console.log('✅ GPU backend is healthy and ready');
      return true;
    } else {
      console.log('⚠️  GPU backend responded but cropper not available');
      console.log('   Check Modal logs: modal app logs fashion-crop-api-gpu');
      return false;
    }
  } catch (error) {
    console.log(`❌ Failed to reach GPU backend: ${error.message}`);
    return false;
  }
}

async function checkDeployedFrontend(deployedUrl) {
  console.log('\n🌐 Step 3: Checking Deployed Frontend');
  console.log('━'.repeat(60));
  
  if (!deployedUrl) {
    console.log('ℹ️  No deployed URL provided, skipping this check');
    console.log('   To check: node verify_backend_config.js YOUR_VERCEL_URL');
    return null;
  }
  
  try {
    const fetch = require('node-fetch');
    
    // Try to fetch the main page and check if it loads
    console.log(`📡 Checking: ${deployedUrl}`);
    const response = await fetch(deployedUrl, { timeout: 10000 });
    
    if (!response.ok) {
      console.log(`❌ Frontend returned status: ${response.status}`);
      return false;
    }
    
    const html = await response.text();
    
    // Check if the page contains our app
    if (html.includes('Next.js') || html.includes('React')) {
      console.log('✅ Frontend is deployed and responding');
      console.log('');
      console.log('⚠️  Note: We cannot check the actual env variable from here.');
      console.log('   You need to test it by uploading an image and checking:');
      console.log('   1. Open browser DevTools (F12)');
      console.log('   2. Go to Console tab');
      console.log('   3. Upload an image');
      console.log('   4. Look for: "🔗 Using backend: ..."');
      console.log('');
      console.log(`   Expected: ${GPU_BACKEND_URL}`);
      return true;
    } else {
      console.log('⚠️  Frontend responded but content looks unexpected');
      return false;
    }
  } catch (error) {
    console.log(`❌ Failed to reach frontend: ${error.message}`);
    return false;
  }
}

async function testGPUBackendCrop() {
  console.log('\n🧪 Step 4: Testing GPU Backend Crop (Quick Test)');
  console.log('━'.repeat(60));
  
  const testImageUrl = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/batch_test_1762364271164_2701146d3bd8-Screenshot_20250922_180545_NAVER.jpg';
  
  try {
    const fetch = require('node-fetch');
    console.log('📸 Sending test crop request...');
    console.log('   Image: 2701146d3bd8-Screenshot_20250922_180545_NAVER.jpg');
    console.log('   Category: tops');
    
    const startTime = Date.now();
    const response = await fetch(GPU_BACKEND_URL + '/crop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: testImageUrl,
        categories: ['tops']
      }),
      timeout: 60000  // 60 second timeout
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!response.ok) {
      console.log(`❌ Crop request failed: ${response.status}`);
      const text = await response.text();
      console.log(text.substring(0, 200));
      return false;
    }
    
    const data = await response.json();
    
    if (data.croppedImageUrls || data.croppedImageUrl) {
      console.log(`✅ GPU backend crop successful in ${elapsed}s`);
      console.log(`   Performance: ${elapsed < 15 ? '🚀 Fast!' : elapsed < 30 ? '✓ Good' : '⚠️  Slower than expected'}`);
      return true;
    } else {
      console.log(`⚠️  Crop completed but no crops returned (${elapsed}s)`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Crop test failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 BACKEND CONFIGURATION VERIFICATION');
  console.log('═'.repeat(60));
  console.log('');
  
  const deployedUrl = process.argv[2];
  
  const results = {
    localEnv: await checkLocalEnv(),
    gpuHealth: await checkGPUBackendHealth(),
    deployedFrontend: await checkDeployedFrontend(deployedUrl),
    gpuCropTest: await testGPUBackendCrop()
  };
  
  // Summary
  console.log('\n📊 VERIFICATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Local .env file:        ${results.localEnv ? '✅ GPU' : '❌ Not GPU'}`);
  console.log(`GPU backend health:     ${results.gpuHealth ? '✅ Healthy' : '❌ Issues'}`);
  console.log(`GPU crop test:          ${results.gpuCropTest ? '✅ Working' : '❌ Failed'}`);
  console.log(`Deployed frontend:      ${results.deployedFrontend === null ? 'ℹ️  Not checked' : results.deployedFrontend ? '✅ Online' : '❌ Issues'}`);
  
  console.log('\n' + '═'.repeat(60));
  
  if (results.localEnv && results.gpuHealth && results.gpuCropTest) {
    console.log('✅ ALL LOCAL CHECKS PASSED!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Update Vercel environment variable:');
    console.log('      Go to: https://vercel.com/dashboard');
    console.log('      Settings → Environment Variables');
    console.log(`      Set: ${GPU_BACKEND_URL}`);
    console.log('');
    console.log('   2. Redeploy your frontend');
    console.log('');
    console.log('   3. Test deployed site:');
    console.log('      a. Upload an image');
    console.log('      b. Open DevTools Console (F12)');
    console.log('      c. Check for GPU backend URL in logs');
    console.log('      d. Verify crop time is 7-15 seconds');
  } else {
    console.log('⚠️  SOME CHECKS FAILED');
    console.log('');
    console.log('📋 Troubleshooting:');
    if (!results.localEnv) {
      console.log('   - Update .env file with GPU backend URL');
    }
    if (!results.gpuHealth) {
      console.log('   - Check Modal deployment: modal app logs fashion-crop-api-gpu');
      console.log('   - Verify Modal secrets are set');
    }
    if (!results.gpuCropTest) {
      console.log('   - GPU backend may need redeployment');
      console.log('   - Check Modal logs for errors');
    }
  }
  
  console.log('═'.repeat(60));
}

main().catch(console.error);

