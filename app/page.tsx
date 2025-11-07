'use client'

import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import CroppedImageGallery from './components/CroppedImageGallery'
import Results from './components/Results'

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

  const handleImageUploaded = async (imageUrl: string) => {
    setUploadedImageUrl(imageUrl)
    setCurrentStep('analyzing')

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
      } else {
        console.log('⚠️ No items detected by AI')
        setDetectedItems([])
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
      setCurrentStep('results')
    } catch (error) {
      console.error('Error fetching results:', error)
      alert('An error occurred while processing your request')
      setCurrentStep('gallery')
    } finally {
      setIsLoading(false)
    }
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
            <div className="bg-white rounded-2xl shadow-xl p-12">
              <div className="text-center space-y-6">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
                <h2 className="text-2xl font-bold text-gray-800">AI 분석 및 자르기 중...</h2>
                <p className="text-gray-600">이미지에서 아이템을 찾고 자르는 중이에요</p>
                <div className="space-y-2 text-sm text-gray-500">
                  <p>• GPT-4o가 패션 아이템을 감지합니다</p>
                  <p>• GroundingDINO가 아이템을 정확히 찾아 자릅니다</p>
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
                <h2 className="text-2xl font-bold text-gray-800">검색 중...</h2>
                <p className="text-gray-600">선택한 {selectedItems.length}개 아이템을 검색하고 있어요</p>
                <div className="space-y-2 text-sm text-gray-500">
                  <p>• 각 아이템마다 3회 검색으로 최상의 결과 찾기</p>
                  <p>• GPT-4가 가장 유사한 상품을 선별합니다</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {currentStep === 'results' && (
          <Results
            results={results}
            isLoading={isLoading}
            croppedImages={croppedImagesForResults}
            onReset={handleReset}
          />
        )}
      </div>
    </main>
  )
}

