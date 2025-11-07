const fs = require('fs');

// Read the COMPLETE results (with all search results)
const results = JSON.parse(fs.readFileSync('batch_test_results_hybrid_2025-11-05_COMPLETE.json', 'utf8'));

// Calculate statistics
const totalImages = results.length;
const successfulImages = results.filter(r => r.status === 'success').length;
const failedImages = results.filter(r => r.status === 'failed').length;
const avgCropTime = (results.reduce((sum, r) => sum + parseFloat(r.crop_time || 0), 0) / totalImages).toFixed(2);
const avgSearchTime = (results.reduce((sum, r) => sum + parseFloat(r.search_time || 0), 0) / totalImages).toFixed(2);

// Count source statistics
const sourceCounts = { gpt: 0, fallback: 0, none: 0, error: 0 };
results.forEach(r => {
  if (r.source_counts) {
    sourceCounts.gpt += r.source_counts.gpt || 0;
    sourceCounts.fallback += r.source_counts.fallback || 0;
    sourceCounts.none += r.source_counts.none || 0;
    sourceCounts.error += r.source_counts.error || 0;
  }
});

// Count images with actual search results
const withResults = results.filter(r => Object.keys(r.search_results || {}).length > 0).length;

console.log('Generating HTML with COMPLETE results:');
console.log(`  Total: ${totalImages}`);
console.log(`  With search results: ${withResults}/${totalImages}`);
console.log(`  GPT: ${sourceCounts.gpt}, Fallback: ${sourceCounts.fallback}`);

