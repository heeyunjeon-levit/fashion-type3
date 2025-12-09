import { promises as fs } from 'fs'
import path from 'path'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface Product {
  link: string
  thumbnail: string | null
  title: string | null
}

interface SearchResults {
  results: Record<string, Product[]>
}

interface AnalysisItem {
  category: string
  groundingdino_prompt: string
  description: string
  croppedImageUrl?: string
}

interface ProcessingResult {
  image_name: string
  image_url: string
  processing_time_seconds: number
  success: boolean
  analysis?: {
    items: AnalysisItem[]
  }
  search?: SearchResults
}

async function getResults() {
  try {
    const brandsResultsDir = path.join(process.cwd(), 'brands_results')
    
    // Read both batch and retry results
    const batchData = await fs.readFile(
      path.join(brandsResultsDir, 'brands_batch_20251121_084948.json'),
      'utf8'
    )
    const retryData = await fs.readFile(
      path.join(brandsResultsDir, 'brands_retry_20251121_090022.json'),
      'utf8'
    )
    
    const batch = JSON.parse(batchData)
    const retry = JSON.parse(retryData)
    
    // Combine successful results
    const allResults: ProcessingResult[] = []
    
    batch.results.forEach((result: ProcessingResult) => {
      if (result.success) allResults.push(result)
    })
    
    retry.results.forEach((result: ProcessingResult) => {
      if (result.success) allResults.push(result)
    })
    
    return {
      results: allResults,
      totalImages: batch.total_images,
      successful: allResults.length
    }
  } catch (error) {
    console.error('Error loading results:', error)
    return { results: [], totalImages: 0, successful: 0 }
  }
}

