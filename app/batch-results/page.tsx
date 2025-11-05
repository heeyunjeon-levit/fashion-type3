'use client'

import { useEffect, useState } from 'react'

export default function BatchResultsPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white">
      <div className="text-2xl">Loading results...</div>
    </div>
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Batch2 Test Results</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; min-height: 100vh; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
        header h1 { font-size: 32px; margin-bottom: 10px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
        .stat-card { background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; backdrop-filter: blur(10px); }
        .stat-label { font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }
        .stat-value { font-size: 28px; font-weight: bold; margin-top: 5px; }
        .filters { padding: 20px 30px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; display: flex; gap: 15px; flex-wrap: wrap; align-items: center; }
        .filter-group { display: flex; gap: 8px; align-items: center; }
        .filter-btn { padding: 8px 16px; border: 2px solid #667eea; background: white; color: #667eea; border-radius: 20px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s; }
        .filter-btn.active { background: #667eea; color: white; }
        .filter-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); }
        .search-box { flex: 1; min-width: 300px; padding: 10px 16px; border: 2px solid #e9ecef; border-radius: 20px; font-size: 14px; }
        .search-box:focus { outline: none; border-color: #667eea; }
        .results-container { padding: 30px; max-height: 80vh; overflow-y: auto; }
        .result-card { background: white; border: 2px solid #e9ecef; border-radius: 12px; padding: 25px; margin-bottom: 20px; transition: all 0.3s; }
        .result-card:hover { border-color: #667eea; box-shadow: 0 8px 24px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .result-card.failed { border-color: #dc3545; background: #fff5f5; }
        .result-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
        .filename { font-size: 18px; font-weight: bold; color: #2d3748; margin-bottom: 8px; word-break: break-all; }
        .metadata { display: flex; gap: 15px; flex-wrap: wrap; font-size: 14px; color: #718096; }
        .status-badge { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .status-success { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .timing-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .timing-item { text-align: center; }
        .timing-label { font-size: 11px; color: #718096; text-transform: uppercase; }
        .timing-value { font-size: 18px; font-weight: bold; color: #2d3748; }
        .images-section { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 12px; }
        .images-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .image-container { background: white; padding: 12px; border-radius: 8px; border: 2px solid #e9ecef; }
        .image-label { font-size: 12px; color: #718096; text-transform: uppercase; font-weight: 600; margin-bottom: 8px; }
        .preview-image { width: 100%; height: auto; max-height: 300px; object-fit: contain; border-radius: 6px; background: #f8f9fa; cursor: pointer; }
        .category-results { margin-bottom: 20px; }
        .category-header { font-size: 16px; font-weight: bold; color: #2d3748; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #667eea; }
        .link-item { display: flex; align-items: flex-start; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px; gap: 12px; }
        .link-thumbnail { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; flex-shrink: 0; background: #e9ecef; }
        .link-content { flex: 1; min-width: 0; }
        .link-title { font-size: 14px; font-weight: 500; color: #2d3748; margin-bottom: 4px; }
        .link-url { font-size: 12px; color: #667eea; text-decoration: none; word-break: break-all; display: block; }
        .link-url:hover { text-decoration: underline; }
        .no-results { padding: 20px; text-align: center; color: #718096; font-style: italic; }
        .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); align-items: center; justify-content: center; }
        .modal.active { display: flex; }
        .modal-content { max-width: 90%; max-height: 90%; object-fit: contain; }
        .modal-close { position: absolute; top: 20px; right: 40px; color: white; font-size: 40px; cursor: pointer; }
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .timing-grid { grid-template-columns: repeat(2, 1fr); }
            .images-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 Batch2 Test Results</h1>
            <p id="subtitle">Loading...</p>
            <div class="stats-grid" id="stats-grid"></div>
        </header>
        <div class="filters">
            <div class="filter-group">
                <span style="font-weight: 600;">Status:</span>
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="success">Success</button>
                <button class="filter-btn" data-filter="failed">Failed</button>
            </div>
            <input type="text" class="search-box" id="search-box" placeholder="🔍 Search...">
        </div>
        <div class="results-container" id="results-container"></div>
    </div>
    <div class="modal" id="imageModal">
        <span class="modal-close" onclick="closeModal()">&times;</span>
        <img class="modal-content" id="modalImage">
    </div>
    <script>
        const RESULTS_DATA = '/batch-results-data.json';
        let allResults = [];
        let currentFilter = 'all';
        
        async function loadResults() {
            try {
                const res = await fetch(RESULTS_DATA);
                allResults = await res.json();
                displayStats();
                displayResults();
            } catch(e) {
                document.getElementById('results-container').innerHTML = '<div class="no-results">Error loading data</div>';
            }
        }
        
        function displayStats() {
            const successful = allResults.filter(r => r.status === 'success').length;
            const failed = allResults.filter(r => r.status === 'failed').length;
            const avgTime = (allResults.reduce((s,r) => s + parseFloat(r.total_time || 0), 0) / allResults.length).toFixed(2);
            const totalLinks = allResults.reduce((s, r) => {
                if (r.search_results) return s + Object.values(r.search_results).reduce((sum, links) => sum + (links?.length || 0), 0);
                return s;
            }, 0);
            
            document.getElementById('subtitle').textContent = \`Testing \${allResults.length} images from batch2\`;
            document.getElementById('stats-grid').innerHTML = \`
                <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">\${allResults.length}</div></div>
                <div class="stat-card"><div class="stat-label">✅ Success</div><div class="stat-value">\${successful}</div></div>
                <div class="stat-card"><div class="stat-label">❌ Failed</div><div class="stat-value">\${failed}</div></div>
                <div class="stat-card"><div class="stat-label">Avg Time</div><div class="stat-value">\${avgTime}s</div></div>
                <div class="stat-card"><div class="stat-label">Links Found</div><div class="stat-value">\${totalLinks}</div></div>
                <div class="stat-card"><div class="stat-label">Success Rate</div><div class="stat-value">\${((successful/allResults.length)*100).toFixed(1)}%</div></div>
            \`;
        }
        
        function openModal(src) { document.getElementById('imageModal').classList.add('active'); document.getElementById('modalImage').src = src; }
        function closeModal() { document.getElementById('imageModal').classList.remove('active'); }
        
        function displayResults() {
            const term = document.getElementById('search-box').value.toLowerCase();
            let filtered = allResults.filter(r => {
                if (currentFilter !== 'all' && r.status !== currentFilter) return false;
                if (term && !r.filename.toLowerCase().includes(term) && !r.phone?.toLowerCase().includes(term)) return false;
                return true;
            });
            
            if (!filtered.length) {
                document.getElementById('results-container').innerHTML = '<div class="no-results">No results</div>';
                return;
            }
            
            document.getElementById('results-container').innerHTML = filtered.map((r, i) => {
                let imgs = '';
                if (r.cropped_urls && Object.keys(r.cropped_urls).length) {
                    imgs = '<div class="images-section"><div class="images-grid">' + 
                        Object.entries(r.cropped_urls).map(([cat, url]) => 
                            \`<div class="image-container"><div class="image-label">✂️ \${cat}</div><img src="\${url}" class="preview-image" onclick="openModal('\${url}')"></div>\`
                        ).join('') + '</div></div>';
                }
                
                let links = '';
                if (r.search_results && Object.keys(r.search_results).length) {
                    links = '<div style="margin-top:20px">';
                    for (const [cat, lnks] of Object.entries(r.search_results)) {
                        if (lnks?.length) {
                            links += \`<div class="category-results"><div class="category-header">📦 \${cat} (\${lnks.length})</div>\`;
                            links += lnks.map(l => {
                                const url = typeof l === 'string' ? l : (l.link || l.url);
                                const title = typeof l === 'object' ? l.title : '';
                                const thumb = typeof l === 'object' ? l.thumbnail : '';
                                return \`<div class="link-item">
                                    \${thumb ? \`<img src="\${thumb}" class="link-thumbnail">\` : ''}
                                    <div class="link-content">
                                        \${title ? \`<div class="link-title">\${title}</div>\` : ''}
                                        <a href="\${url}" target="_blank" class="link-url">\${url}</a>
                                    </div>
                                </div>\`;
                            }).join('');
                            links += '</div>';
                        }
                    }
                    links += '</div>';
                }
                
                return \`<div class="result-card \${r.status === 'failed' ? 'failed' : ''}">
                    <div class="result-header">
                        <div><div class="filename">\${i+1}. \${r.filename}</div>
                        <div class="metadata">\${r.phone ? \`📞 \${r.phone}\` : ''} 🎯 \${r.requested_categories}</div></div>
                        <span class="status-badge status-\${r.status}">\${r.status}</span>
                    </div>
                    \${r.status === 'success' ? \`<div class="timing-grid">
                        <div class="timing-item"><div class="timing-label">Upload</div><div class="timing-value">\${r.upload_time}s</div></div>
                        <div class="timing-item"><div class="timing-label">Crop</div><div class="timing-value">\${r.crop_time}s</div></div>
                        <div class="timing-item"><div class="timing-label">Search</div><div class="timing-value">\${r.search_time}s</div></div>
                        <div class="timing-item"><div class="timing-label">Total</div><div class="timing-value">\${r.total_time}s</div></div>
                    </div>\` : ''}
                    \${imgs}\${links}
                </div>\`;
            }).join('');
        }
        
        document.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', e => {
            document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            displayResults();
        }));
        
        document.getElementById('search-box').addEventListener('input', displayResults);
        document.getElementById('imageModal').addEventListener('click', e => { if (e.target.id === 'imageModal') closeModal(); });
        
        loadResults();
    </script>
</body>
</html>
    ` }} />
  )
}

