'use client'

import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import CategorySelection from './components/CategorySelection'
import Cropping from './components/Cropping'
import Results from './components/Results'

export interface DetectedItem {
  category: string
  groundingdino_prompt: string
  description: string
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<'upload' | 'analyzing' | 'category' | 'cropping' | 'results'>('upload')
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('')
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [croppedImages, setCroppedImages] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>>>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleImageUploaded = async (imageUrl: string) => {
    setUploadedImageUrl(imageUrl)
    setCurrentStep('analyzing')

    try {
      // Call GPT analysis in background immediately after upload
      console.log('🚀 Starting pre-analysis...')
      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      })

      const analyzeData = await analyzeResponse.json()
      
      if (analyzeData.items && analyzeData.items.length > 0) {
        console.log(`✅ Pre-analysis complete: ${analyzeData.items.length} items detected`)
        setDetectedItems(analyzeData.items)
      } else {
        console.log('⚠️ No items detected by GPT')
        setDetectedItems([])
      }
    } catch (error) {
      console.error('❌ Analysis error:', error)
      // Continue anyway with empty detected items
      setDetectedItems([])
    } finally {
      setCurrentStep('category')
    }
  }

  const handleCategoriesSelected = (categories: string[]) => {
    setSelectedCategories(categories)
    setCurrentStep('cropping')
  }

  const handleCropped = async (croppedImagesData: Record<string, string>) => {
    setCroppedImages(croppedImagesData)
    setCurrentStep('results')
    setIsLoading(true)

    try {
      // Call the API to get search results with cropped images
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: selectedCategories,
          croppedImages: croppedImagesData, // Pass the cropped images
          originalImageUrl: uploadedImageUrl, // Pass the original full image
        }),
      })

      const data = await response.json()
      setResults(data.results || {})
    } catch (error) {
      console.error('Error fetching results:', error)
      alert('An error occurred while processing your request')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setCurrentStep('upload')
    setUploadedImageUrl('')
    setSelectedCategories([])
    setResults({})
    setCroppedImages({})
  }

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
                <h2 className="text-2xl font-bold text-gray-800">AI 분석 중...</h2>
                <p className="text-gray-600">이미지에서 아이템을 찾고 있어요</p>
              </div>
            </div>
          </div>
        )}
        {currentStep === 'category' && (
          <CategorySelection
            imageUrl={uploadedImageUrl}
            detectedItems={detectedItems}
            onCategoriesSelected={handleCategoriesSelected}
            onBack={() => setCurrentStep('upload')}
          />
        )}
        {currentStep === 'cropping' && (
          <Cropping
            imageUrl={uploadedImageUrl}
            categories={selectedCategories}
            onCropped={handleCropped}
          />
        )}
        {currentStep === 'results' && (
          <Results
            results={results}
            isLoading={isLoading}
            croppedImages={croppedImages}
            onReset={handleReset}
          />
        )}
      </div>
    </main>
  )
}

