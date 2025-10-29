// Quick test to see Serper duplicate rates
const FormData = require('form-data');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PHOTO_DIR = '/Users/levit/Desktop/photos';
const TEST_IMAGE = '008ae8fd9128-IMG_7570.jpeg'; // First successful image from batch
const CATEGORY = 'tops';

async function uploadImage(imagePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));
  
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/upload',
      method: 'POST',
      headers: form.getHeaders()
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data).imageUrl);
        } else {
          reject(new Error(`Upload failed: ${data}`));
        }
      });
    });
    req.on('error', reject);
    form.pipe(req);
  });
}

async function cropImage(imageUrl, category) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      imageUrl,
      categories: [category],
      count: 1
    });
    
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8000,
      path: '/crop',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 180000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const json = JSON.parse(data);
          resolve(json.croppedImageUrl || (json.croppedImageUrls && json.croppedImageUrls[0]));
        } else {
          reject(new Error(`Crop failed: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Crop timeout'));
    });
    req.write(payload);
    req.end();
  });
}

async function searchImage(croppedImageUrl, originalImageUrl, category) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      categories: [category],
      croppedImages: { [category]: croppedImageUrl },
      originalImageUrl
    });
    
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Search failed: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('🧪 Testing Serper duplicate rates with single image...\n');
  
  const imagePath = path.join(PHOTO_DIR, TEST_IMAGE);
  console.log(`📸 Image: ${TEST_IMAGE}`);
  console.log(`📦 Category: ${CATEGORY}\n`);
  
  try {
    console.log('1️⃣ Uploading image...');
    const originalUrl = await uploadImage(imagePath);
    console.log(`✅ Uploaded: ${originalUrl.substring(0, 60)}...\n`);
    
    console.log('2️⃣ Cropping image...');
    const croppedUrl = await cropImage(originalUrl, CATEGORY);
    console.log(`✅ Cropped: ${croppedUrl.substring(0, 60)}...\n`);
    
    console.log('3️⃣ Running Serper search (3 runs)...');
    console.log('   Check the Next.js server logs for duplicate rate!\n');
    const results = await searchImage(croppedUrl, originalUrl, CATEGORY);
    
    console.log('✅ Search complete!');
    const actualResults = results.results || results;
    console.log(`📊 Results: ${actualResults[CATEGORY]?.length || 0} products found\n`);
    console.log('📦 Full results:');
    console.log(JSON.stringify(results, null, 2));
    console.log('\n🔍 Check the Next.js server terminal for the duplicate rate log line:');
    console.log('   Look for: "📊 Cropped image search: X total → Y unique (Z% duplicates)"\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();

