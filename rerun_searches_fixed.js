const fs = require('fs');

const SEARCH_API_URL = 'http://localhost:3000/api/search';

// Read existing results
const resultsFile = 'batch_test_results_hybrid_2025-11-05T18-45-33.json';
const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

// Find images with empty search results
const failedSearches = results.filter(r => Object.keys(r.search_results || {}).length === 0);

console.log('🔍 RE-RUNNING FAILED SEARCHES (Port 3000 Fixed!)');
console.log('═'.repeat(80));
console.log(`Found ${failedSearches.length} images with empty search results`);
console.log('');

async function searchProducts(categories, croppedImages) {
  const response = await fetch(SEARCH_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories, croppedImages })
  });
  
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status} ${await response.text()}`);
  }
  
  return await response.json();
}

async function rerunSearch(result, index, total) {
  console.log(`[${index}/${total}] 🔍 ${result.filename}`);
  
  try {
    const startTime = Date.now();
    
    // Use existing cropped images
    const crops = result.cropped_image_urls;
    const categories = result.requested_categories_en;
    
    const searchResult = await searchProducts(categories, crops);
    const searchTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (searchResult.results) {
      result.search_results = searchResult.results;
      result.source_counts = searchResult.meta?.sourceCounts || null;
      result.search_time = searchTime;
      
      const gpt = searchResult.meta?.sourceCounts?.gpt || 0;
      const fallback = searchResult.meta?.sourceCounts?.fallback || 0;
      const none = searchResult.meta?.sourceCounts?.none || 0;
      console.log(`   ✅ ${searchTime}s (GPT=${gpt}, Fallback=${fallback}, None=${none})`);
      return { success: true, result };
    } else {
      console.log(`   ⚠️  No results`);
      return { success: false, error: 'No results' };
    }
  } catch (error) {
    console.log(`   ❌ ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < failedSearches.length; i++) {
    const result = await rerunSearch(failedSearches[i], i + 1, failedSearches.length);
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Save updated results
  const outputFile = `batch_test_results_hybrid_2025-11-05_COMPLETE.json`;
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  console.log('\n' + '═'.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(80));
  console.log(`✅ Successful: ${successCount}/${failedSearches.length}`);
  console.log(`❌ Failed: ${failCount}/${failedSearches.length}`);
  
  const totalWithResults = results.filter(r => Object.keys(r.search_results || {}).length > 0).length;
  console.log(`\n🎉 TOTAL: ${totalWithResults}/64 images now have search results!`);
  console.log(`\n💾 Saved to: ${outputFile}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

