/**
 * Test the parallelization optimization
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const FormData = require('form-data');

const TEST_IMAGE = '/Users/levit/Desktop/photos/008ae8fd9128-IMG_7570.jpeg';

console.log('\n🧪 Testing Parallelization Optimization\n');
console.log('This will test the new parallelized search vs the old sequential approach\n');
console.log('============================================================\n');

async function uploadImage() {
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
            console.log(`✅ Image uploaded\n`);
            resolve(imageUrl);
          } else {
            reject(new Error('No URL in upload response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

async function cropImage(imageUrl) {
  return new Promise((resolve, reject) => {
    console.log('✂️  Step 2: Cropping image (this takes 15-90s)...');
    
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
      timeout: 120000
    };

    const startTime = Date.now();
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Cropping completed in ${duration}s\n`);
        
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    req.write(data);
    req.end();
  });
}

async function searchProducts(imageUrl, croppedResult) {
  return new Promise((resolve, reject) => {
    console.log('🔍 Step 3: Searching products (NOW PARALLELIZED)...');
    console.log('   This step was 40s, now should be ~10-15s for 2 items!\n');
    
    const croppedImages = {};
    if (croppedResult.croppedImageUrls) {
      croppedResult.croppedImageUrls.forEach((url, i) => {
        const key = i === 0 ? 'tops' : `tops_${i}`;
        croppedImages[key] = url;
      });
    } else if (croppedResult.croppedImageUrl) {
      croppedImages.tops = croppedResult.croppedImageUrl;
    }

    const data = JSON.stringify({
      categories: ['tops'],
      croppedImages: croppedImages,
      originalImageUrl: imageUrl
    });

    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 120000
    };

    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Search completed in ${duration}s\n`);
        
        try {
          const json = JSON.parse(body);
          resolve({ duration, results: json });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    req.write(data);
    req.end();
  });
}

async function runTest() {
  try {
    console.log('⏱️  Starting performance test...\n');
    const totalStart = Date.now();
    
    const imageUrl = await uploadImage();
    const cropResult = await cropImage(imageUrl);
    const { duration, results } = await searchProducts(imageUrl, cropResult);
    
    const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);
    
    console.log('============================================================');
    console.log('📊 PERFORMANCE RESULTS\n');
    console.log(`Search Phase: ${duration}s`);
    console.log(`Total Time: ${totalDuration}s\n`);
    
    console.log('🎯 EXPECTED IMPROVEMENTS:');
    console.log('   Before: ~40s for search phase (2 items × 30s sequential)');
    console.log(`   After:  ~${duration}s for search phase (all items parallel)`);
    
    if (parseFloat(duration) < 25) {
      console.log('\n🎉 SUCCESS! Parallelization is working!');
      console.log(`   You saved ~${(40 - parseFloat(duration)).toFixed(0)} seconds!`);
    } else {
      console.log('\n⚠️  Time is still high. Might be cold start or network issues.');
    }
    
    console.log('\n📦 Results:');
    if (results.results) {
      Object.keys(results.results).forEach(key => {
        const items = results.results[key];
        console.log(`   ${key}: ${items.length} products found`);
      });
    }
    
    console.log('\n============================================================\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();

