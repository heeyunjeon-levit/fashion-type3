// Debug script to test search API and see detailed errors
const fs = require('fs');

async function debugSearch() {
  console.log('🔍 Starting search debug...\n');
  
  // Read the result from our test
  const resultPath = './single_user_test/1036393835_result.json';
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  
  console.log('📋 Cropped data:');
  console.log(JSON.stringify(result.cropped_data.croppedImages, null, 2));
  
  const searchPayload = {
    categories: Object.keys(result.cropped_data.croppedImages),
    croppedImages: result.cropped_data.croppedImages,
    originalImageUrl: result.uploaded_url
  };
  
  console.log('\n📤 Sending search request...');
  console.log('Categories:', searchPayload.categories);
  console.log('Original URL:', searchPayload.originalImageUrl);
  
  try {
    const response = await fetch('http://localhost:3000/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload)
    });
    
    const data = await response.json();
    
    console.log('\n📥 Search response:');
    console.log('Status:', response.status);
    console.log('Results:', JSON.stringify(data, null, 2));
    
    if (data.meta && data.meta.sourceCounts) {
      console.log('\n📊 Source counts:', data.meta.sourceCounts);
      if (data.meta.sourceCounts.error > 0) {
        console.log('⚠️  Search returned errors!');
      }
    }
    
    // Check server console for detailed errors
    console.log('\n💡 Check the Next.js dev server console for detailed error messages');
    
  } catch (error) {
    console.error('❌ Error calling search API:', error);
  }
}

debugSearch().catch(console.error);