export default async function BrandsReportPage() {
  const { results, totalImages, successful } = await getResults()
  
  // Calculate stats
  const totalItems = results.reduce((sum, r) => sum + (r.analysis?.items?.length || 0), 0)
  const totalProducts = results.reduce((sum, r) => {
    const searchResults = r.search?.results || {}
    return sum + Object.values(searchResults).reduce((s, products) => s + products.length, 0)
  }, 0)
  
  const categoryCount: Record<string, number> = {}
  results.forEach(r => {
    r.analysis?.items?.forEach(item => {
      const cat = item.category
      categoryCount[cat] = (categoryCount[cat] || 0) + 1
    })
  })
  
  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '40px',
          marginBottom: '30px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ fontSize: '2.5em', color: '#2d3748', marginBottom: '10px' }}>
            🎨 Brand Images Processing Results
          </h1>
          <p style={{ color: '#718096', fontSize: '1.1em', marginTop: '10px' }}>
            Processed {totalImages} images through AI fashion detection pipeline
          </p>
          
          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginTop: '30px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3em', fontWeight: 'bold' }}>{successful}</div>
              <div style={{ fontSize: '0.9em', opacity: 0.9 }}>Successful Images</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3em', fontWeight: 'bold' }}>{totalItems}</div>
              <div style={{ fontSize: '0.9em', opacity: 0.9 }}>Fashion Items Detected</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3em', fontWeight: 'bold' }}>{totalProducts}</div>
              <div style={{ fontSize: '0.9em', opacity: 0.9 }}>Product Links Found</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3em', fontWeight: 'bold' }}>
                {((successful / totalImages) * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.9em', opacity: 0.9 }}>Success Rate</div>
            </div>
          </div>
          
          {/* Categories */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
            <span style={{ color: '#2d3748', fontWeight: 'bold' }}>Categories detected:</span>
            {Object.entries(categoryCount)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <span key={cat} style={{
                  background: '#e2e8f0',
                  padding: '8px 15px',
                  borderRadius: '20px',
                  fontSize: '0.9em',
                  color: '#4a5568'
                }}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}: {count}
                </span>
              ))}
          </div>
        </div>
        
        {/* Results Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '25px'
        }}>
          {results.map((result, idx) => {
            const items = result.analysis?.items || []
            const searchResults = result.search?.results || {}
            
            return (
              <div key={idx} style={{
                background: 'white',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
              }}>
                {/* Image */}
                <div style={{ position: 'relative', width: '100%', height: '300px', background: '#f7fafc' }}>
                  <img 
                    src={result.image_url} 
                    alt={result.image_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '15px',
                    left: '15px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px 15px',
                    borderRadius: '20px',
                    fontWeight: 'bold',
                    fontSize: '0.9em'
                  }}>
                    #{idx + 1}
                  </div>
                </div>
                
                {/* Content */}
                <div style={{ padding: '25px' }}>
                  <div style={{
                    fontSize: '0.8em',
                    color: '#718096',
                    marginBottom: '15px',
                    wordBreak: 'break-all'
                  }}>
                    {result.image_name}
                  </div>
                  
                  {/* Detected Items */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '1.1em',
                      fontWeight: 'bold',
                      color: '#2d3748',
                      marginBottom: '15px'
                    }}>
                      🔍 {items.length} Item{items.length !== 1 ? 's' : ''} Detected
                    </div>
                    
                    {items.map((item, itemIdx) => (
                      <div key={itemIdx} style={{
                        background: '#f7fafc',
                        padding: '15px',
                        borderRadius: '12px',
                        marginBottom: '10px',
                        borderLeft: '4px solid #667eea'
                      }}>
                        <div style={{
                          fontWeight: 'bold',
                          color: '#667eea',
                          textTransform: 'capitalize',
                          marginBottom: '5px'
                        }}>
                          {item.category}
                        </div>
                        <div style={{
                          color: '#4a5568',
                          fontSize: '0.9em',
                          lineHeight: '1.5'
                        }}>
                          {item.description || item.groundingdino_prompt}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Products */}
                  <div style={{ marginTop: '20px' }}>
                    <div style={{
                      fontSize: '1.1em',
                      fontWeight: 'bold',
                      color: '#2d3748',
                      marginBottom: '15px'
                    }}>
                      🛍️ Product Matches
                    </div>
                    
                    {Object.entries(searchResults).map(([categoryKey, products]) => (
                      <div key={categoryKey} style={{ marginBottom: '20px' }}>
                        <div style={{
                          fontSize: '0.9em',
                          color: '#667eea',
                          fontWeight: 'bold',
                          marginBottom: '10px'
                        }}>
                          {categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '10px'
                        }}>
                          {products.slice(0, 3).map((product, pIdx) => (
                            <a
                              key={pIdx}
                              href={product.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: '#fff',
                                border: '2px solid #e2e8f0',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                textDecoration: 'none',
                                color: 'inherit',
                                display: 'block',
                                transition: 'all 0.3s ease'
                              }}
                            >
                              <div style={{
                                width: '100%',
                                height: '120px',
                                background: '#f7fafc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                              }}>
                                {product.thumbnail ? (
                                  <img 
                                    src={product.thumbnail} 
                                    alt={product.title || 'Product'}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <div style={{ fontSize: '2em', color: '#cbd5e0' }}>📦</div>
                                )}
                              </div>
                              <div style={{
                                padding: '10px',
                                fontSize: '0.75em',
                                color: '#4a5568',
                                lineHeight: '1.3',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {product.title || 'View Product'}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Processing Time */}
                  <div style={{
                    display: 'inline-block',
                    background: '#48bb78',
                    color: 'white',
                    padding: '5px 12px',
                    borderRadius: '15px',
                    fontSize: '0.85em',
                    marginTop: '10px'
                  }}>
                    ⏱️ {result.processing_time_seconds.toFixed(1)}s
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Footer */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '30px',
          marginTop: '30px',
          textAlign: 'center',
          color: '#718096'
        }}>
          <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
          <p style={{ marginTop: '10px' }}>AI Fashion Detection Pipeline • GPT-4o + GroundingDINO + Serper + GPT-4 Turbo</p>
        </div>
      </div>
    </div>
  )
}
