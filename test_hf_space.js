#!/usr/bin/env node
/**
 * Test Hugging Face Space crop endpoint
 */
const https = require('https');
const fs = require('fs');
const FormData = require('form-data');

// Configuration
const NEXT_BASE = process.env.NEXT_BASE || 'http://localhost:3000';
const HF_SPACE_URL = 'https://naenahjeon-fashion-crop-api.hf.space';
const TEST_IMAGE = '/Users/levit/Desktop/photos/008ae8fd9128-IMG_7570.jpeg';

async function uploadImage() {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('image', fs.createReadStream(TEST_IMAGE));

    const url = new URL(`${NEXT_BASE}/api/upload`);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: form.getHeaders(),
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.imageUrl) {
            resolve(json.imageUrl);
          } else {
            reject(new Error('No imageUrl in response: ' + data));
          }
        } catch (e) {
          reject(new Error('Invalid JSON: ' + data));
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

async function testCrop(imageUrl) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      imageUrl: imageUrl,
      categories: ['top'],
      count: 1
    });

    const url = new URL(`${HF_SPACE_URL}/crop`);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('🧪 Testing Hugging Face Space...\n');
  
  // Step 1: Check health
  console.log('1️⃣ Checking Space health...');
  try {
    const healthUrl = new URL(`${HF_SPACE_URL}/`);
    const healthResponse = await new Promise((resolve, reject) => {
      https.get(healthUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    console.log('✅ Health check:', JSON.stringify(healthResponse, null, 2));
  } catch (e) {
    console.log('❌ Health check failed:', e.message);
  }

  // Step 2: Upload image
  console.log('\n2️⃣ Uploading test image...');
  let imageUrl;
  try {
    imageUrl = await uploadImage();
    console.log('✅ Image uploaded:', imageUrl);
  } catch (e) {
    console.log('❌ Upload failed:', e.message);
    console.log('⚠️  Make sure Next.js dev server is running on', NEXT_BASE);
    return;
  }

  // Step 3: Test crop
  console.log('\n3️⃣ Testing crop endpoint...');
  console.log('⏳ This may take 30-60s (first request includes model download)...');
  const startTime = Date.now();
  try {
    const result = await testCrop(imageUrl);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Crop completed in ${duration}s`);
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.croppedImageUrl) {
      console.log('\n🎉 SUCCESS! Cropped image URL:', result.croppedImageUrl);
    } else {
      console.log('\n⚠️  No cropped image URL in response');
    }
  } catch (e) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`❌ Crop failed after ${duration}s:`, e.message);
    console.log('Stack:', e.stack);
  }
}

main().catch(console.error);

