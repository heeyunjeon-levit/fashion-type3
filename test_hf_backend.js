const https = require('https');

async function testCrop() {
    console.log('\n🧪 Testing Hugging Face Backend\n');
    console.log('============================================================\n');
    
    // Use a test image (person wearing clothing)
    const testImageUrl = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800';
    
    const payload = JSON.stringify({
        imageUrl: testImageUrl,
        categories: ['tops'],
        count: 1
    });
    
    console.log('📤 Request:');
    console.log(`   Image: ${testImageUrl}`);
    console.log(`   Categories: ['tops']`);
    console.log(`   Count: 1\n`);
    
    const options = {
        hostname: 'naenahjeon-fashion-crop-api.hf.space',
        path: '/crop',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };
    
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`⏱️  Request completed in ${duration}s`);
                console.log(`✅ Status: ${res.statusCode}\n`);
                
                try {
                    const result = JSON.parse(data);
                    console.log('📊 Response:');
                    console.log(JSON.stringify(result, null, 2));
                    
                    if (result.croppedImageUrl && result.croppedImageUrl !== testImageUrl) {
                        console.log('\n✅ SUCCESS! Got cropped image URL (different from original)');
                    } else if (result.croppedImageUrls && result.croppedImageUrls.length > 0) {
                        console.log('\n✅ SUCCESS! Got cropped images:');
                        result.croppedImageUrls.forEach((url, i) => {
                            console.log(`   ${i + 1}. ${url}`);
                        });
                    } else {
                        console.log('\n⚠️  WARNING: Returned original image (no crop detected)');
                        console.log('   This might mean:');
                        console.log('   - No item was detected in the image');
                        console.log('   - The detection confidence was too low');
                    }
                    
                    resolve(result);
                } catch (err) {
                    console.error('❌ Failed to parse response:', data);
                    reject(err);
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ Request failed:', err.message);
            reject(err);
        });
        
        req.write(payload);
        req.end();
    });
}

console.log('⏳ Testing (this may take 10-30 seconds)...\n');
testCrop()
    .then(() => {
        console.log('\n============================================================');
        console.log('✅ Backend test complete!\n');
    })
    .catch(err => {
        console.error('\n❌ Test failed:', err);
        process.exit(1);
    });
