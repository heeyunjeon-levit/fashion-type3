'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import ImageUpload from './components/ImageUpload'
import CroppedImageGallery from './components/CroppedImageGallery'
import InteractiveBboxSelector from './components/InteractiveBboxSelector'
import ResultsBottomSheet from './components/ResultsBottomSheet'
import LanguageToggle from './components/LanguageToggle'
import PhoneModal from './components/PhoneModal'
import { getSessionManager } from '../lib/sessionManager'
import { usePageTracking } from '../lib/hooks/usePageTracking'
import { useLanguage } from './contexts/LanguageContext'
import { getSupabaseClient } from '../lib/supabase'

export interface DetectedItem {
  category: string // DINO-X detected category (e.g., "jeans", "cardigan", "blazer") - used for search
  parent_category: string // Parent category for filtering only (e.g., "bottoms", "tops") - NOT used by UI
  description: string // GPT-4o description
  croppedImageUrl?: string
  croppedImageUrls?: string[] // Multiple crop variations for better search accuracy
  confidence?: number
}

interface BboxItem {
  id: string
  bbox: [number, number, number, number]
  category: string // Specific DINO-X category (e.g., "jeans", "cardigan")
  mapped_category: string // Parent category (e.g., "bottoms", "tops")
  confidence: number
  selected?: boolean
}

