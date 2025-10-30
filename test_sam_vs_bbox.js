/**
 * Test SAM-2 vs Bounding Box Only
 * Compares search accuracy and timing
 */

const fs = require('fs');
const https = require('https');
const FormData = require('form-data');
const http = require('http');

const TEST_IMAGE = '/Users/levit/Desktop/photos/008ae8fd9128-IMG_7570.jpeg';
const MODAL_URL = 'heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run';

console.log('\n🧪 SAM-2 vs Bounding Box Comparison Test\n');
console.log('Testing search accuracy with both methods\n');
console.log('============================================================\n');

// Step 1: Upload image
async function uploadImage() {
    return new Promise((resolve, reject) => {
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
                const json = JSON.parse(body);
                const imageUrl = json.url || json.imageUrl;
                resolve(imageUrl);
            });
        });

        req.on('error', reject);
        form.pipe(req);
    });
}

// Step 2: Crop with specified mode
async function cropImage(imageUrl, useSAM2) {
    return new Promise((resolve, reject) => {
        console.log(`\n${ useSAM2 ? '🎨 Testing with SAM-2 (pixel-perfect segmentation)' : '⚡ Testing with Bounding Box Only (fast mode)'}\n`);
        
        const data = JSON.stringify({
            imageUrl: imageUrl,
            categories: ['tops'],
            count: 1
        });

        const options = {
            hostname: MODAL_URL,
            path: '/crop',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                // Pass environment variable to backend
                'X-Use-SAM2': useSAM2 ? 'true' : 'false'
            },
            timeout: 180000
        };

        const startTime = Date.now();
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                const json = JSON.parse(body);
                console.log(`✅ Cropping completed in ${duration}s`);
                resolve({ croppedResult: json, duration: parseFloat(duration) });
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
async function searchProducts(imageUrl, croppedResult) {
    return new Promise((resolve, reject) => {
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
            timeout: 180000
        };

        const startTime = Date.now();
        
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                const json = JSON.parse(body);
                console.log(`✅ Search completed in ${duration}s`);
                resolve({ searchResults: json.results, duration: parseFloat(duration) });
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

// Main test
async function runComparison() {
    try {
        console.log('⏱️  Starting comparison test...\n');
        
        // Upload once
        console.log('📤 Uploading test image...');
        const imageUrl = await uploadImage();
        console.log(`✅ Image uploaded: ${imageUrl.substring(0, 60)}...\n`);
        
        // Test 1: With SAM-2
        console.log('═══════════════════════════════════════════════════════════');
        console.log('TEST 1: WITH SAM-2 (Current Default)');
        console.log('═══════════════════════════════════════════════════════════');
        const sam2Start = Date.now();
        const { croppedResult: sam2Crop, duration: sam2CropTime } = await cropImage(imageUrl, true);
        const { searchResults: sam2Results, duration: sam2SearchTime } = await searchProducts(imageUrl, sam2Crop);
        const sam2Total = ((Date.now() - sam2Start) / 1000).toFixed(2);
        
        console.log(`\n📊 SAM-2 Results:`);
        console.log(`   Crop time: ${sam2CropTime}s`);
        console.log(`   Search time: ${sam2SearchTime}s`);
        console.log(`   Total: ${sam2Total}s`);
        console.log(`   Products found: ${sam2Results.tops ? sam2Results.tops.length : 0}`);
        
        // Wait a bit between tests
        console.log('\n⏳ Waiting 5 seconds before bbox test...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Test 2: Bounding Box Only
        console.log('═══════════════════════════════════════════════════════════');
        console.log('TEST 2: BOUNDING BOX ONLY (Fast Mode)');
        console.log('═══════════════════════════════════════════════════════════');
        const bboxStart = Date.now();
        const { croppedResult: bboxCrop, duration: bboxCropTime } = await cropImage(imageUrl, false);
        const { searchResults: bboxResults, duration: bboxSearchTime } = await searchProducts(imageUrl, bboxCrop);
        const bboxTotal = ((Date.now() - bboxStart) / 1000).toFixed(2);
        
        console.log(`\n📊 Bounding Box Results:`);
        console.log(`   Crop time: ${bboxCropTime}s`);
        console.log(`   Search time: ${bboxSearchTime}s`);
        console.log(`   Total: ${bboxTotal}s`);
        console.log(`   Products found: ${bboxResults.tops ? bboxResults.tops.length : 0}`);
        
        // Comparison
        console.log('\n============================================================');
        console.log('📊 COMPARISON RESULTS');
        console.log('============================================================\n');
        
        const cropSpeedup = ((sam2CropTime - bboxCropTime) / sam2CropTime * 100).toFixed(1);
        const totalSpeedup = ((parseFloat(sam2Total) - parseFloat(bboxTotal)) / parseFloat(sam2Total) * 100).toFixed(1);
        
        console.log('⏱️  TIMING:');
        console.log(`   SAM-2 crop:    ${sam2CropTime}s`);
        console.log(`   Bbox crop:     ${bboxCropTime}s`);
        console.log(`   Speedup:       ${cropSpeedup}% faster! 🚀\n`);
        
        console.log(`   SAM-2 total:   ${sam2Total}s`);
        console.log(`   Bbox total:    ${bboxTotal}s`);
        console.log(`   Speedup:       ${totalSpeedup}% faster! 🚀\n`);
        
        console.log('🔍 SEARCH QUALITY:');
        console.log(`   SAM-2 products:    ${sam2Results.tops ? sam2Results.tops.length : 0}`);
        console.log(`   Bbox products:     ${bboxResults.tops ? bboxResults.tops.length : 0}\n`);
        
        // Compare product links
        const sam2Links = sam2Results.tops ? sam2Results.tops.map(r => r.link) : [];
        const bboxLinks = bboxResults.tops ? bboxResults.tops.map(r => r.link) : [];
        const matchingLinks = sam2Links.filter(link => bboxLinks.includes(link)).length;
        const similarity = sam2Links.length > 0 ? (matchingLinks / sam2Links.length * 100).toFixed(1) : 0;
        
        console.log(`   Matching products: ${matchingLinks}/${sam2Links.length}`);
        console.log(`   Similarity:        ${similarity}%\n`);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        if (similarity >= 80) {
            console.log('✅ VERDICT: Bounding boxes maintain search quality!');
            console.log(`   ${cropSpeedup}% faster with ${similarity}% search accuracy maintained.\n`);
        } else if (similarity >= 60) {
            console.log('⚠️  VERDICT: Slight quality loss with bounding boxes');
            console.log(`   ${cropSpeedup}% faster but ${100 - similarity}% accuracy drop.\n`);
        } else {
            console.log('❌ VERDICT: Significant quality loss with bounding boxes');
            console.log(`   Not recommended - ${100 - similarity}% accuracy drop.\n`);
        }
        
        // Detailed product comparison
        console.log('🔗 PRODUCT COMPARISON:\n');
        console.log('SAM-2 Products:');
        sam2Links.forEach((link, i) => {
            const inBbox = bboxLinks.includes(link) ? '✅' : '❌';
            console.log(`   ${i+1}. ${inBbox} ${link.substring(0, 80)}...`);
        });
        
        console.log('\nBbox Products:');
        bboxLinks.forEach((link, i) => {
            const inSam2 = sam2Links.includes(link) ? '✅' : '🆕';
            console.log(`   ${i+1}. ${inSam2} ${link.substring(0, 80)}...`);
        });
        
        console.log('\n============================================================\n');
        
        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            testImage: TEST_IMAGE,
            sam2: {
                cropTime: sam2CropTime,
                searchTime: sam2SearchTime,
                totalTime: parseFloat(sam2Total),
                products: sam2Links
            },
            bbox: {
                cropTime: bboxCropTime,
                searchTime: bboxSearchTime,
                totalTime: parseFloat(bboxTotal),
                products: bboxLinks
            },
            comparison: {
                cropSpeedup: parseFloat(cropSpeedup),
                totalSpeedup: parseFloat(totalSpeedup),
                similarity: parseFloat(similarity),
                matchingProducts: matchingLinks
            }
        };
        
        fs.writeFileSync('sam_vs_bbox_comparison.json', JSON.stringify(report, null, 2));
        console.log('📄 Detailed report saved to: sam_vs_bbox_comparison.json\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Check if Next.js is running
http.get('http://127.0.0.1:3000', () => {
    console.log('✅ Next.js dev server is running\n');
    runComparison();
}).on('error', () => {
    console.log('❌ Next.js dev server is not running!');
    console.log('   Please run: npm run dev\n');
    process.exit(1);
});

