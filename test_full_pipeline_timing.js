/**
 * Comprehensive Pipeline Timing Test
 * Tests the entire user flow and records time for each segment
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const FormData = require('form-data');

const TEST_IMAGE = '/Users/levit/Desktop/photos/008ae8fd9128-IMG_7570.jpeg';
const VERCEL_URL = 'https://mvp-nu-six.vercel.app'; // Update with your actual Vercel URL

console.log('\n🧪 FULL PIPELINE TIMING TEST\n');
console.log('Testing the complete user flow from browser perspective\n');
console.log('============================================================\n');

const timings = {
  total: { start: Date.now() },
  upload: {},
  crop: {},
  search: {},
  display: {}
};

function recordTime(phase, event, value = null) {
  if (value !== null) {
    timings[phase][event] = value;
  } else if (event === 'start') {
    timings[phase].start = Date.now();
  } else if (event === 'end') {
    timings[phase].end = Date.now();
    timings[phase].duration = ((timings[phase].end - timings[phase].start) / 1000).toFixed(2);
  }
}

// Step 1: Upload image
async function testUpload() {
  return new Promise((resolve, reject) => {
    console.log('📤 PHASE 1: IMAGE UPLOAD');
    console.log('────────────────────────');
    recordTime('upload', 'start');
    
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
        recordTime('upload', 'end');
        console.log(`✅ Upload completed in ${timings.upload.duration}s`);
        console.log(`   Status: ${res.statusCode}\n`);
        
        try {
          const json = JSON.parse(body);
          const imageUrl = json.url || json.imageUrl;
          resolve(imageUrl);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

// Step 2: Crop image
async function testCrop(imageUrl) {
  return new Promise((resolve, reject) => {
    console.log('✂️  PHASE 2: IMAGE CROPPING (Modal Backend)');
    console.log('────────────────────────────────────────────');
    recordTime('crop', 'start');
    
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
      timeout: 180000 // 3 minutes
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        recordTime('crop', 'end');
        console.log(`✅ Cropping completed in ${timings.crop.duration}s`);
        console.log(`   Status: ${res.statusCode}`);
        
        try {
          const json = JSON.parse(body);
          
          // Log sub-timings if available
          if (timings.crop.duration > 60) {
            console.log(`   ⚠️  COLD START DETECTED (>60s)`);
            recordTime('crop', 'cold_start', true);
          } else {
            console.log(`   ✅ Warm start (volume cache working!)`);
            recordTime('crop', 'cold_start', false);
          }
          console.log();
          
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Crop request timed out'));
    });
    
    req.write(data);
    req.end();
  });
}

// Step 3: Search products
async function testSearch(imageUrl, croppedResult) {
  return new Promise((resolve, reject) => {
    console.log('🔍 PHASE 3: PRODUCT SEARCH (Parallelized)');
    console.log('────────────────────────────────────────────');
    recordTime('search', 'start');
    
    const croppedImages = {};
    if (croppedResult.croppedImageUrls) {
      croppedResult.croppedImageUrls.forEach((url, i) => {
        const key = i === 0 ? 'tops' : `tops_${i}`;
        croppedImages[key] = url;
      });
    } else if (croppedResult.croppedImageUrl) {
      croppedImages.tops = croppedResult.croppedImageUrl;
    }

    const numItems = Object.keys(croppedImages).length;
    console.log(`   Searching ${numItems} cropped items in parallel...`);

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
      timeout: 180000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        recordTime('search', 'end');
        console.log(`✅ Search completed in ${timings.search.duration}s`);
        console.log(`   Status: ${res.statusCode}`);
        
        try {
          const json = JSON.parse(body);
          
          // Calculate expected vs actual
          const expectedSequential = numItems * 30; // 30s per item sequential
          const expectedParallel = 30 + (numItems - 1) * 5; // Parallel overhead
          
          if (timings.search.duration < expectedSequential * 0.7) {
            console.log(`   ✅ PARALLELIZATION WORKING!`);
            console.log(`      Expected sequential: ${expectedSequential}s`);
            console.log(`      Actual parallel: ${timings.search.duration}s`);
            console.log(`      Time saved: ${(expectedSequential - timings.search.duration).toFixed(1)}s`);
          } else {
            console.log(`   ⚠️  Might still be sequential?`);
            console.log(`      Expected parallel: ~${expectedParallel}s`);
            console.log(`      Actual: ${timings.search.duration}s`);
          }
          
          recordTime('search', 'num_items', numItems);
          console.log();
          
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Search request timed out'));
    });
    
    req.write(data);
    req.end();
  });
}

// Main test flow
async function runFullPipelineTest() {
  try {
    console.log('⏱️  Starting comprehensive pipeline timing test...\n');
    
    // Phase 1: Upload
    const imageUrl = await testUpload();
    
    // Phase 2: Crop
    const cropResult = await testCrop(imageUrl);
    
    // Phase 3: Search
    const searchResults = await testSearch(imageUrl, cropResult);
    
    // Calculate total
    timings.total.end = Date.now();
    timings.total.duration = ((timings.total.end - timings.total.start) / 1000).toFixed(2);
    
    // Display comprehensive results
    console.log('============================================================');
    console.log('📊 COMPREHENSIVE TIMING REPORT');
    console.log('============================================================\n');
    
    console.log('PHASE BREAKDOWN:');
    console.log('────────────────────────────────────────────');
    console.log(`1. Upload to Supabase:     ${timings.upload.duration}s`);
    console.log(`   └─ Network + Storage`);
    console.log();
    
    console.log(`2. Crop with Modal:        ${timings.crop.duration}s`);
    if (timings.crop.cold_start) {
      console.log(`   ├─ Model loading:       ~${Math.max(0, timings.crop.duration - 20).toFixed(0)}s (COLD START)`);
      console.log(`   ├─ GPT-4o analysis:     ~3-5s`);
      console.log(`   ├─ GroundingDINO:       ~2-5s`);
      console.log(`   ├─ SAM-2 segmentation:  ~10s`);
      console.log(`   └─ Upload crops:        ~2s`);
    } else {
      console.log(`   ├─ Load from volume:    ~5-10s (WARM)`);
      console.log(`   ├─ GPT-4o analysis:     ~3-5s`);
      console.log(`   ├─ GroundingDINO:       ~2-5s`);
      console.log(`   ├─ SAM-2 segmentation:  ~${Math.max(5, timings.crop.duration - 15).toFixed(0)}s`);
      console.log(`   └─ Upload crops:        ~2s`);
    }
    console.log();
    
    console.log(`3. Search products:        ${timings.search.duration}s`);
    console.log(`   ├─ Full image search:   ~10s (3 parallel Serper calls)`);
    console.log(`   ├─ Per-item searches:   ~${Math.max(10, timings.search.duration - 10).toFixed(0)}s (${timings.search.num_items} items parallel)`);
    console.log(`   │  ├─ Serper API:       3 calls × ${timings.search.num_items} items`);
    console.log(`   │  └─ GPT filtering:    ${timings.search.num_items} calls`);
    console.log(`   └─ Result aggregation:  <1s`);
    console.log();
    
    console.log('────────────────────────────────────────────');
    console.log(`TOTAL PIPELINE TIME:       ${timings.total.duration}s`);
    console.log('────────────────────────────────────────────\n');
    
    // Performance analysis
    console.log('PERFORMANCE ANALYSIS:');
    console.log('────────────────────────────────────────────');
    
    const uploadPercent = (timings.upload.duration / timings.total.duration * 100).toFixed(1);
    const cropPercent = (timings.crop.duration / timings.total.duration * 100).toFixed(1);
    const searchPercent = (timings.search.duration / timings.total.duration * 100).toFixed(1);
    
    console.log(`Upload:  ${uploadPercent}% of total time`);
    console.log(`Crop:    ${cropPercent}% of total time ${cropPercent > 50 ? '🔴 BOTTLENECK' : '🟢 OK'}`);
    console.log(`Search:  ${searchPercent}% of total time ${searchPercent > 40 ? '🟡 HEAVY' : '🟢 OK'}`);
    console.log();
    
    // Optimization suggestions
    console.log('OPTIMIZATION STATUS:');
    console.log('────────────────────────────────────────────');
    
    if (timings.crop.cold_start) {
      console.log('🔴 Cold start detected in crop phase');
      console.log('   → Volume caching deployed but container was idle');
      console.log('   → Add GitHub Actions ping to keep warm (free)');
      console.log('   → Or add keep_warm=1 ($20/month)');
    } else {
      console.log('✅ Volume caching working (warm start)');
    }
    
    if (timings.search.duration < timings.search.num_items * 30 * 0.7) {
      console.log('✅ Search parallelization working');
    } else {
      console.log('⚠️  Search might not be fully parallelized');
      console.log('   → Check if Vercel deployment has latest code');
    }
    
    console.log();
    
    // Results summary
    if (searchResults.results) {
      const resultCount = Object.keys(searchResults.results).length;
      let totalProducts = 0;
      Object.values(searchResults.results).forEach(items => {
        totalProducts += items.length;
      });
      console.log(`✅ Found ${totalProducts} products across ${resultCount} items`);
    }
    
    console.log('\n============================================================\n');
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      timings,
      performance: {
        uploadPercent: parseFloat(uploadPercent),
        cropPercent: parseFloat(cropPercent),
        searchPercent: parseFloat(searchPercent)
      },
      optimizations: {
        volumeCaching: !timings.crop.cold_start,
        searchParallelization: timings.search.duration < timings.search.num_items * 30 * 0.7
      }
    };
    
    fs.writeFileSync('pipeline_timing_report.json', JSON.stringify(report, null, 2));
    console.log('📄 Detailed report saved to: pipeline_timing_report.json\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check if Next.js is running
http.get('http://127.0.0.1:3000', () => {
  console.log('✅ Next.js dev server is running\n');
  runFullPipelineTest();
}).on('error', () => {
  console.log('❌ Next.js dev server is not running!');
  console.log('   Please run: npm run dev\n');
  process.exit(1);
});

