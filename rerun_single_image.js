const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BACKEND_URL = 'https://heeyunjeon-levit--fashion-crop-api-cpu-fastapi-app-v2.modal.run';
const SEARCH_API_URL = 'http://localhost:3000/api/search';

const CATEGORY_MAP = {
  '상의': 'tops',
  '하의': 'bottoms',
  '신발': 'shoes',
  '가방': 'bags',
  '악세사리': 'accessories',
  '드레스': 'dress'
};

// The specific image to re-run
const TEST_IMAGE = {
  filename: '4aaa14222152-Screenshot_20250922_183517.jpg',
  categories: ['상의', '하의']
};

async function uploadToSupabase(imagePath) {
  const originalName = path.basename(imagePath);
  const sanitizedName = originalName
    .normalize('NFD')
    .replace(/[\u0080-\uFFFF]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
  
  const fileName = `batch_test_${Date.now()}_${sanitizedName}`;
  const fileBuffer = fs.readFileSync(imagePath);
  
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/images/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'image/jpeg',
    },
    body: fileBuffer
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
  }
  
  return `${SUPABASE_URL}/storage/v1/object/public/images/${fileName}`;
}

async function cropImage(imageUrl, categories, retryCount = 0) {
  const maxRetries = 2;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes
    
    console.log(`📤 Sending crop request to: ${BACKEND_URL}/crop`);
    console.log(`   Image: ${imageUrl}`);
    console.log(`   Categories: ${categories.join(', ')}`);
    
    const response = await fetch(`${BACKEND_URL}/crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, categories }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 408 && retryCount < maxRetries) {
        console.log(`   ⚠️  408 timeout, retrying (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return await cropImage(imageUrl, categories, retryCount + 1);
      }
      
      throw new Error(`${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      if (retryCount < maxRetries) {
        console.log(`   ⚠️  Request timeout, retrying (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return await cropImage(imageUrl, categories, retryCount + 1);
      }
      throw new Error('Request timeout after retries');
    }
    throw error;
  }
}

async function searchProducts(categories, croppedImages) {
  const response = await fetch(SEARCH_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories, croppedImages })
  });
  
  if (!response.ok) {
    throw new Error(await response.text());
  }
  
  return await response.json();
}

async function main() {
  const imagePath = `/Users/levit/Desktop/batch2/${TEST_IMAGE.filename}`;
  const categoriesEn = TEST_IMAGE.categories.map(cat => CATEGORY_MAP[cat] || cat);
  
  console.log('🔄 RE-RUNNING SINGLE IMAGE WITH PROPER CROP');
  console.log('═'.repeat(80));
  console.log(`📁 File: ${TEST_IMAGE.filename}`);
  console.log(`🎯 Categories: ${TEST_IMAGE.categories.join(', ')} → ${categoriesEn.join(', ')}`);
  console.log('');
  
  const result = {
    filename: TEST_IMAGE.filename,
    requested_categories_kr: TEST_IMAGE.categories,
    requested_categories_en: categoriesEn,
    status: 'pending',
    original_image_url: null,
    cropped_image_urls: {},
    crop_time: 0,
    search_time: 0,
    total_time: 0,
    cropped_items: 0,
    search_results: {},
    source_counts: null,
    error: null
  };
  
  const startTime = Date.now();
  
  try {
    // Upload
    console.log('📤 Uploading...');
    const t0 = Date.now();
    const imageUrl = await uploadToSupabase(imagePath);
    const uploadTime = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`✅ Uploaded in ${uploadTime}s`);
    console.log(`   URL: ${imageUrl}`);
    
    result.original_image_url = imageUrl;
    
    // Crop
    console.log('\n✂️  Cropping...');
    const t1 = Date.now();
    const cropData = await cropImage(imageUrl, categoriesEn);
    result.crop_time = ((Date.now() - t1) / 1000).toFixed(2);
    
    console.log(`\n📊 Crop Response:`);
    console.log(JSON.stringify(cropData, null, 2));
    
    // Build crops object with category matching
    const crops = {};
    if (cropData.croppedImageUrl) {
      crops[categoriesEn[0]] = cropData.croppedImageUrl;
      result.cropped_image_urls[categoriesEn[0]] = cropData.croppedImageUrl;
      result.cropped_items = 1;
    } else if (cropData.croppedImageUrls) {
      // Parse filename to determine actual category
      const categoryKeywords = {
        'tops': ['shirt', 'blouse', 'top', 'tee', 'sweater', 'hoodie', 'jacket', 'cardigan', 'vest'],
        'bottoms': ['pants', 'jeans', 'skirt', 'shorts', 'trousers', 'leggings'],
        'dress': ['dress', 'gown'],
        'shoes': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer'],
        'bags': ['bag', 'purse', 'backpack', 'tote', 'clutch', 'handbag'],
        'accessories': ['necklace', 'bracelet', 'earring', 'watch', 'hat', 'scarf', 'belt', 'sunglasses', 'ring']
      };
      
      cropData.croppedImageUrls.forEach((url, idx) => {
        const filename = url.split('/').pop().split('?')[0].toLowerCase();
        
        // Try to match filename keywords to requested categories
        let matchedCategory = null;
        for (const requestedCat of categoriesEn) {
          const keywords = categoryKeywords[requestedCat] || [requestedCat];
          if (keywords.some(keyword => filename.includes(keyword))) {
            matchedCategory = requestedCat;
            break;
          }
        }
        
        const category = matchedCategory || categoriesEn[idx] || `item${idx + 1}`;
        
        if (matchedCategory) {
          console.log(`   🎯 Matched '${filename}' → '${category}'`);
        } else {
          console.log(`   ⚠️  No match for '${filename}', using index → '${category}'`);
        }
        
        crops[category] = url;
        result.cropped_image_urls[category] = url;
      });
      result.cropped_items = cropData.croppedImageUrls.length;
    }
    
    console.log(`\n✅ Cropped ${result.cropped_items} items in ${result.crop_time}s`);
    console.log(`\n📸 Cropped Images:`);
    Object.entries(result.cropped_image_urls).forEach(([cat, url]) => {
      console.log(`   ${cat}: ${url}`);
    });
    
    // Search
    console.log('\n🔍 Searching...');
    const t2 = Date.now();
    const searchResult = await searchProducts(categoriesEn, crops);
    result.search_time = ((Date.now() - t2) / 1000).toFixed(2);
    
    if (searchResult.results) {
      result.search_results = searchResult.results;
      result.source_counts = searchResult.meta?.sourceCounts || null;
      
      const gpt = searchResult.meta?.sourceCounts?.gpt || 0;
      const fallback = searchResult.meta?.sourceCounts?.fallback || 0;
      console.log(`✅ Searched in ${result.search_time}s (GPT=${gpt}, Fallback=${fallback})`);
    }
    
    result.total_time = ((Date.now() - startTime) / 1000).toFixed(2);
    result.status = 'success';
    console.log(`\n✅ TOTAL: ${result.total_time}s`);
    
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    result.total_time = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n❌ FAILED: ${error.message}`);
  }
  
  // Save results
  const outputPath = 'rerun_4aaa14222152_result.json';
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  
  console.log('\n' + '═'.repeat(80));
  console.log(`💾 Results saved to: ${outputPath}`);
  console.log('═'.repeat(80));
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

