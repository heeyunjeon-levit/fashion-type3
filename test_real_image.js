/**
 * Test Modal backend with a real image from /Users/levit/Desktop/photos
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const FormData = require('form-data');

const NEXT_BASE = 'http://127.0.0.1:3000';
const MODAL_URL = 'https://heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run';
const TEST_IMAGE = '/Users/levit/Desktop/photos/008ae8fd9128-IMG_7570.jpeg';

console.log('\n🧪 Testing Modal Backend with Real Image\n');
console.log('============================================================\n');

// Step 1: Upload image to Supabase via Next.js upload endpoint
function uploadImage() {
  return new Promise((resolve, reject) => {
    console.log('📤 Step 1: Uploading image to Supabase...');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(TEST_IMAGE));

    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/upload',
      method: 'POST',
      headers: form.getHeaders(),
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const imageUrl = json.url || json.imageUrl;
          if (imageUrl) {
            console.log(`✅ Image uploaded: ${imageUrl}\n`);
            resolve(imageUrl);
          } else {
            console.log('❌ Response:', JSON.stringify(json, null, 2));
            reject(new Error('No URL in upload response'));
          }
        } catch (e) {
          console.log('❌ Failed to parse response:', body);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

// Step 2: Test crop endpoint with uploaded image
function testCrop(imageUrl) {
  return new Promise((resolve, reject) => {
    console.log('✂️  Step 2: Testing crop with real image...');
    console.log('⏳ This will take 30-60 seconds on first run (loading models)...\n');
    
    const data = JSON.stringify({
      imageUrl: imageUrl,
      categories: ['tops'],
      count: 2
    });

    const options = {
      hostname: 'heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run',
      path: '/crop',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 120000 // 2 minutes
    };

    const startTime = Date.now();
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⏱️  Request completed in ${duration}s`);
        console.log(`✅ Status: ${res.statusCode}\n`);
        
        try {
          const json = JSON.parse(body);
          console.log('📊 Response:');
          console.log(JSON.stringify(json, null, 2));
          
          // Check if we got real cropped URLs or placeholders
          if (json.croppedImageUrls && json.croppedImageUrls.length > 0) {
            console.log('\n🎉 SUCCESS! Got cropped images:');
            json.croppedImageUrls.forEach((url, i) => {
              console.log(`  ${i + 1}. ${url}`);
            });
          } else if (json.croppedImageUrl) {
            if (json.croppedImageUrl.includes('placeholder')) {
              console.log('\n⚠️  Got placeholder URL - may be in mock mode');
            } else {
              console.log('\n🎉 SUCCESS! Got cropped image:');
              console.log(`  ${json.croppedImageUrl}`);
            }
          } else {
            console.log('\n⚠️  No cropped images in response');
          }
          
          resolve(json);
        } catch (e) {
          console.log(`📄 Raw response: ${body}`);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 2 minutes'));
    });
    
    req.write(data);
    req.end();
  });
}

// Run the test
async function runTest() {
  try {
    // Check if Next.js dev server is running
    console.log('🔍 Checking if Next.js dev server is running...');
    const checkServer = http.get('http://127.0.0.1:3000', (res) => {
      console.log('✅ Next.js dev server is running\n');
    });
    checkServer.on('error', () => {
      console.log('❌ Next.js dev server not running!');
      console.log('   Please run: npm run dev\n');
      process.exit(1);
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const imageUrl = await uploadImage();
    const result = await testCrop(imageUrl);
    
    console.log('\n============================================================');
    console.log('✅ Backend test complete!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();

