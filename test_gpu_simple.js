// Test GPU with a real image from a public URL that works
const testGPU = async () => {
  console.log('🧪 Testing GPU backend with a real fashion image...\n');
  
  // Use a public test image (from Unsplash)
  const imageUrl = 'https://images.unsplash.com/photo-1618886614638-80e3c103d31a?w=800';
  
  console.log('📥 Downloading image from Unsplash...');
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  
  console.log(`✅ Image size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
  console.log(`📦 Base64 size: ${(dataUrl.length / 1024).toFixed(2)} KB\n`);
  
  const GPU_URL = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run';
  
  console.log('🚀 Sending to GPU backend...\n');
  const startTime = Date.now();
  
  const cropResponse = await fetch(`${GPU_URL}/crop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: dataUrl,
      categories: ['tops'],
      count: 1
    })
  });
  
  const data = await cropResponse.json();
  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log(`✅ Response in ${totalTime}s`);
  console.log('📥 Result:', JSON.stringify(data, null, 2));
  
  if (data.croppedImageUrl && data.croppedImageUrl.includes('supabase')) {
    console.log(`\n🎉 GPU SUCCESS! Cropped in ${totalTime}s`);
    console.log(`🔗 ${data.croppedImageUrl}`);
  } else {
    console.log(`\n⚠️  No crop performed (check Modal logs)`);
  }
};

testGPU().catch(console.error);
