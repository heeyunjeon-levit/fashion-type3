const fs = require('fs');

// Download a test image first
const downloadTestImage = async () => {
  console.log('📥 Downloading test image from Supabase...');
  const imageUrl = 'https://lbiljokkdlrhlsmepojq.supabase.co/storage/v1/object/public/images/1730614994992-8c97f19c-1edc-4e2d-bb87-ebcbdee1c869.jpg';
  
  // Use node-fetch if available, otherwise use native fetch
  let fetch;
  try {
    fetch = (await import('node-fetch')).default;
  } catch {
    // Node 18+ has native fetch
    fetch = globalThis.fetch;
  }
  
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  
  console.log(`✅ Image downloaded: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
  console.log(`📦 Base64 size: ${(dataUrl.length / 1024).toFixed(2)} KB\n`);
  
  return dataUrl;
};

const testGPU = async () => {
  try {
    const imageBase64 = await downloadTestImage();
    
    console.log('🧪 Testing GPU backend with real image...\n');
    
    const GPU_URL = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run';
    
    const startTime = Date.now();
    
    // Use node-fetch if available, otherwise use native fetch
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      fetch = globalThis.fetch;
    }
    
    const response = await fetch(`${GPU_URL}/crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: imageBase64,
        categories: ['tops'],
        count: 1
      })
    });
    
    const data = await response.json();
    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Response received in ${totalTime}s`);
    console.log('📥 Data:', JSON.stringify(data, null, 2));
    
    if (data.croppedImageUrl && data.croppedImageUrl.includes('supabase')) {
      console.log(`\n🎉 SUCCESS! GPU backend cropped the image in ${totalTime}s!`);
      console.log('🔗 Cropped image URL:', data.croppedImageUrl);
    } else if (data.croppedImageUrl) {
      console.log(`\n⚠️  Returned original URL (no crops found)`);
    } else {
      console.log(`\n⚠️  Returned null (check logs for errors)`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testGPU();

