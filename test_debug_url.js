const fetch = require('node-fetch');

const NEXT_API_BASE = 'http://localhost:3000';

async function debugGPTPipelineFromURL() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DEBUGGING GPT PIPELINE (from URL)');
  console.log('='.repeat(80) + '\n');

  // Use existing Supabase URL
  const imageUrl = process.argv[2] || 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/upload_1762390220956_4aaa14222152-Screenshot_20250922_183517.jpg';
  
  console.log('📁 Test image URL:', imageUrl);
  console.log('');

  // Step 1: GPT Detection (Analyze + Crop)
  console.log('━'.repeat(80));
  console.log('🤖 STEP 1: GPT-4o DETECTION & CROPPING');
  console.log('━'.repeat(80));
  
  const analyzeResponse = await fetch(`${NEXT_API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });

  if (!analyzeResponse.ok) {
    console.error('❌ Analyze API error:', analyzeResponse.status, analyzeResponse.statusText);
    const errorText = await analyzeResponse.text();
    console.error('Response:', errorText.substring(0, 500));
    return;
  }

  const analyzeData = await analyzeResponse.json();
  
  console.log('\n📊 GPT-4o RAW RESPONSE:');
  console.log(JSON.stringify(analyzeData, null, 2));
  console.log('');
  
  console.log('\n📊 GPT-4o DETECTED ITEMS:');
  console.log('─'.repeat(80));
  
  if (analyzeData.items && analyzeData.items.length > 0) {
    analyzeData.items.forEach((item, idx) => {
      console.log(`\n[Item ${idx + 1}/${analyzeData.items.length}]`);
      console.log(`  Category:           ${item.category}`);
      console.log(`  GroundingDINO:      "${item.groundingdino_prompt}"`);
      console.log(`  Description:        "${item.description}"`);
      console.log(`  Cropped URL:        ${item.croppedImageUrl?.substring(0, 70)}...`);
      console.log(`  Confidence:         ${item.confidence ? (item.confidence * 100).toFixed(1) + '%' : 'N/A'}`);
    });
    
    console.log('\n' + '─'.repeat(80));
    console.log(`✅ Total items detected: ${analyzeData.items.length}`);
    console.log(`💾 Cached: ${analyzeData.cached ? 'Yes' : 'No'}`);
  } else {
    console.log('❌ No items detected by GPT-4o');
    return;
  }
  
  console.log('');

  // Step 2: Search with detailed GPT filtering logs
  console.log('━'.repeat(80));
  console.log('🔍 STEP 2: SEARCHING & GPT-4 FILTERING');
  console.log('━'.repeat(80));
  
  // Build request payload
  const categories = analyzeData.items.map(item => item.category);
  const croppedImages = {};
  analyzeData.items.forEach((item, idx) => {
    if (item.croppedImageUrl) {
      const key = `${item.category}_${idx + 1}`;
      croppedImages[key] = item.croppedImageUrl;
    }
  });

  console.log(`\n🎯 Searching ${categories.length} items:`, categories);
  console.log('');

  const searchResponse = await fetch(`${NEXT_API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categories,
      croppedImages,
      originalImageUrl: imageUrl,
    }),
  });

  const searchData = await searchResponse.json();
  
  // Display results for each item
  console.log('\n📦 SEARCH RESULTS BY ITEM:');
  console.log('═'.repeat(80));
  
  Object.entries(searchData.results || {}).forEach(([key, links]) => {
    const itemIndex = parseInt(key.split('_')[1]) - 1;
    const item = analyzeData.items[itemIndex];
    
    console.log(`\n[${key.toUpperCase()}]`);
    console.log(`  Original Detection: "${item.groundingdino_prompt}"`);
    console.log(`  Description:        "${item.description}"`);
    console.log(`  Cropped Image:      ${item.croppedImageUrl?.substring(0, 60)}...`);
    console.log('');
    console.log(`  🔗 GPT-4 Selected Links (${links.length}):`);
    console.log('  ' + '─'.repeat(76));
    
    links.forEach((link, idx) => {
      console.log(`\n  ${idx + 1}. ${link.title || 'No title'}`);
      console.log(`     🌐 ${link.link.substring(0, 80)}${link.link.length > 80 ? '...' : ''}`);
      console.log(`     📸 Thumbnail: ${link.thumbnail ? '✅' : '❌'}`);
    });
    
    if (links.length === 0) {
      console.log('  ⚠️  No results found for this item');
    }
  });

  console.log('\n' + '═'.repeat(80));
  console.log('✅ PIPELINE TEST COMPLETE');
  console.log('═'.repeat(80) + '\n');

  // Summary
  console.log('📊 SUMMARY:');
  console.log('─'.repeat(80));
  console.log(`Items detected by GPT-4o:     ${analyzeData.items.length}`);
  console.log(`Items with search results:    ${Object.keys(searchData.results || {}).length}`);
  
  let totalLinks = 0;
  Object.values(searchData.results || {}).forEach(links => {
    totalLinks += links.length;
  });
  console.log(`Total product links found:    ${totalLinks}`);
  console.log('');

  // Check server logs for GPT details
  console.log('💡 TIP: Check your Next.js dev server terminal for detailed GPT logs:');
  console.log('   - GPT-4o analysis reasoning (detection step)');
  console.log('   - Serper search results (all 150+ results before filtering)');
  console.log('   - GPT-4-turbo filtering decisions');
  console.log('   - Why certain links were chosen/rejected');
  console.log('');
}

// Run the test
debugGPTPipelineFromURL().catch(console.error);

