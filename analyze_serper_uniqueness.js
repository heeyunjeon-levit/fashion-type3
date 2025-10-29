// Analyze how unique Serper results are at different cutoff points
const FormData = require('form-data');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PHOTO_DIR = '/Users/levit/Desktop/photos';
const TEST_IMAGE = '008ae8fd9128-IMG_7570.jpeg';
const CATEGORY = 'tops';

// Monkey-patch the search route to return detailed stats
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
          reject(new Error(`Upload failed: ${res.statusCode}`));
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
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(data);
          resolve(result.croppedImageUrl || result.croppedImageUrls?.[0]);
        } else {
          reject(new Error(`Crop failed: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Load environment variables from .env
function loadEnv() {
  try {
    const envContent = fs.readFileSync('/Users/levit/Desktop/mvp/.env', 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  } catch (e) {
    console.warn('⚠️ Could not load .env.local:', e.message);
  }
}

// Modified search function that directly calls Serper API
async function analyzeSerperDirectly(imageUrl, runs = 3) {
  loadEnv();
  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  if (!SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY not found in .env');
  }

  const allResults = [];
  
  console.log(`\n🔍 Running Serper ${runs} times...`);
  
  for (let i = 0; i < runs; i++) {
    const response = await fetch('https://google.serper.dev/lens', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: imageUrl,
        gl: 'kr',
        hl: 'ko'
      })
    });
    
    const data = await response.json();
    const organic = data.organic || [];
    allResults.push({ run: i + 1, count: organic.length, results: organic });
    console.log(`   Run ${i + 1}: ${organic.length} results`);
  }
  
  return allResults;
}

function analyzeUniqueness(allResults) {
  console.log('\n📊 Uniqueness Analysis:\n');
  
  // Aggregate all results
  const aggregated = [];
  allResults.forEach(run => {
    aggregated.push(...run.results);
  });
  
  console.log(`Total results from ${allResults.length} runs: ${aggregated.length}`);
  
  // Deduplicate by URL
  const uniqueByUrl = Array.from(
    new Map(aggregated.map(item => [item.link, item])).values()
  );
  
  console.log(`Unique results (by URL): ${uniqueByUrl.length}`);
  console.log(`Duplicate rate: ${((aggregated.length - uniqueByUrl.length) / aggregated.length * 100).toFixed(1)}%\n`);
  
  // Analyze top N results
  const topNAnalysis = [10, 20, 30, 50];
  
  topNAnalysis.forEach(n => {
    const topN = uniqueByUrl.slice(0, n);
    const topNUrls = new Set(topN.map(r => r.link));
    
    // How many of these appear in each run?
    const appearanceCount = {};
    allResults.forEach((run, runIndex) => {
      topN.forEach(result => {
        const found = run.results.find(r => r.link === result.link);
        if (found) {
          appearanceCount[result.link] = (appearanceCount[result.link] || 0) + 1;
        }
      });
    });
    
    const appeared1Time = Object.values(appearanceCount).filter(c => c === 1).length;
    const appeared2Times = Object.values(appearanceCount).filter(c => c === 2).length;
    const appeared3Times = Object.values(appearanceCount).filter(c => c === 3).length;
    
    console.log(`Top ${n} unique results:`);
    console.log(`  - Appeared in 1 run only: ${appeared1Time} (${(appeared1Time/n*100).toFixed(1)}%)`);
    console.log(`  - Appeared in 2 runs: ${appeared2Times} (${(appeared2Times/n*100).toFixed(1)}%)`);
    console.log(`  - Appeared in all 3 runs: ${appeared3Times} (${(appeared3Times/n*100).toFixed(1)}%)`);
    console.log();
  });
}

async function main() {
  try {
    console.log('🚀 Starting Serper uniqueness analysis...\n');
    
    const imagePath = path.join(PHOTO_DIR, TEST_IMAGE);
    
    console.log('📤 Step 1: Upload image');
    const uploadedUrl = await uploadImage(imagePath);
    console.log(`✅ Uploaded: ${uploadedUrl.substring(0, 60)}...\n`);
    
    console.log('✂️ Step 2: Crop image');
    const croppedUrl = await cropImage(uploadedUrl, CATEGORY);
    console.log(`✅ Cropped: ${croppedUrl.substring(0, 60)}...\n`);
    
    console.log('🔍 Step 3: Analyze Serper API directly');
    const allResults = await analyzeSerperDirectly(croppedUrl, 3);
    
    console.log('\n📊 Step 4: Analyze uniqueness');
    analyzeUniqueness(allResults);
    
    console.log('\n✅ Analysis complete!');
    console.log('\n💡 Interpretation:');
    console.log('  - High "appeared in 1 run only" % = More diversity from multiple runs ✅');
    console.log('  - High "appeared in all 3 runs" % = Stable, consistent results ⚡');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

