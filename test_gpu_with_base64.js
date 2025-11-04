const fs = require('fs');

// Create a small test image (1x1 red pixel PNG)
const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

console.log('🧪 Testing GPU backend with base64 (small 1x1 pixel test)...\n');

const GPU_URL = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run';

const test = async () => {
  try {
    const startTime = Date.now();
    const response = await fetch(`${GPU_URL}/crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Image,
        categories: ['tops'],
        count: 1
      })
    });
    
    const data = await response.json();
    const endTime = Date.now();
    
    console.log(`✅ Response received in ${((endTime - startTime) / 1000).toFixed(2)}s`);
    console.log('📥 Data:', JSON.stringify(data, null, 2));
    
    if (data.croppedImageUrl) {
      console.log('\n🎉 GPU backend processed base64 successfully!');
    } else {
      console.log('\n⚠️  GPU backend returned null (check logs for errors)');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

test();

