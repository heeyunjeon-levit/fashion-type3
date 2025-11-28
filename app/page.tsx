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
  const { t } = useLanguage()
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
  const [results, setResults] = useState<Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [sessionManager, setSessionManager] = useState<any>(null)

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

    // V3.1 OCR MODE: Skip detection, go directly to OCR search with full image
      if (useOCRSearch) {
        console.log('🚀 OCR Mode: Skipping detection, using full image for OCR search')
        setCurrentStep('searching')
        setIsLoading(true)
        setOcrStep('extracting')
        
        // Simulate progress through OCR steps (approximate timing)
        setTimeout(() => setOcrStep('mapping'), 15000)    // 15s: OCR extraction
        setTimeout(() => setOcrStep('searching'), 45000)  // 45s: Brand mapping done
        setTimeout(() => setOcrStep('selecting'), 150000) // 2.5min: Searches complete
      
      try {
        console.log('🔍 Starting V3.1 OCR Search with full image...')
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            categories: [],
            croppedImages: {},
            originalImageUrl: imageUrl,
            useOCRSearch: true,
          }),
        })

        const data = await response.json()
        console.log('📦 OCR Search Response:', {
          success: data.meta?.success,
          mode: data.meta?.mode,
          resultsCount: Object.keys(data.results || {}).length,
          meta: data.meta
        })
        setResults(data.results || {})
        
        // Log search results
        if (sessionManager) {
          await sessionManager.logSearchResults(data.results, data.meta || {})
          
          if (data.meta?.ocr_mapping) {
            console.log('📝 OCR Mapping:', data.meta.ocr_mapping)
          }
          if (data.meta?.summary) {
            console.log('📊 Search Summary:', data.meta.summary)
          }
        }
        
        setCurrentStep('results')
      } catch (error) {
        console.error('Error in OCR search:', error)
        alert('An error occurred during OCR search. Please try again.')
        setCurrentStep('upload')
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (useInteractiveMode) {
      // INTERACTIVE MODE: Fast detection first, user selects, then process
      setCurrentStep('detecting')
      
      try {
        console.log('⚡ Starting fast DINO-X detection...')
        const detectResponse = await fetch(`${process.env.NEXT_PUBLIC_GPU_API_URL}/detect`, {
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

    setCurrentStep('processing')
    console.log(`🎯 Processing ${selectedBboxes.length} selected items...`)

    try {
      // Process each selected item: get description + crop
      const processedItems: DetectedItem[] = []
      
      for (const bbox of selectedBboxes) {
        console.log(`Processing ${bbox.category}...`)
        
        const processResponse = await fetch(`${process.env.NEXT_PUBLIC_GPU_API_URL}/process-item`, {
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
          continue
        }

        const processData = await processResponse.json()
        console.log(`✅ Processed ${bbox.category} in ${processData.processing_time}s`, {
          description: processData.description?.substring(0, 50) + '...',
          croppedImageUrl: processData.croppedImageUrl?.substring(0, 80) + '...',
          category: processData.category
        })

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
        
        processedItems.push(detectedItem)
      }

      console.log(`✅ All items processed: ${processedItems.length}`)
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
    setCurrentStep('searching')
    setIsLoading(true)

    // Log user selection
    if (sessionManager) {
      await sessionManager.logItemSelection(items)
    }

    try {
      // Build cropped images map from selected items
      const croppedImages: Record<string, string> = {}
      const categories: string[] = []
      
      items.forEach((item, idx) => {
        if (item.croppedImageUrl) {
          // Use unique key for each item
          const key = `${item.category}_${idx + 1}`
          croppedImages[key] = item.croppedImageUrl
          categories.push(item.category)
        }
      })

      console.log(`🔍 Searching ${items.length} selected items...`)
      console.log('🔍 Search payload:', {
        categories,
        croppedImages,
        originalImageUrl: uploadedImageUrl
      })

      // Call the API to get search results with cropped images
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories,
          croppedImages,
          originalImageUrl: uploadedImageUrl,
          useOCRSearch: useOCRSearch, // V3.1 OCR Search Pipeline
        }),
      })

      const data = await response.json()
      setResults(data.results || {})
      
      // Log search results (with GPT reasoning from meta data)
      if (sessionManager) {
        await sessionManager.logSearchResults(data.results, data.meta || {})
        
        // Console log GPT reasoning for debugging
        if (data.meta?.gptReasoning) {
          console.log('🤖 GPT Product Selection Reasoning:', data.meta.gptReasoning)
        }
        
        // Console log timing data for debugging
        if (data.meta?.timing) {
          console.log('⏱️  Pipeline Timing:', data.meta.timing)
        } else {
          console.log('⚠️  No timing data in response')
        }
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
    setResults({})
  }

  // Build croppedImages map for Results component
  const croppedImagesForResults: Record<string, string> = {}
  selectedItems.forEach((item, idx) => {
    if (item.croppedImageUrl) {
      const key = `${item.category}_${idx + 1}`
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
            {/* V3.1 OCR Search Toggle */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4 shadow-sm">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-gray-900">🚀 Advanced OCR Search (V3.1)</span>
                    <span className="px-2 py-0.5 text-xs font-bold bg-green-500 text-white rounded-full">BETA</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {useOCRSearch 
                      ? '✅ Using advanced pipeline with OCR text extraction + visual search'
                      : 'Using standard visual search only'
                    }
                  </p>
                </div>
                <div className="relative ml-4">
                  <input
                    type="checkbox"
                    checked={useOCRSearch}
                    onChange={(e) => setUseOCRSearch(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                </div>
              </label>
            </div>
            
            <ImageUpload onImageUploaded={handleImageUploaded} />
          </div>
        )}
        
        {currentStep === 'detecting' && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="text-center space-y-6">
                {/* Image with animated gradient border (iPhone AI style) */}
                <div className="relative inline-block overflow-hidden rounded-2xl">
                  {/* Animated gradient rectangle (larger than container) */}
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 animate-gradient-rotate"></div>
                  
                  {/* White mask rectangles to create border effect */}
                  <div className="absolute inset-[3px] bg-white rounded-2xl"></div>
                  
                  {/* Image container */}
                  <div className="relative bg-white rounded-2xl p-2 m-[3px]">
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
                    {useInteractiveMode ? '⚡ Detecting Items...' : t('analyzing.title')}
                  </h2>
                  <p className="text-gray-600">
                    {useInteractiveMode ? 'Fast detection with DINO-X' : t('analyzing.subtitle')}
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
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
                <h2 className="text-2xl font-bold text-black">Processing Selected Items...</h2>
                <p className="text-gray-600">Getting descriptions and cropping images</p>
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
                {/* Apple Intelligence-style animated gradient border for OCR mode */}
                {useOCRSearch && (
                  <div className="relative inline-block mb-4">
                    {/* Animated gradient background */}
                    <div className="absolute inset-0 rounded-2xl overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 animate-gradient-shift"></div>
                      <div className="absolute inset-0 bg-gradient-to-l from-blue-400 via-purple-400 to-pink-400 animate-gradient-shift-reverse opacity-70"></div>
                    </div>
                    {/* White inner container */}
                    <div className="relative bg-white rounded-2xl m-1 p-4">
                      <img
                        src={uploadedImageUrl}
                        alt="Processing"
                        className="w-48 h-48 object-contain rounded-xl"
                      />
                    </div>
                  </div>
                )}
                
                {!useOCRSearch && (
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-black mx-auto"></div>
                )}
                
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold text-black">
                    {useOCRSearch ? '🚀 Advanced OCR Search' : t('searching.title')}
                  </h2>
                  {useOCRSearch && (
                    <div className="space-y-2 text-sm text-gray-600">
                      {/* Step 1: Extracting */}
                      <div className={`flex items-center justify-center gap-2 transition-all ${ocrStep === 'extracting' ? 'text-purple-600 font-semibold scale-105' : ocrStep === 'mapping' || ocrStep === 'searching' || ocrStep === 'selecting' ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={ocrStep === 'extracting' ? 'animate-pulse' : ''}>
                          {ocrStep === 'extracting' ? '📝' : '✅'}
                        </div>
                        <span>Extracting text with Google Vision...</span>
                      </div>
                      
                      {/* Step 2: Mapping */}
                      <div className={`flex items-center justify-center gap-2 transition-all ${ocrStep === 'mapping' ? 'text-purple-600 font-semibold scale-105' : ocrStep === 'searching' || ocrStep === 'selecting' ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={ocrStep === 'mapping' ? 'animate-pulse' : ''}>
                          {ocrStep === 'mapping' ? '🤖' : ocrStep === 'searching' || ocrStep === 'selecting' ? '✅' : '⏳'}
                        </div>
                        <span>Mapping brands with GPT-4o...</span>
                      </div>
                      
                      {/* Step 3: Searching */}
                      <div className={`flex items-center justify-center gap-2 transition-all ${ocrStep === 'searching' ? 'text-purple-600 font-semibold scale-105' : ocrStep === 'selecting' ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={ocrStep === 'searching' ? 'animate-pulse' : ''}>
                          {ocrStep === 'searching' ? '🔍' : ocrStep === 'selecting' ? '✅' : '⏳'}
                        </div>
                        <span>Visual + Priority text search...</span>
                      </div>
                      
                      {/* Step 4: Selecting */}
                      <div className={`flex items-center justify-center gap-2 transition-all ${ocrStep === 'selecting' ? 'text-purple-600 font-semibold scale-105' : 'text-gray-400'}`}>
                        <div className={ocrStep === 'selecting' ? 'animate-pulse' : ''}>
                          {ocrStep === 'selecting' ? '✨' : '⏳'}
                        </div>
                        <span>Selecting best matches...</span>
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-4">⏳ This takes 3-4 minutes for thorough analysis</p>
                    </div>
                  )}
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

