'use client'

import { useState, useEffect } from 'react'
import ImageUpload from './components/ImageUpload'
import CroppedImageGallery from './components/CroppedImageGallery'
import ResultsBottomSheet from './components/ResultsBottomSheet'
import { getSessionManager } from '../lib/sessionManager'

export interface DetectedItem {
  category: string
  groundingdino_prompt: string
  description: string
  croppedImageUrl?: string
  confidence?: number
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<'upload' | 'analyzing' | 'gallery' | 'searching' | 'results'>('upload')
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('')
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([])
  const [selectedItems, setSelectedItems] = useState<DetectedItem[]>([])
  const [results, setResults] = useState<Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [sessionManager, setSessionManager] = useState<any>(null)

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

  const handleImageUploaded = async (imageUrl: string) => {
    setUploadedImageUrl(imageUrl)
    setCurrentStep('analyzing')

    // Log image upload
    if (sessionManager) {
      await sessionManager.logImageUpload(imageUrl)
    }

    try {
      // Call GPT analysis + cropping immediately after upload
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

        // Log GPT analysis
        if (sessionManager) {
          await sessionManager.logGPTAnalysis(analyzeData)
          await sessionManager.logCroppedImages(analyzeData.items)
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
        }),
      })

      const data = await response.json()
      setResults(data.results || {})
      
      // Log search results (with GPT reasoning from meta data)
      if (sessionManager) {
        await sessionManager.logSearchResults(data.results, data.meta || {})
      }
      
      setCurrentStep('results')
    } catch (error) {
      console.error('Error fetching results:', error)
      alert('An error occurred while processing your request')
      setCurrentStep('gallery')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    // Go back to cropped image selection without losing data
    setCurrentStep('gallery')
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {currentStep === 'upload' && (
          <ImageUpload onImageUploaded={handleImageUploaded} />
        )}
        {currentStep === 'analyzing' && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white rounded-2xl shadow-xl p-8">
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
                      alt="Analyzing"
                      className="w-full h-96 object-contain rounded-xl"
                    />
                  </div>
                </div>

                {/* Text */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-gray-800">AI 분석중...</h2>
                  <p className="text-gray-600">이미지에서 아이템을 찾고 있어요</p>
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
            <div className="bg-white rounded-2xl shadow-xl p-12">
              <div className="text-center space-y-6">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto"></div>
                <h2 className="text-2xl font-bold text-gray-800">AI가 요청하신 상품을 찾고 있어요</h2>
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
            selectedItems={selectedItems}
          />
        )}
      </div>
    </main>
  )
}

