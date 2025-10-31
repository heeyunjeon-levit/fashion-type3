#!/usr/bin/env node
/**
 * Test the Roboflow backend directly
 */

const https = require('https');

const BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-roboflow-v2-fastapi-app.modal.run';
const TEST_IMAGE_URL = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1761889706940_blob.jpg';

console.log('🧪 Testing Roboflow Backend...\n');
console.log('Backend:', BACKEND_URL);
console.log('Test Image:', TEST_IMAGE_URL);
console.log('\n' + '='.repeat(60) + '\n');

// Test 1: Health check
console.log('1️⃣ Health Check...');
https.get(BACKEND_URL + '/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', JSON.parse(data));
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 2: Crop request
    console.log('2️⃣ Crop Request...');
    const payload = JSON.stringify({
      imageUrl: TEST_IMAGE_URL,
      categories: ['bottoms'],
      count: 1
    });
    
    const options = {
      hostname: 'heeyunjeon-levit--fashion-crop-roboflow-fastapi-app.modal.run',
      path: '/crop',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2));
          
          // Check if it's the original URL (failed crop)
          if (json.croppedImageUrl === TEST_IMAGE_URL) {
            console.log('\n❌ FAILED: Returned original URL (crop failed)');
          } else {
            console.log('\n✅ SUCCESS: Returned cropped URL');
          }
        } catch (e) {
          console.log('Raw Response:', data);
          console.log('Error parsing JSON:', e.message);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('❌ Request failed:', e.message);
    });
    
    req.write(payload);
    req.end();
  });
}).on('error', (e) => {
  console.error('❌ Health check failed:', e.message);
});