// Read the template HTML and extract just the structure, then regenerate with complete data
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FINAL Batch Results - ${withResults}/64 Complete</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container { max-width: 1600px; margin: 0 auto; }
        .header {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            margin-bottom: 30px;
            text-align: center;
        }
        h1 { 
            color: #667eea; 
            margin-bottom: 15px; 
            font-size: 3em;
            font-weight: 800;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 25px 0;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        .stat-value {
            font-size: 2.5em;
            font-weight: 700;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .subtitle {
            color: #666;
            font-size: 1.1em;
            margin-top: 20px;
            line-height: 1.8;
        }
        
        /* Filters */
        .filters {
            background: white;
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        .filter-group {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
        }
        .filter-label {
            font-weight: 600;
            color: #667eea;
        }
        .filter-btn {
            padding: 8px 16px;
            border: 2px solid #667eea;
            background: white;
            color: #667eea;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 600;
        }
        .filter-btn:hover, .filter-btn.active {
            background: #667eea;
            color: white;
        }
        
        /* Result Cards */
        .result-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            transition: all 0.3s;
        }
        .result-card:hover {
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }
        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #f0f0f0;
        }
        .result-title { 
            font-weight: 600; 
            color: #333; 
            font-size: 1.1em;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .index-badge {
            background: #667eea;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 700;
        }
        .status-badge {
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: 600;
        }
        .status-success { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        
        /* Images Section */
        .images-section {
            margin: 25px 0;
            padding: 25px;
            background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
            border-radius: 12px;
            border: 2px solid #dee2e6;
        }
        .section-title {
            font-weight: 700;
            color: #667eea;
            margin-bottom: 20px;
            font-size: 1em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .images-grid {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 20px;
        }
        .original-section {
            background: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .section-label {
            font-size: 0.8em;
            font-weight: 600;
            color: #495057;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .original-image {
            width: 100%;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            border: 3px solid #667eea;
            cursor: pointer;
            transition: transform 0.3s;
        }
        .original-image:hover {
            transform: scale(1.02);
        }
        .cropped-section {
            background: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .cropped-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 12px;
        }
        .cropped-item {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 8px;
            text-align: center;
            border: 2px solid transparent;
            transition: all 0.3s;
            cursor: pointer;
        }
        .cropped-item:hover {
            border-color: #667eea;
            transform: translateY(-3px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }
        .cropped-category {
            font-size: 0.75em;
            color: white;
            background: #667eea;
            font-weight: 700;
            margin-bottom: 8px;
            text-transform: uppercase;
            padding: 4px 8px;
            border-radius: 5px;
        }
        .cropped-image {
            width: 100%;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            border: 2px solid #e0e0e0;
        }
        
        /* Timing */
        .timing-info {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin: 15px 0;
        }
        .timing-item { 
            text-align: center;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .timing-label {
            font-size: 0.7em;
            color: #6c757d;
            text-transform: uppercase;
            margin-bottom: 5px;
            font-weight: 600;
        }
        .timing-value {
            font-size: 1.3em;
            font-weight: 700;
            color: #667eea;
        }
        
        /* Products */
        .products {
            margin-top: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        .product-category {
            margin-bottom: 20px;
        }
        .category-title {
            font-weight: 600;
            color: #667eea;
            margin-bottom: 12px;
            font-size: 1em;
            text-transform: capitalize;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .result-count {
            background: #667eea;
            color: white;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 0.8em;
        }
        .product-link {
            display: flex;
            gap: 12px;
            padding: 12px;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 10px;
            text-decoration: none;
            color: #333;
            transition: all 0.3s;
        }
        .product-link:hover {
            border-color: #667eea;
            transform: translateX(5px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }
        .product-thumbnail {
            width: 70px;
            height: 70px;
            object-fit: cover;
            border-radius: 6px;
            flex-shrink: 0;
            border: 2px solid #dee2e6;
        }
        .product-info { 
            flex: 1; 
            min-width: 0;
        }
        .product-title {
            font-size: 0.9em;
            line-height: 1.4;
            margin-bottom: 5px;
            font-weight: 500;
        }
        .product-domain {
            font-size: 0.8em;
            color: #667eea;
            font-weight: 600;
        }
        
        /* Modal for full-size images */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            justify-content: center;
            align-items: center;
        }
        .modal.active { display: flex; }
        .modal-content {
            max-width: 90%;
            max-height: 90%;
            border-radius: 10px;
        }
        .modal-close {
            position: absolute;
            top: 20px;
            right: 40px;
            color: white;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
        }
        
        /* No results state */
        .no-results {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }
        .no-results-icon {
            font-size: 4em;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 FINAL Complete Results (${withResults}/64)</h1>
            <div class="subtitle">
                November 5, 2025 | All searches RE-RUN and completed!
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${successfulImages}</div>
                    <div class="stat-label">✅ Successful</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${failedImages}</div>
                    <div class="stat-label">❌ Failed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${avgCropTime}s</div>
                    <div class="stat-label">⏱️  Avg Crop Time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${avgSearchTime}s</div>
                    <div class="stat-label">🔍 Avg Search Time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${sourceCounts.gpt}</div>
                    <div class="stat-label">🤖 GPT Results</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${sourceCounts.fallback}</div>
                    <div class="stat-label">📋 Fallback Results</div>
                </div>
            </div>
        </div>

        <div class="filters">
            <div class="filter-group">
                <span class="filter-label">Filter by Category:</span>
                <button class="filter-btn active" onclick="filterByCategory('all')">All (${totalImages})</button>
                <button class="filter-btn" onclick="filterByCategory('tops')">Tops</button>
                <button class="filter-btn" onclick="filterByCategory('bottoms')">Bottoms</button>
                <button class="filter-btn" onclick="filterByCategory('dress')">Dresses</button>
                <button class="filter-btn" onclick="filterByCategory('shoes')">Shoes</button>
                <button class="filter-btn" onclick="filterByCategory('bags')">Bags</button>
                <button class="filter-btn" onclick="filterByCategory('accessories')">Accessories</button>
            </div>
        </div>

        <div id="results-container">
            ${results.map((result, idx) => `
                <div class="result-card" data-categories="${result.requested_categories_en.join(',')}">
                    <div class="result-header">
                        <div class="result-title">
                            <span class="index-badge">#${result.index}</span>
                            <span>${result.filename}</span>
                        </div>
                        <span class="status-badge status-${result.status}">${result.status === 'success' ? '✅ Success' : '❌ Failed'}</span>
                    </div>
                    
                    ${result.status === 'success' ? `
                    <div class="images-section">
                        <div class="section-title">🖼️  Images</div>
                        <div class="images-grid">
                            <div class="original-section">
                                <div class="section-label">Original</div>
                                ${result.original_image_url ? 
                                    `<img src="${result.original_image_url}" class="original-image" alt="Original" onclick="openModal('${result.original_image_url}')" onerror="this.style.opacity='0.3'">` 
                                    : '<div style="padding:40px;background:#f0f0f0;border-radius:10px;color:#999;text-align:center;font-size:0.9em;">No image</div>'}
                            </div>
                            
                            <div class="cropped-section">
                                <div class="section-label">Cropped Items (${result.cropped_items})</div>
                                <div class="cropped-grid">
                                    ${Object.entries(result.cropped_image_urls || {}).map(([category, url]) => `
                                        <div class="cropped-item" onclick="openModal('${url}')">
                                            <div class="cropped-category">${category}</div>
                                            <img src="${url}" class="cropped-image" alt="${category}" onerror="this.style.opacity='0.3'">
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="timing-info">
                        <div class="timing-item">
                            <div class="timing-label">Crop</div>
                            <div class="timing-value">${result.crop_time}s</div>
                        </div>
                        <div class="timing-item">
                            <div class="timing-label">Search</div>
                            <div class="timing-value">${result.search_time}s</div>
                        </div>
                        <div class="timing-item">
                            <div class="timing-label">Total</div>
                            <div class="timing-value">${result.total_time}s</div>
                        </div>
                    </div>
                    
                    <div class="products">
                        <div class="section-title">🔍 Search Results</div>
                        ${Object.entries(result.search_results || {}).length > 0 ? 
                            Object.entries(result.search_results || {}).map(([category, products]) => `
                                <div class="product-category">
                                    <div class="category-title">
                                        ${category}
                                        <span class="result-count">${products.length}</span>
                                    </div>
                                    ${products.map(product => `
                                        <a href="${product.link}" target="_blank" class="product-link">
                                            ${product.thumbnail ? `<img src="${product.thumbnail}" class="product-thumbnail" onerror="this.style.display='none'">` : ''}
                                            <div class="product-info">
                                                <div class="product-title">${product.title || 'No title'}</div>
                                                <div class="product-domain">🌐 ${new URL(product.link).hostname}</div>
                                            </div>
                                        </a>
                                    `).join('')}
                                </div>
                            `).join('')
                            : '<div style="text-align:center;padding:20px;color:#999;">No search results</div>'}
                    </div>
                    ` : `
                    <div style="padding:20px;background:#f8d7da;color:#721c24;border-radius:10px;margin-top:15px;">
                        <strong>Error:</strong> ${result.error || 'Unknown error'}
                    </div>
                    `}
                </div>
            `).join('')}
        </div>
        
        <div id="no-results" class="no-results" style="display:none;">
            <div class="no-results-icon">🔍</div>
            <h2>No results found</h2>
            <p>Try a different filter</p>
        </div>
    </div>
    
    <!-- Modal for full-size images -->
    <div id="imageModal" class="modal" onclick="closeModal()">
        <span class="modal-close">&times;</span>
        <img id="modalImage" class="modal-content">
    </div>
    
    <script>
        function filterByCategory(category) {
            const cards = document.querySelectorAll('.result-card');
            const noResults = document.getElementById('no-results');
            const resultsContainer = document.getElementById('results-container');
            let visibleCount = 0;
            
            // Update button states
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            cards.forEach(card => {
                const categories = card.dataset.categories.split(',');
                if (category === 'all' || categories.includes(category)) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
            
            // Show/hide no results message
            if (visibleCount === 0) {
                resultsContainer.style.display = 'none';
                noResults.style.display = 'block';
            } else {
                resultsContainer.style.display = 'block';
                noResults.style.display = 'none';
            }
        }
        
        function openModal(src) {
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('modalImage');
            modal.classList.add('active');
            modalImg.src = src;
        }
        
        function closeModal() {
            document.getElementById('imageModal').classList.remove('active');
        }
        
        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    </script>
</body>
</html>
`;

fs.writeFileSync('public/batch-results-FINAL-nov5.html', html);
console.log('\n✅ Generated: public/batch-results-FINAL-nov5.html');
console.log(`📊 Stats: ${withResults}/64 with results, GPT=${sourceCounts.gpt}, Fallback=${sourceCounts.fallback}`);

