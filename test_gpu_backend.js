const https = require('https');

const GPU_URL = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run';

// Test image URL (from your Supabase)
const TEST_IMAGE = 'https://lbiljokkdlrhlsmepojq.supabase.co/storage/v1/object/public/images/1730614994992-8c97f19c-1edc-4e2d-bb87-ebcbdee1c869.jpg';

console.log('🧪 Testing GPU Backend...');
console.log(`🔗 GPU URL: ${GPU_URL}`);
console.log(`🖼️  Test Image: ${TEST_IMAGE}`);
console.log('\n⏳ Sending crop request (this may take 20-30s for cold start)...\n');

const startTime = Date.now();

const postData = JSON.stringify({
  imageUrl: TEST_IMAGE,
  categories: ['tops'],
  count: 1
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(`${GPU_URL}/crop`, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Response received in ${elapsed}s`);
    console.log(`📊 Status: ${res.statusCode}`);
    
    try {
      const result = JSON.parse(data);
      console.log('\n📦 Result:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.cropped_images && result.cropped_images.length > 0) {
        console.log(`\n🎉 SUCCESS! Cropped ${result.cropped_images.length} image(s)`);
        console.log(`🖼️  Cropped URL: ${result.cropped_images[0]}`);
      } else {
        console.log('\n⚠️  No cropped images returned');
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

// Set timeout to 2 minutes
req.setTimeout(120000, () => {
  console.error('❌ Request timed out after 2 minutes');
  req.destroy();
});

req.write(postData);
req.end();

