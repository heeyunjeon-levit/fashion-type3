'use client'

import { useState, useEffect, useRef } from 'react'
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
  
  // Single item mode (skip detection for faster results)
  const [showSingleItemQuestion, setShowSingleItemQuestion] = useState(false)
  const [isSingleItem, setIsSingleItem] = useState<boolean | null>(null)
  
  const [currentStep, setCurrentStep] = useState<'upload' | 'detecting' | 'selecting' | 'processing' | 'gallery' | 'searching' | 'results'>('upload')
  const [autoDrawMode, setAutoDrawMode] = useState(false)  // Auto-enable drawing when no items detected
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('')
  const [localImageDataUrl, setLocalImageDataUrl] = useState<string>('')  // Local data URL for cropping (avoids CORS)
  const localImageDataUrlRef = useRef<string>('')  // Ref for immediate access (state updates are async)
  const [bboxes, setBboxes] = useState<BboxItem[]>([])
  const [imageSize, setImageSize] = useState<[number, number]>([0, 0])
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([])
  const [selectedItems, setSelectedItems] = useState<DetectedItem[]>([])
  const [processingItems, setProcessingItems] = useState<{category: string}[]>([])
  const [results, setResults] = useState<Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [sessionManager, setSessionManager] = useState<any>(null)
  const [overallProgress, setOverallProgress] = useState(0)

  // Persist results and state to localStorage for mobile tab recovery
  useEffect(() => {
    if (Object.keys(results).length > 0 && selectedItems.length > 0) {
      const stateToSave = {
        results,
        selectedItems,
        uploadedImageUrl,
        timestamp: Date.now()
      }
      localStorage.setItem('search_state', JSON.stringify(stateToSave))
      console.log('💾 Saved search state to localStorage')
    }
  }, [results, selectedItems, uploadedImageUrl])

  // Restore results from localStorage on mount (for mobile tab recovery)
  useEffect(() => {
    // Check if user just clicked reset (skip restoration in this case)
    const justReset = sessionStorage.getItem('just_reset')
    if (justReset) {
      sessionStorage.removeItem('just_reset')
      console.log('🔄 Reset detected, skipping state restoration')
      return
    }
    
    const savedState = localStorage.getItem('search_state')
    
    if (savedState && currentStep === 'upload') {
      try {
        const parsed = JSON.parse(savedState)
        const timeSinceSave = Date.now() - (parsed.timestamp || 0)
        const oneHour = 60 * 60 * 1000
        
        // Only restore if less than 1 hour old
        if (timeSinceSave < oneHour && Object.keys(parsed.results || {}).length > 0) {
          console.log('🔄 Restoring search state from localStorage')
          setResults(parsed.results)
          setSelectedItems(parsed.selectedItems || [])
          setUploadedImageUrl(parsed.uploadedImageUrl || '')
          setCurrentStep('results')
        } else {
          // Clear old data
          localStorage.removeItem('search_state')
        }
      } catch (error) {
        console.error('Failed to restore state:', error)
        localStorage.removeItem('search_state')
      }
    }
  }, [])

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

  const handleImageUploaded = async (imageUrl: string, uploadTimeSeconds?: number, localDataUrl?: string) => {
    // Prevent duplicate processing in React Strict Mode
    if (uploadedImageUrl === imageUrl) {
      console.log('⚠️  Duplicate upload detected, ignoring...')
      return
    }
    
    console.log('🎯 handleImageUploaded called:', {
      imageUrl: imageUrl.substring(0, 60),
      hasLocalDataUrl: !!localDataUrl,
      localDataUrlStart: localDataUrl?.substring(0, 60)
    })
    
    setUploadedImageUrl(imageUrl)
    // Store local data URL for cropping (avoids CORS issues with Supabase storage)
    // Use both state and ref - ref is immediately available, state is for React re-renders
    if (localDataUrl) {
      setLocalImageDataUrl(localDataUrl)
      localImageDataUrlRef.current = localDataUrl  // Store in ref for immediate access
      console.log('📸 Local data URL stored for cropping (avoids CORS)', {
        length: localDataUrl.length,
        start: localDataUrl.substring(0, 60)
      })
    } else {
      console.warn('⚠️ No local data URL provided - cropping will use Supabase URL (may have CORS issues)')
    }
    
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

    // Old fallback function removed - now using /api/ocr-search directly

    // SHOW SINGLE ITEM QUESTION (before detection)
    // This allows users to skip detection for faster results
    setShowSingleItemQuestion(true)
    return
  }

  // Handle single item question response
  const handleSingleItemResponse = async (isSingle: boolean) => {
    setIsSingleItem(isSingle)
    setShowSingleItemQuestion(false)
    
    if (isSingle) {
      // SINGLE ITEM MODE: Skip detection, go straight to full image search
      console.log('🚀 Single Item Mode: Skipping detection for faster results')
      await handleSingleItemSearch()
      return
    }
    
    // Multiple items: proceed with normal detection
    console.log('👔 Multiple Items Mode: Starting detection...')
    await startDetectionProcess()
  }

  // Single item search (skip detection)
  const handleSingleItemSearch = async () => {
    console.log('⚡ Single item search: Using full image without detection')
    setCurrentStep('searching')
    setIsLoading(true)
    setOverallProgress(0)
    
    try {
      // Use fallback search (full image search without detection)
      const searchResponse = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageUrl: uploadedImageUrl,
          croppedImages: null, // No cropped images - use full image
          descriptions: null,
          skipDetection: true // Flag to skip detection validation
        })
      })
      
      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.status}`)
      }
      
      const searchData = await searchResponse.json()
      console.log('✅ Single item search complete:', searchData)
      
      setResults(searchData.results || {})
      setCurrentStep('results')
      setOverallProgress(100)
      
      if (sessionManager) {
        sessionManager.logSearchResults(searchData.results, { mode: 'single_item_fast' })
      }
    } catch (error) {
      console.error('Error in single item search:', error)
      alert('검색 중 오류가 발생했습니다. 다시 시도해주세요.')
      setCurrentStep('upload')
    } finally {
      setIsLoading(false)
    }
  }

  // Start normal detection process (multiple items)
  const startDetectionProcess = async () => {
    // V3.1 OCR MODE: Skip detection, go directly to OCR search with full image
    if (useOCRSearch) {
      console.log('🚀 OCR Mode: Skipping detection, using full image for OCR search')
      setCurrentStep('searching')
      setIsLoading(true)
      setOverallProgress(0)
      
      try {
        console.log('🔍 Starting V3.1 OCR Search (Next.js OCR + Hybrid Search)...')
        
        // Step 1: Extract brands with Next.js OCR (has Instagram brand recognition)
        setOverallProgress(10)
        console.log('📡 Step 1: Extracting brands with /api/ocr-search...')
        
        const ocrResponse = await fetch('/api/ocr-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: uploadedImageUrl }),
        })
        
        if (!ocrResponse.ok) {
          throw new Error(`OCR extraction failed: ${ocrResponse.status}`)
        }
        
        const ocrData = await ocrResponse.json()
        console.log('✅ OCR extraction complete:', ocrData)
        
        if (!ocrData.success || !ocrData.product_results || ocrData.product_results.length === 0) {
          console.error('OCR returned no brands:', ocrData.reason)
          alert(`OCR 결과 없음: ${ocrData.reason || 'No brands detected'}`)
          setCurrentStep('upload')
          setIsLoading(false)
          return
        }
        
        setOverallProgress(30)
        
        // Step 2: For each brand, do hybrid search with /api/search (has Lens + GPT)
        console.log(`\n🔎 Step 2: Hybrid search for ${ocrData.product_results.length} brand(s)...`)
        
        const results: Record<string, any> = {}
        let completedSearches = 0
        
        for (const productResult of ocrData.product_results) {
          const brand = productResult.brand
          const searchTerm = productResult.exact_ocr_text || productResult.product_type
          
          console.log(`   Searching: ${brand} - ${searchTerm}`)
          
          try {
            // Use existing /api/search with Lens + GPT
            const searchResponse = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                categories: [brand],
                croppedImages: { [brand]: uploadedImageUrl }, // Use full image for Lens search
                originalImageUrl: uploadedImageUrl,
                useOCRSearch: false, // Use regular hybrid search, not OCR mode
              }),
            })
            
            const searchData = await searchResponse.json()
            
            if (searchData.results && searchData.results[brand] && searchData.results[brand].length > 0) {
              const resultKey = `${brand} - ${searchTerm}`.substring(0, 80)
              results[resultKey] = searchData.results[brand]
              console.log(`   ✅ Found ${searchData.results[brand].length} results for ${brand}`)
            } else {
              console.log(`   ⚠️  No results for ${brand}`)
            }
          } catch (searchError) {
            console.error(`   ❌ Search failed for ${brand}:`, searchError)
          }
          
          completedSearches++
          const progress = 30 + (completedSearches / ocrData.product_results.length) * 60
          setOverallProgress(Math.min(progress, 90))
        }
        
        if (Object.keys(results).length === 0) {
          alert('검색 결과가 없습니다. 다른 이미지를 시도해주세요.')
          setCurrentStep('upload')
          setIsLoading(false)
          return
        }
        
        setResults(results)
        
        if (sessionManager) {
          sessionManager.logSearchResults(results, { 
            mode: 'ocr_hybrid_nextjs',
            extracted_text: ocrData.extracted_text,
            brands_detected: ocrData.product_results.map((p: any) => p.brand).join(', ')
          })
        }
        
        setOverallProgress(100)
        setCurrentStep('results')
        setIsLoading(false)
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
        console.log('⚡ Starting DINO-X detection via Vercel (direct DINOx API)...')
        let detectData: any = null
        
        // Use Vercel /api/detect-dinox (calls DINOx API directly - no Modal needed!)
        const dinoxResponse = await fetch('/api/detect-dinox', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl: uploadedImageUrl }),
          signal: AbortSignal.timeout(120000)  // 2 min timeout
        })

        if (!dinoxResponse.ok) {
          throw new Error(`DINOx detection failed: ${dinoxResponse.status}`)
        }

        detectData = await dinoxResponse.json()
        console.log(`✅ DINOx detection complete: ${detectData.bboxes?.length || 0} items found`)
        
        if (!detectData.bboxes || detectData.bboxes.length === 0) {
          console.log('⚠️ No items detected, showing manual draw mode')
          setBboxes([])
          setAutoDrawMode(true)  // Signal to auto-enable drawing mode
          setCurrentStep('selecting')  // Use same UI, just with drawing mode enabled
          return
        }
        
        console.log('📦 Detection data:', {
          bboxes: detectData.bboxes,
          source: detectData.source || 'fallback',
          imageUrl: uploadedImageUrl
        })
        setBboxes(detectData.bboxes || [])
        setImageSize(detectData.image_size || [0, 0])
        
        setCurrentStep('selecting')
      } catch (error: any) {
        console.error('❌ Detection error:', error)
        // On any error, offer manual draw mode instead of failing
        console.log('⚠️ Detection failed, offering manual draw mode')
        setBboxes([])
        setAutoDrawMode(true)  // Signal to auto-enable drawing mode
        setCurrentStep('selecting')  // Use same UI with drawing mode
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
          body: JSON.stringify({ imageUrl: uploadedImageUrl }),
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
  // Can optionally pass bboxes directly (for manual crop mode)
  const handleBboxSelectionConfirm = async (overrideBboxes?: BboxItem[]) => {
    // Guard: If called from onClick, the first arg is MouseEvent, not BboxItem[]
    const bboxesToUse = Array.isArray(overrideBboxes) ? overrideBboxes : bboxes
    const selectedBboxes = bboxesToUse.filter(b => b.selected)
    
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
          // FRONTEND PROCESSING: Crop locally + get description from Next.js API
          // This is faster and more reliable than Modal (no Supabase DNS issues)
          
          // Step 1: Crop image locally using Canvas API
          console.log(`✂️ Cropping ${bbox.category} locally...`)
          const { cropImage } = await import('@/lib/imageCropper')
          
          // Get local data URL first (needed for cropping)
          const localDataUrl = localImageDataUrlRef.current || localImageDataUrl
          if (!localDataUrl) {
            throw new Error('No local data URL available for cropping')
          }
          
          // Convert pixel bbox to normalized (0-1) coordinates
          const [x1, y1, x2, y2] = bbox.bbox
          
          console.log(`   📏 Bbox conversion:`, {
            'bbox (pixels)': bbox.bbox,
            'bbox values': `[${x1}, ${y1}, ${x2}, ${y2}]`,
            'imageSize': imageSize,
            'imageSize valid': imageSize[0] > 0 && imageSize[1] > 0
          })
          
          // Check if bboxes are already normalized (0-1 range) or in pixel coordinates
          const bboxValuesMax = Math.max(x1, y1, x2, y2)
          const bboxesAreNormalized = bboxValuesMax <= 1
          
          console.log(`   🔍 Bbox format detection: max value = ${bboxValuesMax}, normalized = ${bboxesAreNormalized}`)
          
          let normalizedBbox: [number, number, number, number]
          
          if (bboxesAreNormalized) {
            // Bboxes are already in 0-1 range
            console.log(`   ✅ Using bbox as already normalized`)
            normalizedBbox = [x1, y1, x2, y2]
          } else {
            // Bboxes are in pixel coordinates - need to normalize
            console.log(`   ⚠️  Bboxes are in PIXEL coordinates, need to normalize`)
            
            // Load image to get actual dimensions
            const img = new Image()
            const imgDimensions = await new Promise<{width: number, height: number}>((resolve, reject) => {
              img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
              img.onerror = reject
              img.src = localDataUrl
            })
            
            console.log(`   📐 Loaded image dimensions: ${imgDimensions.width}x${imgDimensions.height}`)
            
            // Normalize pixel coordinates to 0-1 range
            normalizedBbox = [
              x1 / imgDimensions.width,
              y1 / imgDimensions.height,
              x2 / imgDimensions.width,
              y2 / imgDimensions.height
            ]
            
            console.log(`   ✅ Normalized bbox: [${normalizedBbox.map(v => v.toFixed(4)).join(', ')}]`)
          }
            
          const croppedDataUrl = await cropImage({
            imageUrl: localDataUrl,
            bbox: normalizedBbox,
            padding: 0.05
          })
            console.log(`✅ Cropped locally: ${Math.round(croppedDataUrl.length / 1024)}KB data URL`)
            
            // Continue with description...
            let description = `${bbox.category} item`
            const descStartTime = Date.now()
            try {
              console.log(`🔄 Fetching description for ${bbox.category}...`)
              const descResponse = await fetch('/api/describe-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageUrl: croppedDataUrl,
                  category: bbox.category
                }),
                signal: AbortSignal.timeout(60000) // 60s timeout for Gemini 3 Pro (matches Vercel function limit)
              })
              
              const descTime = ((Date.now() - descStartTime) / 1000).toFixed(1)
              
              if (descResponse.ok) {
                const descData = await descResponse.json()
                // Parse JSON if it's in the new structured format
                let cleanDescription = descData.description || description
                try {
                  const parsed = JSON.parse(cleanDescription)
                  // Extract just the ecom_title for search
                  cleanDescription = parsed.ecom_title || cleanDescription
                } catch {
                  // If not JSON, use as-is (fallback for old format)
                }
                description = cleanDescription
                console.log(`✅ Description (${descTime}s): "${description.substring(0, 60)}..."`)
              } else {
                const errorText = await descResponse.text()
                console.error(`❌ Description API error ${descResponse.status} (${descTime}s):`, errorText.substring(0, 200))
              }
            } catch (descError) {
              const descTime = ((Date.now() - descStartTime) / 1000).toFixed(1)
              console.error(`❌ Description failed for ${bbox.category} (${descTime}s):`, descError)
              if (descError instanceof Error) {
                console.error(`   Error name: ${descError.name}`)
                console.error(`   Error message: ${descError.message}`)
                if (descError.name === 'TimeoutError') {
                  console.error(`   🕐 Timeout after 45s - Backend still processing`)
                } else if (descError.name === 'AbortError') {
                  console.error(`   🛑 Request aborted`)
                }
              }
            }
            
            const croppedImageUrl = croppedDataUrl
            completedItems++
            const targetProgress = Math.min(20, (completedItems / totalItems) * 20)
            setOverallProgress(prev => Math.max(prev, targetProgress))
            
            return {
              category: bbox.mapped_category || bbox.category,
              groundingdino_prompt: bbox.category,
              description: description,
              croppedImageUrl: croppedImageUrl,
              confidence: bbox.confidence
            }
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
        const descriptions = { [key]: item.description } // Pass GPT-4o descriptions!
        
        try {
          console.log(`🔍 Searching for ${itemName}...`)
          console.log(`   Description: "${item.description.substring(0, 80)}..."`)
          
          const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              categories,
              croppedImages,
              descriptions, // Include descriptions for better search!
              originalImageUrl: uploadedImageUrl,
              useOCRSearch: useOCRSearch,
            }),
          })

          const data = await response.json()
          
          // Check for API errors
          if (data.error) {
            console.error(`❌ Search API error for ${itemName}:`, data.error)
            throw new Error(data.error)
          }
          
          // Update real-time progress: searching is 75% (from 20% to 95%)
          completedSearches++
          const targetProgress = Math.min(95, 20 + (completedSearches / totalItems) * 75)
          setOverallProgress(prev => Math.max(prev, targetProgress))
          console.log(`📊 Search progress: ${completedSearches}/${totalItems} items (${Math.floor(20 + (completedSearches / totalItems) * 75)}%)`)
          
          // Debug: Log search API response
          console.log(`🔍 Search API response for ${itemName}:`, {
            hasResults: !!data.results,
            resultsCount: data.results ? Object.keys(data.results).length : 0,
            meta: data.meta,
            error: data.error
          })
          
          // Merge results
          if (data.results) {
            const resultCount = Object.keys(data.results).length
            if (resultCount === 0) {
              console.warn(`⚠️  Search returned 0 results for ${itemName}`)
            }
            Object.entries(data.results).forEach(([category, links]) => {
              allResults[category] = links as Array<{ link: string; thumbnail: string | null; title: string | null }>
              console.log(`   Added ${(links as any[]).length} products for ${category}`)
            })
          } else {
            console.warn(`⚠️  No results object for ${itemName}`)
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
    setLocalImageDataUrl('')  // Clear local data URL
    localImageDataUrlRef.current = ''  // Clear ref too
    setDetectedItems([])
    setSelectedItems([])
    setProcessingItems([])
    setOverallProgress(0)
    setResults({})
    // Clear saved state from localStorage (including phone to prevent modal on fresh start)
    localStorage.removeItem('search_state')
    localStorage.removeItem('product_click_time_main_app')
    // Set flag to prevent state restoration after reload
    sessionStorage.setItem('just_reset', 'true')
    console.log('🗑️ Cleared saved search state')
    // Force page reload to get fresh upload screen
    window.location.reload()
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
        {currentStep === 'upload' && !showSingleItemQuestion && (
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
        
        {/* Single Item Question Modal */}
        {showSingleItemQuestion && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Uploaded Image Preview */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <img
                src={uploadedImageUrl}
                alt="Uploaded"
                className="w-full h-96 object-contain rounded-xl"
              />
            </div>
            
            {/* Single Item Question */}
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
                <div className="bg-white rounded-xl p-6 space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-lg font-bold text-gray-800">
                      사진 속 패션 아이템이 하나만 있나요?
                    </p>
                    <p className="text-sm text-gray-500">
                      하나만 있다면 더 빠르게 정확한 결과를 보실 수 있어요
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleSingleItemResponse(true)}
                      className="py-3 px-8 bg-black text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      네, 하나만 있어요
                    </button>
                    <button
                      onClick={() => handleSingleItemResponse(false)}
                      className="py-3 px-8 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all active:scale-95"
                    >
                      여러 개 있어요
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
              autoDrawMode={autoDrawMode}
              onAutoDrawModeUsed={() => setAutoDrawMode(false)}
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

