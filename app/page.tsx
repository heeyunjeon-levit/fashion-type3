'use client'

import { useState, useEffect } from 'react'
import ImageUpload from './components/ImageUpload'
import CroppedImageGallery from './components/CroppedImageGallery'
import InteractiveBboxSelector from './components/InteractiveBboxSelector'
import ResultsBottomSheet from './components/ResultsBottomSheet'
import LanguageToggle from './components/LanguageToggle'
import { getSessionManager } from '../lib/sessionManager'
import { usePageTracking } from '../lib/hooks/usePageTracking'
import { useLanguage } from './contexts/LanguageContext'

export interface DetectedItem {
  category: string
  groundingdino_prompt: string
  description: string
  croppedImageUrl?: string
  confidence?: number
}

interface BboxItem {
  id: string
  bbox: [number, number, number, number]
  category: string
  mapped_category: string
  confidence: number
  selected?: boolean
}

export default function Home() {
  const { t, language } = useLanguage()
  
  // Helper to translate category names
  const translateCategory = (category: string): string => {
    if (language !== 'ko') return category
    
    const translations: Record<string, string> = {
      'top': '상의',
      'tops': '상의',
      'bottom': '하의',
      'bottoms': '하의',
      'bag': '가방',
      'shoes': '신발',
      'accessory': '악세사리',
      'accessories': '악세사리',
      'dress': '드레스',
      'jacket': '재킷',
      'pants': '바지',
      'jeans': '청바지',
      'handbag': '핸드백',
      'belt': '벨트',
      'watch': '시계',
      'sunglasses': '선글라스',
      'necklace': '목걸이',
      'jewelry': '주얼리',
      'sweater': '스웨터',
      'boots': '부츠',
      'shorts': '반바지',
      'purse': '지갑',
      'ring': '반지',
      'earring': '귀걸이',
      'outerwear': '아우터',
      'button up shirt': '셔츠',
      'button_up_shirt': '셔츠'
    }
    
    return translations[category.toLowerCase()] || category
  }
  
  // Enable interactive mode by default (new UX)
  const [useInteractiveMode, setUseInteractiveMode] = useState(true)
  
  // V3.1 OCR Search toggle (advanced pipeline)
  const [useOCRSearch, setUseOCRSearch] = useState(false)
  const [ocrStep, setOcrStep] = useState<'extracting' | 'mapping' | 'searching' | 'selecting'>('extracting')
  
  const [currentStep, setCurrentStep] = useState<'upload' | 'detecting' | 'selecting' | 'processing' | 'gallery' | 'searching' | 'results'>('upload')
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('')
  const [bboxes, setBboxes] = useState<BboxItem[]>([])
  const [imageSize, setImageSize] = useState<[number, number]>([0, 0])
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([])
  const [selectedItems, setSelectedItems] = useState<DetectedItem[]>([])
  const [processingItems, setProcessingItems] = useState<{category: string}[]>([])
  const [results, setResults] = useState<Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [sessionManager, setSessionManager] = useState<any>(null)
  const [overallProgress, setOverallProgress] = useState(0)

  // Initialize progress when steps change
  useEffect(() => {
    if (currentStep === 'processing') {
      setOverallProgress(0)
    } else if (currentStep === 'results') {
      setOverallProgress(100)
    }
  }, [currentStep])

  // Smooth progress bar animation - gradually increment to create constant movement
  // This ensures progress only moves forward, never backwards
  // NOTE: Only runs for interactive mode, not OCR mode
  useEffect(() => {
    // Skip animation for OCR mode (it doesn't have real-time progress)
    if (useOCRSearch) {
      return
    }
    
    if (currentStep !== 'processing' && currentStep !== 'searching') {
      return
    }

    const interval = setInterval(() => {
      setOverallProgress(prev => {
        // Only move forward, never backwards
        // Gradually increment, but cap at 94% to leave room for real completion updates
        if (prev < 94) {
          // Very small increment for smooth, constant movement
          const increment = 0.1
          return Math.min(94, prev + increment)
        }
        return prev
      })
    }, 100) // Update every 100ms for smooth animation

    return () => clearInterval(interval)
  }, [currentStep, useOCRSearch])

  // Track page visits and user actions
  usePageTracking({
    uploadedImage: uploadedImageUrl !== '',
    completedAnalysis: detectedItems.length > 0,
    clickedSearch: Object.keys(results).length > 0
  })

  // Initialize session on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const manager = getSessionManager()
      setSessionManager(manager)
      console.log('Session ID:', manager.getSessionId())
      if (manager.isReturningUser()) {
        console.log('Welcome back! Phone:', manager.getPhoneNumber())
      }
    }
  }, [])

  const handleImageUploaded = async (imageUrl: string, uploadTimeSeconds?: number) => {
    // Prevent duplicate processing in React Strict Mode
    if (uploadedImageUrl === imageUrl) {
      console.log('⚠️  Duplicate upload detected, ignoring...')
      return
    }
    
    setUploadedImageUrl(imageUrl)
    
    // Log image upload and frontend timing
    if (sessionManager) {
      await sessionManager.logImageUpload(imageUrl)
      
      // Log frontend upload timing
      if (uploadTimeSeconds) {
        console.log(`⏱️  Frontend Upload: ${uploadTimeSeconds.toFixed(2)}s`)
        await sessionManager.logEvent('frontend_timing', {
          upload_seconds: parseFloat(uploadTimeSeconds.toFixed(3)),
          stage: 'image_upload'
        })
      }
    }

    // Fallback function for OCR when streaming fails
    const handleOCRSearchFallback = async (imageUrl: string) => {
      try {
        console.log('🔄 Using regular POST endpoint for OCR...')
        console.log('   Image URL:', imageUrl?.substring(0, 80))
        setOverallProgress(50) // Show some progress
        
        console.log('📤 Sending POST request to /api/search...')
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categories: [],
            croppedImages: {},
            originalImageUrl: imageUrl,
            useOCRSearch: true,
          }),
        })

        console.log('📥 Response received:', response.status, response.statusText)
        const data = await response.json()
        console.log('📦 Response data:', {
          success: data.meta?.success,
          resultsCount: Object.keys(data.results || {}).length,
          reason: data.meta?.reason
        })
        
        setOverallProgress(90)
        
        if (data.results && Object.keys(data.results).length > 0) {
          console.log('✅ OCR found results, displaying...')
          setResults(data.results)
          setOverallProgress(100)
          setCurrentStep('results')
        } else {
          console.log('⚠️ No results found')
          alert('텍스트를 찾을 수 없습니다. 다른 이미지를 시도해주세요.')
          setCurrentStep('upload')
        }
      } catch (error) {
        console.error('❌ OCR fallback error:', error)
        alert('OCR 검색 실패. 다시 시도해주세요.')
        setCurrentStep('upload')
      } finally {
        console.log('🏁 OCR search complete, setting isLoading to false')
        setIsLoading(false)
      }
    }

    // V3.1 OCR MODE: Skip detection, go directly to OCR search with full image
    if (useOCRSearch) {
      console.log('🚀 OCR Mode: Skipping detection, using full image for OCR search')
      setCurrentStep('searching')
      setIsLoading(true)
      setOverallProgress(0)
      
      try {
        console.log('🔍 Starting V3.1 OCR Search with real-time progress...')
        // Use GPU app (now working!)
        const backendUrl = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run'
        
        // Try streaming endpoint first for real-time progress
        try {
          const streamUrl = `${backendUrl}/ocr-search-stream?imageUrl=${encodeURIComponent(imageUrl)}`
          console.log('📡 Attempting streaming connection...')
          
          const eventSource = new EventSource(streamUrl)
          let streamActive = true
          
          // Set timeout for stream connection
          const streamTimeout = setTimeout(async () => {
            if (streamActive) {
              console.log('⏰ Stream timeout, falling back to regular endpoint...')
              eventSource.close()
              streamActive = false
              await handleOCRSearchFallback(imageUrl)
            }
          }, 10000) // 10 second timeout for stream to start
          
          eventSource.onmessage = (event) => {
            clearTimeout(streamTimeout)
            try {
              const data = JSON.parse(event.data)
              console.log('📊 OCR Progress:', data)
              
              if (data.type === 'progress') {
                setOverallProgress(data.progress)
                console.log(`Progress: ${data.progress}% - ${data.message}`)
              } else if (data.type === 'complete') {
                eventSource.close()
                streamActive = false
                
                if (data.success && data.results) {
                  // Transform OCR results to frontend format
                  const results: Record<string, any> = {}
                  
                  for (const productResult of data.results.product_results || []) {
                    const brand = productResult.product.brand
                    const productName = productResult.product.product_name || productResult.product.exact_ocr_text?.substring(0, 30) || 'Unknown'
                    const searchResult = productResult.search_result
                    
                    if (searchResult.success && searchResult.selected_results) {
                      const resultKey = `${brand} - ${productName}`.substring(0, 80)
                      results[resultKey] = searchResult.selected_results.map((r: any) => ({
                        title: r.title || 'Product',
                        link: r.link || '',
                        thumbnail: r.thumbnail || r.image || null
                      }))
                    }
                  }
                  
                  setResults(results)
                  
                  if (sessionManager) {
                    sessionManager.logSearchResults(results, { 
                      mode: 'ocr_v3.1_stream',
                      ocr_mapping: data.results.mapping,
                      summary: data.results.summary
                    })
                  }
                  
                  setOverallProgress(100)
                  setCurrentStep('results')
                } else {
                  console.error('OCR search failed:', data.reason)
                  alert(`OCR 검색 실패: ${data.reason || 'Unknown error'}`)
                  setCurrentStep('upload')
                }
                setIsLoading(false)
              } else if (data.type === 'error') {
                eventSource.close()
                streamActive = false
                console.error('OCR error:', data.message)
                alert(`OCR 오류: ${data.message}`)
                setCurrentStep('upload')
                setIsLoading(false)
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e, 'Raw data:', event.data)
              // Continue - might be a partial message
            }
          }
          
          eventSource.onerror = async (error) => {
            clearTimeout(streamTimeout)
            if (!streamActive) return
            
            console.error('EventSource error:', error)
            eventSource.close()
            streamActive = false
            
            // Fall back to regular POST endpoint
            console.log('⚠️ Stream failed, using regular POST endpoint...')
            await handleOCRSearchFallback(imageUrl)
          }
          
          return
        } catch (streamError) {
          console.error('Stream setup error:', streamError)
          // Fall back to regular endpoint
          await handleOCRSearchFallback(imageUrl)
          return
        }
        
      } catch (error) {
        console.error('Error in OCR search:', error)
        alert('OCR 검색 중 오류가 발생했습니다. 다시 시도해주세요.')
        setCurrentStep('upload')
        setIsLoading(false)
      }
      return
    }

    if (useInteractiveMode) {
      // INTERACTIVE MODE: Fast detection first, user selects, then process
      setCurrentStep('detecting')
      
      try {
        console.log('⚡ Starting fast DINO-X detection...')
        // Use GPU app (now working with DINO-X API)
        const backendUrl = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run'
        const detectResponse = await fetch(`${backendUrl}/detect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl }),
        })

        if (!detectResponse.ok) {
          throw new Error(`Detection failed: ${detectResponse.status}`)
        }

        const detectData = await detectResponse.json()
        
        console.log(`✅ Detection complete: ${detectData.bboxes?.length || 0} items found in ${detectData.processing_time}s`)
        console.log('📦 Detection data:', {
          bboxes: detectData.bboxes,
          image_size: detectData.image_size,
          imageUrl: imageUrl
        })
        setBboxes(detectData.bboxes || [])
        setImageSize(detectData.image_size || [0, 0])
        
        setCurrentStep('selecting')
      } catch (error) {
        console.error('❌ Detection error:', error)
        alert('Failed to detect items. Please try again.')
        setCurrentStep('upload')
      }
    } else {
      // OLD: Original mode - analyze + crop everything immediately
      setCurrentStep('detecting')

      try {
        console.log('🚀 Starting AI analysis and cropping...')
        const analyzeResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl }),
        })

        const analyzeData = await analyzeResponse.json()
        
        if (analyzeData.items && analyzeData.items.length > 0) {
          console.log(`✅ Analysis complete: ${analyzeData.items.length} items detected and cropped`)
          setDetectedItems(analyzeData.items)

          // Log backend timing if available (in chronological order)
          if (analyzeData.timing) {
            console.log('⏱️  Backend Timing:', {
              '1_download': `${analyzeData.timing.download_seconds}s`,
              '2_gpt4o': `${analyzeData.timing.gpt4o_seconds}s`,
              '3_groundingdino': `${analyzeData.timing.groundingdino_seconds}s`,
              '4_processing': `${analyzeData.timing.processing_seconds}s`,
              '5_upload': `${analyzeData.timing.upload_seconds}s`,
              '6_overhead': `${analyzeData.timing.overhead_seconds}s`,
              '7_total': `${analyzeData.timing.total_seconds}s`
            })
          }

          // Log GPT analysis
          if (sessionManager) {
            await sessionManager.logGPTAnalysis(analyzeData)
            await sessionManager.logCroppedImages(analyzeData.items)
            
            // Log backend timing as a separate event (chronological order)
            if (analyzeData.timing) {
              await sessionManager.logEvent('backend_timing', {
                download_seconds: analyzeData.timing.download_seconds,
                gpt4o_seconds: analyzeData.timing.gpt4o_seconds,
                groundingdino_seconds: analyzeData.timing.groundingdino_seconds,
                processing_seconds: analyzeData.timing.processing_seconds,
                upload_seconds: analyzeData.timing.upload_seconds,
                overhead_seconds: analyzeData.timing.overhead_seconds,
                total_seconds: analyzeData.timing.total_seconds
              })
            }
          }
        } else {
          console.log('⚠️ No items detected by AI')
          setDetectedItems([])
          if (sessionManager) {
            await sessionManager.logGPTAnalysis({ items: [] })
          }
        }
      } catch (error) {
        console.error('❌ Analysis error:', error)
        // Continue anyway with empty detected items
        setDetectedItems([])
      } finally {
        setCurrentStep('gallery')
      }
    }
  }

  // Handler for interactive bbox selection
  const handleBboxSelectionChange = (updatedBboxes: BboxItem[]) => {
    console.log(`Selected ${updatedBboxes.filter(b => b.selected).length} items`)
    // Update parent state with selection changes
    setBboxes(updatedBboxes)
  }

  // Handler for confirming bbox selection (process selected items)
  const handleBboxSelectionConfirm = async () => {
    const selectedBboxes = bboxes.filter(b => b.selected)
    
    if (selectedBboxes.length === 0) {
      alert('Please select at least one item')
      return
    }

    // Set items for progress tracking
    setProcessingItems(selectedBboxes.map(bbox => ({ category: bbox.category })))
    
    setCurrentStep('processing')
    console.log(`🎯 Processing ${selectedBboxes.length} selected items...`)

    try {
      // Process ALL items in parallel for efficiency with real-time progress tracking
      console.log(`🚀 Processing ${selectedBboxes.length} items in parallel...`)
      
      const totalItems = selectedBboxes.length
      let completedItems = 0
      
      const processingPromises = selectedBboxes.map(async (bbox) => {
        console.log(`Processing ${bbox.category}...`)
        
        try {
          const backendUrl = 'https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run'
          const processResponse = await fetch(`${backendUrl}/process-item`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageUrl: uploadedImageUrl,
              bbox: bbox.bbox,
              category: bbox.category
            }),
          })

          if (!processResponse.ok) {
            console.error(`Failed to process ${bbox.category}: ${processResponse.status}`)
            completedItems++
            // Update progress: processing is 20% of total, so each item = 20% / totalItems
            const targetProgress = Math.min(20, (completedItems / totalItems) * 20)
            setOverallProgress(prev => Math.max(prev, targetProgress))
            return null
          }

          const processData = await processResponse.json()
          console.log(`✅ Processed ${bbox.category} in ${processData.processing_time}s`, {
            description: processData.description?.substring(0, 50) + '...',
            croppedImageUrl: processData.croppedImageUrl?.substring(0, 80) + '...',
            category: processData.category
          })

          // Update real-time progress
          completedItems++
          const targetProgress = Math.min(20, (completedItems / totalItems) * 20)
          setOverallProgress(prev => Math.max(prev, targetProgress))
          console.log(`📊 Processing progress: ${completedItems}/${totalItems} items (${Math.floor((completedItems / totalItems) * 20)}%)`)

          // Convert to DetectedItem format
          const detectedItem = {
            category: processData.category,
            groundingdino_prompt: bbox.category,
            description: processData.description,
            croppedImageUrl: processData.croppedImageUrl,
            confidence: bbox.confidence
          }
          
          console.log('📦 DetectedItem created:', {
            category: detectedItem.category,
            hasDescription: !!detectedItem.description,
            hasCroppedUrl: !!detectedItem.croppedImageUrl,
            croppedUrlLength: detectedItem.croppedImageUrl?.length
          })
          
          return detectedItem
        } catch (error) {
          console.error(`Error processing ${bbox.category}:`, error)
          completedItems++
          const targetProgress = Math.min(20, (completedItems / totalItems) * 20)
          setOverallProgress(prev => Math.max(prev, targetProgress))
          return null
        }
      })

      // Wait for all processing to complete
      const results = await Promise.all(processingPromises)
      const processedItems = results.filter(item => item !== null) as DetectedItem[]

      console.log(`✅ All items processed in parallel: ${processedItems.length}/${selectedBboxes.length}`)
      // Ensure we're at least 20% after processing completes
      setOverallProgress(prev => Math.max(prev, 20))
      setDetectedItems(processedItems)
      setSelectedItems(processedItems)

      // Now search with processed items
      await handleItemsSelected(processedItems)

    } catch (error) {
      console.error('❌ Processing error:', error)
      alert('Failed to process selected items. Please try again.')
      setCurrentStep('selecting')
    }
  }

  const handleItemsSelected = async (items: DetectedItem[]) => {
    setSelectedItems(items)
    // Also set processingItems if not already set (for progress bars)
    if (processingItems.length === 0) {
      setProcessingItems(items.map(item => ({ category: item.category })))
    }
    setCurrentStep('searching')
    setIsLoading(true)

    // Log user selection
    if (sessionManager) {
      await sessionManager.logItemSelection(items)
    }

    try {
      // Search each item individually for real-time progress tracking
      console.log(`🔍 Searching ${items.length} items with real-time progress...`)
      
      const totalItems = items.length
      let completedSearches = 0
      const allResults: Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>> = {}
      
      // Process searches in parallel but track completion
      const searchPromises = items.map(async (item, idx) => {
        if (!item.croppedImageUrl) return null
        
        // Use the specific item name (groundingdino_prompt) instead of broad category
        const itemName = item.groundingdino_prompt || item.category
        const key = `${itemName}_${idx + 1}`
        
        // If cropped URL is a data URL, upload it to Supabase first
        let croppedUrl = item.croppedImageUrl
        if (croppedUrl && croppedUrl.startsWith('data:')) {
          console.log(`📤 Uploading data URL to Supabase for ${itemName}...`)
          try {
            const uploadResponse = await fetch('/api/upload-cropped', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dataUrl: croppedUrl, category: itemName })
            })
            const uploadData = await uploadResponse.json()
            if (uploadData.url) {
              croppedUrl = uploadData.url
              console.log(`✅ Uploaded to Supabase: ${croppedUrl.substring(0, 60)}...`)
            }
          } catch (uploadError) {
            console.error(`⚠️ Failed to upload ${itemName}, using data URL:`, uploadError)
          }
        }
        
        const croppedImages = { [key]: croppedUrl }
        const categories = [item.category]
        
        try {
          console.log(`🔍 Searching for ${itemName}...`)
          
          const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              categories,
              croppedImages,
              originalImageUrl: uploadedImageUrl,
              useOCRSearch: useOCRSearch,
            }),
          })

          const data = await response.json()
          
          // Update real-time progress: searching is 75% (from 20% to 95%)
          completedSearches++
          const targetProgress = Math.min(95, 20 + (completedSearches / totalItems) * 75)
          setOverallProgress(prev => Math.max(prev, targetProgress))
          console.log(`📊 Search progress: ${completedSearches}/${totalItems} items (${Math.floor(20 + (completedSearches / totalItems) * 75)}%)`)
          
          // Merge results
          if (data.results) {
            Object.entries(data.results).forEach(([category, links]) => {
              allResults[category] = links as Array<{ link: string; thumbnail: string | null; title: string | null }>
            })
          }
          
          return data
        } catch (error) {
          console.error(`Error searching ${itemName}:`, error)
          completedSearches++
          const targetProgress = Math.min(95, 20 + (completedSearches / totalItems) * 75)
          setOverallProgress(prev => Math.max(prev, targetProgress))
          return null
        }
      })
      
      // Wait for all searches to complete
      await Promise.all(searchPromises)
      
      console.log(`✅ All searches complete: ${completedSearches}/${totalItems}`)
      setOverallProgress(prev => Math.max(prev, 95)) // Ensure we're at least 95%
      setResults(allResults)
      
      // Log combined search results
      if (sessionManager) {
        await sessionManager.logSearchResults(allResults, { 
          mode: 'real_time_parallel_search',
          totalItems: totalItems,
          completedSearches: completedSearches
        })
      }
      
      setCurrentStep('results')
    } catch (error) {
      console.error('Error fetching results:', error)
      alert('An error occurred while processing your request')
      setCurrentStep(useInteractiveMode ? 'selecting' : 'gallery')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    // Go back to appropriate selection step without losing data
    if (useInteractiveMode) {
      setCurrentStep('selecting')
    } else {
      setCurrentStep('gallery')
    }
  }

  const handleResearch = async () => {
    // Re-run search with the same selected items
    if (selectedItems.length === 0) {
      console.warn('No items selected to research')
      return
    }
    
    console.log('🔄 Re-running search with same items...')
    await handleItemsSelected(selectedItems)
  }

  const handleReset = () => {
    setCurrentStep('upload')
    setUploadedImageUrl('')
    setDetectedItems([])
    setSelectedItems([])
    setProcessingItems([])
    setOverallProgress(0)
    setResults({})
  }

  // Build croppedImages map for Results component
  const croppedImagesForResults: Record<string, string> = {}
  selectedItems.forEach((item, idx) => {
    if (item.croppedImageUrl) {
      // Use the specific item name to match search results keys
      const itemName = item.groundingdino_prompt || item.category
      const key = `${itemName}_${idx + 1}`
      croppedImagesForResults[key] = item.croppedImageUrl
    }
  })

  return (
    <main className="min-h-screen bg-white">
      {/* Language Toggle - show on all pages except results */}
      {currentStep !== 'results' && <LanguageToggle />}
      
      <div className="container mx-auto px-4 py-8">
        {currentStep === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <ImageUpload onImageUploaded={handleImageUploaded} />
            
            {/* V3.1 OCR Search Toggle */}
            <div className="relative inline-block w-full">
              {/* Outer container for gradient border */}
              <div className="absolute -inset-[3px] rounded-[20px] overflow-hidden">
                {/* Large rotating gradient (scaled up to hide corners) */}
                <div 
                  className="absolute inset-[-500%] animate-gradient-rotate"
                  style={{
                    background: 'conic-gradient(from 0deg at 50% 50%, #F5A623, #FF6B9D, #C644FC, #00C7BE, #F5A623)'
                  }}
                />
              </div>
              
              {/* White background to create border effect */}
              <div className="absolute inset-0 bg-white rounded-2xl"></div>
              
              {/* Content container */}
              <div className="relative bg-white rounded-2xl p-2">
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <p className="text-sm font-bold text-gray-700 text-center">업로드하시는 사진에 상품명 혹은 브랜드명이 적혀있나요?</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setUseOCRSearch(true)}
                      className={`py-2 px-6 rounded-xl font-semibold text-sm transition-all ${
                        useOCRSearch
                          ? 'bg-black text-white shadow-lg'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      예
                    </button>
                    <button
                      onClick={() => setUseOCRSearch(false)}
                      className={`py-2 px-6 rounded-xl font-semibold text-sm transition-all ${
                        !useOCRSearch
                          ? 'bg-black text-white shadow-lg'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      아니오
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {currentStep === 'detecting' && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="text-center space-y-6">
                {/* Image with animated gradient border (Apple Intelligence style) */}
                <div className="relative inline-block">
                  {/* Outer container for gradient border */}
                  <div className="absolute -inset-[3px] rounded-[20px] overflow-hidden">
                    {/* Large rotating gradient (scaled up to hide corners) */}
                    <div 
                      className="absolute inset-[-100%] animate-gradient-rotate"
                      style={{
                        background: 'conic-gradient(from 0deg at 50% 50%, #ec4899 0deg, #ffffff 30deg, #a855f7 60deg, #8b5cf6 90deg, #ffffff 120deg, #6366f1 150deg, #3b82f6 180deg, #ffffff 210deg, #06b6d4 240deg, #ec4899 270deg, #ffffff 300deg, #ec4899 360deg)'
                      }}
                    />
                  </div>
                  
                  {/* White background to create border effect */}
                  <div className="absolute inset-0 bg-white rounded-2xl"></div>
                  
                  {/* Image container */}
                  <div className="relative bg-white rounded-2xl p-2">
                    <img
                      src={uploadedImageUrl}
                      alt="Detecting"
                      className="w-full h-96 object-contain rounded-xl"
                    />
                  </div>
                </div>

                {/* Text */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-black">
                    {useInteractiveMode ? 'AI 분석중...' : t('analyzing.title')}
                  </h2>
                  <p className="text-gray-600">
                    {useInteractiveMode ? '이미지에서 패션템을 찾고 있어요' : t('analyzing.subtitle')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'selecting' && (
          <div className="max-w-4xl mx-auto mt-8">
            <InteractiveBboxSelector
              imageUrl={uploadedImageUrl}
              bboxes={bboxes}
              imageSize={imageSize}
              onSelectionChange={handleBboxSelectionChange}
              onConfirm={handleBboxSelectionConfirm}
            />
          </div>
        )}

        {currentStep === 'processing' && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white rounded-2xl shadow-xl p-12 border border-gray-100">
              <div className="text-center space-y-6">
                <h2 className="text-2xl font-bold text-black">선택하신 패션템을 찾고 있어요!</h2>
                {/* Single overall progress bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center text-sm text-gray-500">
                    {Math.floor(overallProgress)}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-black h-full rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${overallProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'gallery' && (
          <CroppedImageGallery
            imageUrl={uploadedImageUrl}
            detectedItems={detectedItems}
            onItemsSelected={handleItemsSelected}
            onBack={() => setCurrentStep('upload')}
          />
        )}
        
        {currentStep === 'searching' && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white rounded-2xl shadow-xl p-12 border border-gray-100">
              <div className="text-center space-y-6">
                <h2 className="text-2xl font-bold text-black">선택하신 패션템을 찾고 있어요!</h2>
                
                {/* Real-time progress bar for both modes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center text-sm text-gray-500">
                    {Math.floor(overallProgress)}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-black h-full rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${overallProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {currentStep === 'results' && (
          <ResultsBottomSheet
            results={results}
            isLoading={isLoading}
            croppedImages={croppedImagesForResults}
            originalImageUrl={uploadedImageUrl}
            onReset={handleReset}
            onBack={handleBack}
            onResearch={handleResearch}
            selectedItems={selectedItems}
          />
        )}
      </div>
    </main>
  )
}

