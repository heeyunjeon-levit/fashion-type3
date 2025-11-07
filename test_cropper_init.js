const fetch = require('node-fetch');

async function testCropperInit() {
  console.log('🔍 Testing cropper initialization...\n');
  
  // Hit the root endpoint multiple times to trigger initialization
  for (let i = 0; i < 3; i++) {
    console.log(`Attempt ${i + 1}/3...`);
    const response = await fetch('https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/');
    const result = await response.json();
    console.log(`  cropper_available: ${result.cropper_available}`);
    
    if (result.cropper_available) {
      console.log('\n✅ Cropper is available!');
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n❌ Cropper still not available after 3 attempts');
  console.log('\nThis suggests the cropper initialization is failing.');
  console.log('Possible causes:');
  console.log('  1. Missing dependencies in Modal image');
  console.log('  2. Import errors (class names, file paths)');
  console.log('  3. API key not available (OPENAI_API_KEY)');
  console.log('  4. Model download failing');
}

testCropperInit();

