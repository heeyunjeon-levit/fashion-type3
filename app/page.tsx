'use client'

import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import CategorySelection from './components/CategorySelection'
import Cropping from './components/Cropping'
import Results from './components/Results'

export default function Home() {
  const [currentStep, setCurrentStep] = useState<'upload' | 'category' | 'cropping' | 'results'>('upload')
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('')
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [croppedImages, setCroppedImages] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>>>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleImageUploaded = (imageUrl: string, imageFile: File) => {
    setUploadedImageUrl(imageUrl)
    setUploadedImageFile(imageFile)
    setCurrentStep('category')
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
        {currentStep === 'category' && (
          <CategorySelection
            imageUrl={uploadedImageUrl}
            onCategoriesSelected={handleCategoriesSelected}
            onBack={() => setCurrentStep('upload')}
          />
        )}
        {currentStep === 'cropping' && uploadedImageFile && (
          <Cropping
            imageUrl={uploadedImageUrl}
            imageFile={uploadedImageFile}
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

