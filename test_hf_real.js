const https = require('https');
const http = require('http');
const fs = require('fs');
const FormData = require('form-data');

async function uploadImage() {
    const imagePath = '/Users/levit/Desktop/photos/008ae8fd9128-IMG_7570.jpeg';
    
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('file', fs.createReadStream(imagePath));
        
        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/upload',
            method: 'POST',
            headers: form.getHeaders()
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('✅ Image uploaded:', result.imageUrl);
                    resolve(result.imageUrl);
                } catch (err) {
                    reject(err);
                }
            });
        });
        
        req.on('error', reject);
        form.pipe(req);
    });
}

async function testCrop(imageUrl) {
    const payload = JSON.stringify({
        imageUrl: imageUrl,
        categories: ['tops'],
        count: 1
    });
    
    console.log('\n📤 Testing crop with:');
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
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`⏱️  Crop completed in ${duration}s`);
                console.log(`Status: ${res.statusCode}\n`);
                
                try {
                    const result = JSON.parse(data);
                    console.log('📊 Response:');
                    console.log(JSON.stringify(result, null, 2));
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            });
        });
        
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

console.log('🧪 Testing HF Backend with Real Image\n');

uploadImage()
    .then(imageUrl => testCrop(imageUrl))
    .then(() => console.log('\n✅ Test complete!'))
    .catch(err => console.error('❌ Error:', err.message));