export default function Home() {
  const { t, language } = useLanguage()
  
  // Initialize Supabase client for frontend uploads (using singleton)
  const supabase = useMemo(() => getSupabaseClient(), [])
  
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
  
  // Removed: Single item mode - was confusing users
  // Now always use interactive detection mode
  
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
  // Results can be either legacy array format OR two-stage format with colorMatches/styleMatches
  const [results, setResults] = useState<Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }> | { colorMatches: Array<{ link: string; thumbnail: string | null; title: string | null }>; styleMatches: Array<{ link: string; thumbnail: string | null; title: string | null }> }>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [sessionManager, setSessionManager] = useState<any>(null)
  const [overallProgress, setOverallProgress] = useState(0)
  
  // Phone number collection for SMS notifications
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [pendingBboxes, setPendingBboxes] = useState<BboxItem[] | null>(null)
  const [showSmsWaitingMessage, setShowSmsWaitingMessage] = useState(false) // Show "문자가 안오면 다시 검색해보세요"
  const [isAt21Percent, setIsAt21Percent] = useState(false) // Track if we're at the 21% safe point

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

  // Auto-show SMS waiting message when uploads complete (safe point reached at 100%)
  useEffect(() => {
    if (isAt21Percent && overallProgress >= 100 && (currentStep === 'processing' || currentStep === 'searching')) {
      console.log(`✅ Safe point reached at ${overallProgress}% - showing SMS message`)
      setShowSmsWaitingMessage(true)
      setIsAt21Percent(false) // Reset flag
    }
  }, [isAt21Percent, overallProgress, currentStep])

  // Very slow fallback progress animation - only as backup if backend updates stall
  // This ensures progress shows some movement even if backend updates are slow
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
        // VERY slow increment as fallback - backend progress should be primary
        if (prev < 94) {
          // Slow increment: 0.05% every 1 second = 3% per minute (much slower than before)
          const increment = 0.05
          return Math.min(94, prev + increment)
        }
        return prev
      })
    }, 1000) // Update every 1 second (10x slower than before)

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

    // Always start detection (removed confusing single-item question)
    console.log('👔 Starting detection for all uploads...')
    
    if (useOCRSearch) {
      console.log('🔤 OCR Mode enabled')
      await startDetectionProcess(imageUrl)
      return
    }
    
    // Start normal detection immediately
    setCurrentStep('detecting')
    await startDetectionProcess(imageUrl)
  }

  // Removed: handleSingleItemResponse() and handleSingleItemSearch()
  // These created a confusing modal that hurt UX
  // Now we always detect items and let users select what they want
  
  const handleSingleItemSearch_REMOVED = async () => {
    console.log('⚡ This function has been removed - always use detection now')
    
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
  const startDetectionProcess = async (imageUrlOverride?: string) => {
    // V3.1 OCR MODE: Skip detection, go directly to OCR search with full image
    if (useOCRSearch) {
      const imageUrlToUse = imageUrlOverride || uploadedImageUrl
      console.log('🚀 OCR Mode: Skipping detection, using full image for OCR search')
      console.log(`   Using imageUrl: ${imageUrlToUse ? imageUrlToUse.substring(0, 80) : 'MISSING!'}`)
      
      if (!imageUrlToUse) {
        console.error('❌ No image URL available for OCR search!')
        alert('이미지 URL을 찾을 수 없습니다. 다시 시도해주세요.')
        setCurrentStep('upload')
        setIsLoading(false)
        return
      }
      
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
          body: JSON.stringify({ imageUrl: imageUrlToUse }),
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
        
        // Step 2: Transform OCR results to frontend format (no additional searches needed!)
        console.log(`\n✅ Formatting ${ocrData.product_results.length} product(s) for display...`)
        
        const results: Record<string, any> = {}
        
        for (const productResult of ocrData.product_results) {
          const brand = productResult.brand
          const searchTerm = productResult.exact_ocr_text || productResult.product_type
          
          // Create a readable key for the frontend
          const resultKey = `${brand} - ${searchTerm}`.substring(0, 80)
          
          // Transform OCR results to match frontend expected format
          results[resultKey] = productResult.results.map((r: any) => ({
            title: r.title || 'Product',
            link: r.link || '',
            thumbnail: r.thumbnail || null,
            snippet: r.snippet || ''
          }))
          
          console.log(`   ✅ ${brand}: ${productResult.results.length} results`)
        }
        
        if (Object.keys(results).length === 0) {
          alert('검색 결과가 없습니다. 다른 이미지를 시도해주세요.')
          setCurrentStep('upload')
          setIsLoading(false)
          return
        }
        
        setOverallProgress(80)
        
        // ✨ Show phone modal BEFORE displaying results (OCR is fast enough!)
        // NOTE: Phone number is ONLY for analytics tracking in OCR mode (NO SMS sent)
        // OCR is so fast (2-5s) that SMS would arrive after user already sees results
        console.log('📱 OCR results ready, showing phone modal for analytics...')
        
        // Store results and OCR data temporarily
        const tempResults = results
        const tempOcrData = ocrData
        
        // Show phone modal
        setIsLoading(false) // Stop loading so modal is visible
        setShowPhoneModal(true)
        
        // Wait for phone submission (handled in PhoneModal onPhoneSubmit)
        // The modal callback will:
        // 1. Store phone number (analytics only, NO SMS)
        // 2. Log results with sessionManager
        // 3. Display results immediately
        
        // Store results in state for modal callback to access
        setResults(tempResults)
        
        // Store OCR data in sessionManager for analytics
        if (sessionManager) {
          await sessionManager.logEvent('ocr_results_ready', {
            extracted_text: tempOcrData.extracted_text,
            brands_detected: tempOcrData.product_results.map((p: any) => p.brand).join(', '),
            results_count: Object.keys(tempResults).length
          })
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
        const imageUrlToUse = imageUrlOverride || uploadedImageUrl
        console.log('⚡ Starting DINO-X detection via Vercel (direct DINOx API)...')
        console.log(`   Using imageUrl: ${imageUrlToUse ? imageUrlToUse.substring(0, 80) : 'MISSING!'}`)
        
        if (!imageUrlToUse) {
          console.error('❌ No image URL available for detection!')
          alert('이미지 URL을 찾을 수 없습니다. 다시 시도해주세요.')
          setCurrentStep('upload')
          setIsLoading(false)
          return
        }
        
        let detectData: any = null
        
        // Use Vercel /api/detect-dinox (calls DINOx API directly - no Modal needed!)
        const dinoxResponse = await fetch('/api/detect-dinox', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl: imageUrlToUse }),
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
          imageUrl: uploadedImageUrl,
          image_size: detectData.image_size
        })
        
        // Use image dimensions from detection API (more reliable than loading image separately)
        const apiImageSize: [number, number] = detectData.image_size || [0, 0]
        
        // Fallback: Get image dimensions from browser if API didn't provide them
        let actualImageSize: [number, number] = apiImageSize
        if (apiImageSize[0] === 0 || apiImageSize[1] === 0) {
          console.log('⚠️ No image dimensions from API, loading image to get dimensions...')
          actualImageSize = await new Promise<[number, number]>((resolve, reject) => {
            const img = new Image()
            img.onload = () => {
              const dims: [number, number] = [img.naturalWidth, img.naturalHeight]
              console.log(`📐 Browser image dimensions: ${dims[0]}x${dims[1]}`)
              resolve(dims)
            }
            img.onerror = () => {
              console.error('❌ Failed to load image for dimension detection')
              reject(new Error('Image load failed'))
            }
            img.src = uploadedImageUrl
          }).catch(() => {
            console.warn('⚠️  Using fallback dimensions')
            return [0, 0] as [number, number]
          })
        } else {
          console.log(`📐 Using API image dimensions: ${actualImageSize[0]}x${actualImageSize[1]}`)
        }
        
        setImageSize(actualImageSize)
        
        // Check if bboxes are normalized or pixel coordinates
        const bboxes = detectData.bboxes || []
        if (bboxes.length > 0 && actualImageSize[0] > 0) {
          const sampleBbox = bboxes[0].bbox
          const maxVal = Math.max(...sampleBbox)
          const areNormalized = maxVal <= 1
          
          console.log(`📏 Bbox format: ${areNormalized ? 'NORMALIZED [0-1]' : 'PIXEL coordinates'} (max value: ${maxVal})`)
          
          // Convert normalized bboxes to pixel coordinates for consistent handling
          if (areNormalized) {
            console.log('🔄 Converting normalized bboxes to pixel coordinates...')
            const pixelBboxes = bboxes.map((bbox: any) => ({
              ...bbox,
              bbox: [
                bbox.bbox[0] * actualImageSize[0],
                bbox.bbox[1] * actualImageSize[1],
                bbox.bbox[2] * actualImageSize[0],
                bbox.bbox[3] * actualImageSize[1]
              ]
            }))
            console.log(`✅ Sample bbox converted: ${JSON.stringify(bboxes[0].bbox)} → ${JSON.stringify(pixelBboxes[0].bbox)}`)
            setBboxes(pixelBboxes)
          } else {
            console.log('✅ Already in pixel coordinates')
            setBboxes(bboxes)
          }
        } else {
          console.log('ℹ️  No bboxes or invalid dimensions, using raw bboxes')
          setBboxes(bboxes)
        }
        
        setCurrentStep('selecting')
      } catch (error: any) {
        console.error('❌ Detection error:', error)
        // On any error, offer manual draw mode instead of failing
        console.log('⚠️ Detection failed, offering manual draw mode')
        setBboxes([])
        setAutoDrawMode(true)  // Signal to auto-enable drawing mode
        setCurrentStep('selecting')  // Use same UI with drawing mode
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

    console.log(`🚀 User selected ${selectedBboxes.length} items`)
    setPendingBboxes(selectedBboxes)
    
    // Check if we already have a phone number
    // ALWAYS ask for phone number, even for returning users
    // This ensures:
    // 1. Users on different devices provide correct phone
    // 2. Users can update their phone number
    // 3. Better tracking and SMS delivery reliability
    console.log(`📱 Asking for phone number...`)
    setPendingBboxes(selectedBboxes)  // Set state for modal callback
    setShowPhoneModal(true)
    
    // Also store in window for safety
    ;(window as any).__pendingBboxesForProcessing = selectedBboxes
  }

  // Process items after phone number is collected
  // Helper function: Crop image using Canvas API
  const cropImageWithCanvas = async (
    imageUrl: string,
    bbox: [number, number, number, number],
    imgWidth: number,
    imgHeight: number
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous' // Handle CORS
      
      img.onload = () => {
        try {
          // Create canvas
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }
          
          // Get crop dimensions (bbox is in pixel coordinates)
          const [x1, y1, x2, y2] = bbox
          const cropWidth = Math.round(x2 - x1)
          const cropHeight = Math.round(y2 - y1)
          
          // Set canvas size to crop dimensions
          canvas.width = cropWidth
          canvas.height = cropHeight
          
          // Draw cropped portion
          ctx.drawImage(
            img,
            Math.round(x1), Math.round(y1), // Source x, y
            cropWidth, cropHeight,           // Source width, height
            0, 0,                             // Dest x, y
            cropWidth, cropHeight             // Dest width, height
          )
          
          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Failed to create blob from canvas'))
              }
            },
            'image/jpeg',
            0.92 // Quality
          )
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image for cropping'))
      }
      
      img.src = imageUrl
    })
  }

  const processPendingItems = async (phoneNum: string, bboxesToProcess?: typeof pendingBboxes) => {
    const bboxes = bboxesToProcess || pendingBboxes
    if (!bboxes) {
      console.error(`❌ No bboxes to process! bboxesToProcess=${!!bboxesToProcess}, pendingBboxes=${!!pendingBboxes}`)
      return
    }
    
    // Note: State updates (setPhoneNumber, setProcessingItems, setCurrentStep) are now done
    // by the caller BEFORE this function is called, so the UI updates instantly!
    console.log(`🎯 Processing ${bboxes.length} selected items with phone: ${phoneNum}...`)

    try {
      console.log(`🚨 DEBUG: Starting processPendingItems`)
      console.log(`🚨 DEBUG: Phone = ${phoneNum || 'NONE'}`)
      console.log(`🚨 DEBUG: uploadedImageUrl = ${uploadedImageUrl.substring(0, 80)}`)
      console.log(`🚨 DEBUG: bboxes count = ${bboxes.length}`)
      
      // Process ALL items in parallel for efficiency with real-time progress tracking
      console.log(`🚀 Processing ${bboxes.length} items in parallel...`)
      
      const totalItems = bboxes.length
      let completedItems = 0
      
      const processingPromises = bboxes.map(async (bbox) => {
        console.log(`🔄 Starting processing for ${bbox.category}...`)
        
        try {
          // 🎨 FRONTEND CANVAS CROPPING (reliable, no backend dependencies!)
          console.log(`✂️ [${bbox.category}] Cropping with Canvas API...`)
          console.log(`   bbox: ${JSON.stringify(bbox.bbox)}`)
          console.log(`   imageSize: ${JSON.stringify(imageSize)}`)
          
          let croppedImageUrl = uploadedImageUrl // Fallback to full image
          
          try {
            // Crop using Canvas
            const croppedBlob = await cropImageWithCanvas(
              uploadedImageUrl,
              bbox.bbox,
              imageSize[0],
              imageSize[1]
            )
            
            console.log(`✅ Cropped ${bbox.category}: ${Math.round(croppedBlob.size / 1024)}KB`)
            
            // Upload cropped image to Supabase
            const timestamp = Date.now()
            const filename = `cropped_${bbox.category}_${timestamp}.jpg`
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('images')
              .upload(filename, croppedBlob, {
                contentType: 'image/jpeg',
                cacheControl: '3600'
              })
            
            if (uploadError) {
              console.error(`❌ Supabase upload failed:`, uploadError)
              throw uploadError
            }
            
            const { data: { publicUrl } } = supabase.storage
              .from('images')
              .getPublicUrl(filename)
            
            croppedImageUrl = publicUrl
            console.log(`✅ Uploaded cropped image: ${publicUrl.substring(0, 80)}`)
            
            // Update progress after cropping AND uploading (major milestone!)
            completedItems += 0.4 // 40% of this item done (cropping + upload)
            const croppingProgress = (completedItems / totalItems) * 50 // Use 0-50% range for cropping/upload
            setOverallProgress(prev => Math.max(prev, croppingProgress))
            
          } catch (cropError) {
            console.error(`⚠️ Cropping failed for ${bbox.category}:`, cropError)
            console.log(`   → Falling back to full image`)
            // Continue with full image if cropping fails
            completedItems += 0.4 // Still count this item as processed
            const croppingProgress = (completedItems / totalItems) * 50
            setOverallProgress(prev => Math.max(prev, croppingProgress))
          }
          
          let croppedDataUrls = [croppedImageUrl]
            
            // Continue with description...
            let description = `${bbox.category} item`
            let finalCategory = bbox.category // Default to DINO-X category (may be overridden by description API)
            const descStartTime = Date.now()
            let descProgressInterval: NodeJS.Timeout | undefined // Declare outside try block
            try {
              console.log(`🔄 Fetching description for ${bbox.category}...`)
              
              // Start a progress simulator for description (shows activity while waiting)
              descProgressInterval = setInterval(() => {
                completedItems += 0.05 // Small increments to show progress
                const currentProgress = 50 + ((completedItems / totalItems) * 40) // 50-90% range for descriptions
                setOverallProgress(prev => Math.max(prev, Math.min(90, currentProgress)))
              }, 2000) // Update every 2 seconds
              
              console.log(`📤 Sending to describe-item:`)
              console.log(`   category: ${bbox.category}`)
              console.log(`   croppedImageUrl: ${croppedImageUrl.substring(0, 80)}`)
              
              const descResponse = await fetch('/api/describe-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageUrl: croppedImageUrl, // Use PRE-CROPPED image URL (cropped on frontend!)
                  category: bbox.category
                  // No bbox or imageSize needed - image is already cropped!
                }),
                signal: AbortSignal.timeout(90000) // 90s timeout for Gemini 3 Pro
              })
              
              const descTime = ((Date.now() - descStartTime) / 1000).toFixed(1)
              
              // Clear the progress simulator
              clearInterval(descProgressInterval)
              
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
                
                // 🔥 CRITICAL: Use overridden category from description API (e.g. "robe" instead of "sweater")
                if (descData.category && descData.category !== bbox.category) {
                  console.log(`🔄 Category override: "${bbox.category}" → "${descData.category}" (from description API)`)
                  finalCategory = descData.category
                }
                
                console.log(`✅ Description (${descTime}s): "${description.substring(0, 60)}..."`)
                console.log(`✅ Using frontend-cropped image: ${croppedImageUrl.substring(0, 60)}...`)
                
                // Final progress update for this item (this item is NOW SAFE - all data persisted!)
                completedItems = Math.ceil(completedItems) // Round up any fractional progress
                const targetProgress = 50 + ((completedItems / totalItems) * 50) // 50-100% range
                setOverallProgress(prev => Math.max(prev, targetProgress))
                
                // Return successful item
                return {
                  category: finalCategory, // ✅ Use overridden category from description API (e.g. "robe" not "sweater")
                  parent_category: bbox.mapped_category, // Parent from DINO-X (may be overridden in search)
                  description: description,
                  croppedImageUrl: croppedDataUrls[0], // Backend-cropped image URL
                  croppedImageUrls: croppedDataUrls, // All crop variations for search
                  confidence: bbox.confidence
                }
              } else {
                const errorText = await descResponse.text()
                console.error(`❌ Description API error ${descResponse.status} (${descTime}s):`, errorText.substring(0, 200))
                // Return null on error - this item will be filtered out
                return null
              }
            } catch (descError) {
              const descTime = ((Date.now() - descStartTime) / 1000).toFixed(1)
              if (descProgressInterval) clearInterval(descProgressInterval) // Clear interval on error too
              console.error(`❌ Description failed for ${bbox.category} (${descTime}s):`, descError)
              if (descError instanceof Error) {
                console.error(`   Error name: ${descError.name}`)
                console.error(`   Error message: ${descError.message}`)
                if (descError.name === 'TimeoutError') {
                  console.error(`   🕐 Timeout after 90s - Backend still processing`)
                } else if (descError.name === 'AbortError') {
                  console.error(`   🛑 Request aborted`)
                }
              }
              // Return null on exception - this item will be filtered out
              return null
            }
        } catch (error) {
          console.error(`❌ Error processing ${bbox.category}:`, error)
          console.error(`   Error type: ${error instanceof Error ? error.name : typeof error}`)
          console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`)
          completedItems = Math.ceil(completedItems) // Round up
          const targetProgress = 50 + ((completedItems / totalItems) * 50) // Still update progress
          setOverallProgress(prev => Math.max(prev, targetProgress))
          console.log(`⚠️ Skipping ${bbox.category} due to error, continuing with other items...`)
          return null
        }
      })

      // Wait for all processing to complete
      const results = await Promise.all(processingPromises)
      const processedItems = results.filter(item => item !== null) as DetectedItem[]

      console.log(`✅ All items processed in parallel: ${processedItems.length}/${bboxes.length}`)
      // Ensure we're at 100% after processing completes (SAFE POINT!)
      setOverallProgress(100)
      console.log(`🎉 SAFE POINT REACHED! All images uploaded and descriptions saved.`)
      setDetectedItems(processedItems)
      setSelectedItems(processedItems)
      
      // Mark safe point flag - SMS message will show now
      setIsAt21Percent(true)

      // Now search with processed items (user can leave, job will run in background)
      await handleItemsSelected(processedItems, phoneNum)

    } catch (error) {
      console.error('❌ Processing error:', error)
      alert('Failed to process selected items. Please try again.')
      setCurrentStep('selecting')
    }
  }

  const handleItemsSelected = async (items: DetectedItem[], phoneForSearch?: string) => {
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
      // Prepare search data
      console.log(`🔍 Searching ${items.length} items with background job queue...`)
      console.log(`📋 Items to search:`, items.map((item, idx) => ({
        idx: idx + 1,
        category: item.category,
        description: item.description?.substring(0, 50),
        hasCroppedUrl: !!item.croppedImageUrl,
        croppedUrlType: item.croppedImageUrl?.startsWith('data:') ? 'data URL' : item.croppedImageUrl?.startsWith('http') ? 'HTTP URL' : 'missing'
      })))
      
      // ⚠️  SAFETY CHECK: Filter out items without cropped URLs
      const validItems = items.filter(item => item.croppedImageUrl)
      const skippedItems = items.filter(item => !item.croppedImageUrl)
      
      if (skippedItems.length > 0) {
        console.error(`❌ SKIPPING ${skippedItems.length} item(s) without cropped URLs:`, 
          skippedItems.map(i => i.category))
        alert(`Warning: ${skippedItems.length} item(s) failed to upload and will be skipped. Searching the remaining ${validItems.length} item(s).`)
      }
      
      if (validItems.length === 0) {
        throw new Error('No valid items to search - all items are missing cropped images')
      }
      
      const totalItems = validItems.length
      // Support both legacy array format and two-stage format (colorMatches/styleMatches)
      const allResults: Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }> | { colorMatches: Array<{ link: string; thumbnail: string | null; title: string | null }>; styleMatches: Array<{ link: string; thumbnail: string | null; title: string | null }> }> = {}
      
      // 🔧 FIX: Create ONE job with ALL items (not separate jobs per item)
      // This ensures only ONE SMS is sent with all results combined
      console.log(`🎯 Creating ONE job for ${totalItems} item(s)...`)
      
      // Step 1: Prepare items (uploads already done in processPendingItems!)
      console.log(`📦 Step 1: Preparing ${totalItems} items for job creation...`)
      // NOTE: Images are already uploaded in processPendingItems - no need to re-upload!
      // This just maps items to the format needed for the job
      const uploadedItems = validItems.map((item, idx) => {
        const itemName = item.category
        const key = `${itemName}_${idx + 1}`
        const croppedUrl = item.croppedImageUrl // Already a Supabase URL from processPendingItems
        
        // Verify we have a valid URL (should always be true at this point)
        if (!croppedUrl || croppedUrl.startsWith('data:')) {
          console.warn(`⚠️ Item ${itemName} has invalid URL: ${croppedUrl?.substring(0, 50)}`)
        }
        
        return { key, croppedUrl, item }
      })
      
      console.log(`   ✅ All ${totalItems} items ready (images already uploaded)`)
      // Progress should already be at 100% from processPendingItems
      
      // Step 2: Combine all items into ONE job payload
      console.log(`🎯 Step 2: Combining ${totalItems} items into ONE job...`)
      const allCategories: string[] = []
      const allCroppedImages: Record<string, string> = {}
      const allDescriptions: Record<string, string> = {}
      
      uploadedItems.forEach(({ key, croppedUrl, item }) => {
        allCategories.push(item.category)
        allCroppedImages[key] = croppedUrl!
        allDescriptions[key] = item.description
        console.log(`   ✅ Added ${item.category} (${key})`)
      })
      
      // Step 3: Get phone number or skip job creation
      const phoneToUse = phoneForSearch || phoneNumber
      
      if (!phoneToUse) {
        // NOTE: This shouldn't happen anymore since phone is collected earlier!
        // Safe point was already triggered in processPendingItems at 100%
        console.warn(`⚠️ No phone number available at job creation stage (unexpected)`)
        console.log(`   User should have been asked for phone already at safe point`)
        
        // Fallback: show phone modal
        setShowPhoneModal(true)
        return
      }
      
      // Phone exists - create job immediately with phone number
      const formattedPhone = phoneToUse.startsWith('+82') ? phoneToUse : `+82${phoneToUse.replace(/^0/, '')}`
      
      console.log(`🚀 Step 3: Starting ONE job for all ${totalItems} items...`)
      console.log(`   📞 Phone for SMS: ${formattedPhone}`)
      console.log(`   📦 Categories:`, allCategories)
      console.log(`   🖼️  Cropped images: ${Object.keys(allCroppedImages).length}`)
      console.log(`   📝 Descriptions: ${Object.keys(allDescriptions).length}`)
      
      try {
        const { searchWithJobQueue } = await import('@/lib/searchJobClient')
        
        const { results: data, meta } = await searchWithJobQueue(
          {
            categories: allCategories,
            croppedImages: allCroppedImages,
            descriptions: allDescriptions,
            originalImageUrl: uploadedImageUrl,
            useOCRSearch: useOCRSearch,
            phoneNumber: formattedPhone,  // 📱 ONE SMS for all items!
            countryCode: '+82',
          },
          {
            onProgress: (progress) => {
              console.log(`📊 Job progress update: ${progress}%`)
              const overallProgress = Math.min(95, 20 + (progress / 100) * 75)
              setOverallProgress(prev => {
                const newProgress = Math.max(prev, overallProgress)
                if (newProgress !== prev) {
                  console.log(`   🔄 UI progress: ${prev}% → ${newProgress}%`)
                }
                return newProgress
              })
            },
            onComplete: (results, metadata) => {
              console.log(`🎉 Job COMPLETED callback triggered!`)
              console.log(`   Results keys:`, results ? Object.keys(results) : 'null')
              console.log(`   Forcing UI update to 100%...`)
              setOverallProgress(100)
            },
            enableNotifications: true,
            fastPollInterval: 1500,  // Poll faster (was 2500)
            slowPollInterval: 3000   // Poll faster even when hidden (was 5000)
          }
        )
        
        console.log(`✅ Combined job complete for ${totalItems} items!`)
        console.log(`📦 Results:`, JSON.stringify(data).substring(0, 400))
        
        // Process combined results
        if (data) {
          const resultCount = Object.keys(data).length
          console.log(`📊 Got results for ${resultCount} items`)
          
          Object.entries(data).forEach(([category, categoryData]) => {
            // Handle new structure: { colorMatches: [...], styleMatches: [...] }
            if (categoryData && typeof categoryData === 'object' && !Array.isArray(categoryData)) {
              const colorMatches = (categoryData as any).colorMatches || []
              const styleMatches = (categoryData as any).styleMatches || []
              
              console.log(`   ✅ ${category}: ${colorMatches.length} color + ${styleMatches.length} style`)
              
              allResults[category] = {
                colorMatches: colorMatches as Array<{ link: string; thumbnail: string | null; title: string | null }>,
                styleMatches: styleMatches as Array<{ link: string; thumbnail: string | null; title: string | null }>
              }
            } else if (Array.isArray(categoryData)) {
              console.log(`   ✅ ${category}: ${categoryData.length} products`)
              allResults[category] = categoryData as Array<{ link: string; thumbnail: string | null; title: string | null }>
            }
          })
        }
        
        console.log(`✅ Search complete - ${Object.keys(allResults).length} categories`)
        setOverallProgress(95)
      } catch (error) {
        console.error(`❌ Combined search error:`, error)
        throw error
      }
      
      console.log(`🎯 Setting results state with ${Object.keys(allResults).length} categories...`)
      setResults(allResults)
      
      // Log combined search results
      if (sessionManager) {
        await sessionManager.logSearchResults(allResults, { 
          mode: 'background_job_queue',
          totalItems: totalItems
        })
      }
      
      console.log(`🎯 Changing step to 'results' - UI should update now!`)
      setCurrentStep('results')
      setOverallProgress(100)
      setIsLoading(false)
      
      console.log(`✅ Frontend state fully updated - results page should be visible!`)
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

  // Build croppedImages map for Results component (computed value)
  const croppedImagesForResults = useMemo(() => {
    const map: Record<string, string> = {}
    selectedItems.forEach((item, idx) => {
      if (item.croppedImageUrl) {
        // Use the specific DINO-X category to match search results keys
        const itemName = item.category
        const key = `${itemName}_${idx + 1}`
        map[key] = item.croppedImageUrl
      }
    })
    return map
  }, [selectedItems])

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
          <div className="max-w-2xl mx-auto mt-8 animate-fadeIn">
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
          <div className="max-w-2xl mx-auto mt-8 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-gray-100">
              <div className="text-center space-y-6">
                <h2 className="text-2xl font-bold text-black">선택하신 패션템을 찾고 있어요!</h2>
                
                {/* Circular progress bar - completes when all uploads finish (100%) */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-48 h-48">
                    {/* Background circle */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="80"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                        fill="none"
                      />
                      {/* Progress circle - maps 0-100% progress to 0-100% of circle */}
                      <circle
                        cx="96"
                        cy="96"
                        r="80"
                        stroke="url(#gradient-processing)"
                        strokeWidth="12"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 80}`}
                        strokeDashoffset={`${2 * Math.PI * 80 * (1 - Math.min(overallProgress / 100, 1))}`}
                        className="transition-all duration-500 ease-out"
                      />
                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id="gradient-processing" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-black">
                          {Math.floor(Math.min(overallProgress, 100))}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">업로드 중...</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Estimated time remaining */}
                  <div className="text-xs text-gray-500 text-center">
                    {overallProgress < 50 ? '예상 소요 시간: 1-2분' : '거의 완료되었습니다!'}
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
          <div className="max-w-2xl mx-auto mt-8 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-gray-100">
              <div className="text-center space-y-6">
                {/* Main title with icon */}
                <div className="flex flex-col items-center gap-3">
                  <div className="text-4xl animate-bounce">🔍</div>
                  <h2 className="text-2xl font-bold text-black">선택하신 패션템을 찾고 있어요!</h2>
                  <p className="text-sm text-gray-600">잠시만 기다려주세요</p>
                </div>
                
                {/* Circular progress bar - should already be at 100% (safe point reached) */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-48 h-48">
                    {/* Background circle */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="80"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                        fill="none"
                      />
                      {/* Progress circle - maps 0-100% progress to 0-100% of circle */}
                      <circle
                        cx="96"
                        cy="96"
                        r="80"
                        stroke="url(#gradient)"
                        strokeWidth="12"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 80}`}
                        strokeDashoffset={`${2 * Math.PI * 80 * (1 - Math.min(overallProgress / 100, 1))}`}
                        className="transition-all duration-500 ease-out"
                      />
                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-black">
                          {Math.floor(Math.min(overallProgress, 100))}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">완료!</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Message */}
                  <div className="text-xs text-gray-500 text-center">
                    검색 준비가 완료되었습니다
                  </div>
                </div>

                {/* What's happening explanation */}
                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-start gap-3 text-left">
                    <div className="text-xl mt-0.5">💡</div>
                    <div className="flex-1 text-sm text-gray-700">
                      <p className="font-medium text-gray-900 mb-1">지금 무슨 일이 일어나고 있나요?</p>
                      <ul className="space-y-1 text-xs">
                        <li>✨ AI가 이미지에서 패션 아이템 분석 중</li>
                        <li>🌍 전세계 쇼핑몰에서 비슷한 상품 검색 중</li>
                        <li>🎯 가장 잘 맞는 상품만 선별 중</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Note: SMS notification message removed - will show after circle completes */}
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
            userPhoneNumber={phoneNumber}
          />
        )}
      </div>
      
      {/* SMS Waiting Message - Show after phone submission at 21% */}
      {showSmsWaitingMessage && (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-200">
            <div className="text-center">
              {/* Icon - Success checkmark */}
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              
              {/* Message - Clear and reassuring */}
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t('sms.title')}
              </h2>
              <div className="mb-6">
                <p className="text-lg font-bold text-black mb-3 bg-yellow-100 inline-block px-3 py-1 rounded-lg">
                  {t('sms.safeToClose')}
                </p>
                <p className="text-gray-700 leading-relaxed mt-4">
                  {language === 'ko' ? (
                    <><strong className="text-gray-900">1~2분 후</strong> 결과 링크를 문자로 보내드릴게요! 📱</>
                  ) : (
                    t('sms.timing')
                  )}
                </p>
              </div>
              
              {/* Additional info box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-gray-700">
                  {t('sms.infoNote')}
                </p>
              </div>
              
              {/* Confirm Button */}
              <button
                onClick={() => {
                  setShowSmsWaitingMessage(false)
                  window.location.href = 'https://fashionsource.vercel.app'
                }}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg transform hover:scale-105 active:scale-95"
              >
                {t('sms.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Phone Modal - REQUIRED to see results (for tracking & SMS) */}
      {showPhoneModal && (
        <PhoneModal
          ocrMode={useOCRSearch}  // Pass OCR mode flag for different messaging
          at21Percent={isAt21Percent}  // Pass flag for different button text
          defaultPhoneNumber={sessionManager?.getPhoneNumber() || ''}  // Pre-fill for returning users
          onPhoneSubmit={async (phone: string) => {
            console.log(`📱 Phone submitted: ${phone}`)
            
            // Close modal immediately for instant feedback (no delay!)
            setShowPhoneModal(false)
            
            // IMMEDIATELY update UI state (synchronous - no delay!)
            setPhoneNumber(phone)
            
            const formattedPhone = phone.startsWith('+82') ? phone : `+82${phone.replace(/^0/, '')}`
            
            // Log phone number (non-blocking)
            if (sessionManager) {
              sessionManager.logPhoneNumber(formattedPhone, '+82')
                .then(() => console.log(`✅ Phone logged: ${formattedPhone}`))
                .catch((error: any) => console.error('❌ Failed to log phone:', error))
            }
            
            // 🆕 SAFE POINT MODAL: Create job NOW with phone number
            if (isAt21Percent && (window as any).__pendingJobData) {
              console.log('📱 Creating job with phone number after safe upload point...')
              const jobData = (window as any).__pendingJobData
              
              // Create job in background (don't wait for completion)
              const { searchWithJobQueue } = await import('@/lib/searchJobClient')
              searchWithJobQueue(
                {
                  categories: jobData.allCategories,
                  croppedImages: jobData.allCroppedImages,
                  descriptions: jobData.allDescriptions,
                  originalImageUrl: uploadedImageUrl,
                  useOCRSearch: useOCRSearch,
                  phoneNumber: formattedPhone,  // ✅ Phone included from start!
                  countryCode: '+82',
                },
                {
                  enableNotifications: false, // No browser notifications - user will leave
                  fastPollInterval: 3000,
                  slowPollInterval: 5000
                }
              ).then(() => {
                console.log('✅ Background job completed!')
              }).catch((error: any) => {
                console.error('❌ Background job error:', error)
              })
              
              // Don't show SMS message immediately - let the progress trigger it when circle completes
              // The useEffect watching isAt21Percent will show it when progress >= 20
              
              // Clean up
              delete (window as any).__pendingJobData
              return
            }
            
            // OCR MODE: Results are already ready, just show them!
            // ⚡ NO SMS SENT - OCR is fast (2-5s), user sees results immediately
            // Phone number used ONLY for analytics tracking, not SMS
            if (useOCRSearch && Object.keys(results).length > 0) {
              console.log('✅ OCR mode: Showing results immediately (NO SMS - results instant)')
              
              // Log search results with phone number for tracking (analytics only, no SMS)
              if (sessionManager) {
                sessionManager.logSearchResults(results, { 
                  mode: 'ocr_hybrid_nextjs',
                  phone_number: formattedPhone
                }).catch((error: any) => console.error('❌ Failed to log results:', error))
              }
              
              setOverallProgress(100)
              setCurrentStep('results')
              return
            }
            
            // NORMAL MODE: Process pending items
            // 🐌 SMS WILL BE SENT - Normal search is slow (20-60s), user might leave
            // Phone number used for SMS notification with shareable results link
            
            // Check if we have pending bboxes from selection (asked for phone BEFORE processing)
            const bboxesToProcess = (window as any).__pendingBboxesForProcessing || pendingBboxes
            
            if (bboxesToProcess) {
              console.log(`🚀 Starting processing with phone: ${phone}`)
              setProcessingItems(bboxesToProcess.map((bbox: BboxItem) => ({ category: bbox.category })))
              setCurrentStep('processing') // Show progress bar - job needs to be created first!
              
              // Clean up
              delete (window as any).__pendingBboxesForProcessing
              
              // Start processing (non-blocking) - SMS waiting message at 21% (safe point)
              processPendingItems(phone, bboxesToProcess).catch((error: any) => console.error('❌ Search error:', error))
            } else {
              console.error('❌ No pending bboxes to process!')
            }
          }}
        />
      )}
    </main>
  )
}

