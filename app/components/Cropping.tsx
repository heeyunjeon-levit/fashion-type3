'use client'

import { useState, useEffect, useRef } from 'react'

interface CroppingProps {
  imageUrl: string
  categories: string[]
  onCropped: (croppedImages: Record<string, string>) => void
}

const categoryLabels: Record<string, string> = {
  tops: '상의',
  bottoms: '하의',
  bag: '가방',
  shoes: '신발',
  accessory: '악세사리',
  dress: '드레스',
}

export default function Cropping({ imageUrl, categories, onCropped }: CroppingProps) {
  const [croppedImages, setCroppedImages] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isCropping, setIsCropping] = useState(false)
  const hasProcessedRef = useRef(false)

  useEffect(() => {
    // Prevent duplicate processing
    if (hasProcessedRef.current) {
      return
    }
    hasProcessedRef.current = true

    const cropImages = async () => {
      setIsCropping(true)
      const results: Record<string, string> = {}

      // Group categories by type and count occurrences
      const categoryCounts: Record<string, number> = {}
      categories.forEach(cat => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
      })

      console.log('📊 Category counts:', categoryCounts)

      // Process each unique category type
      // Support multiple backends: CPU (stable) and GPU/Roboflow (testing)
      const cpuBackend = process.env.NEXT_PUBLIC_PYTHON_CROPPER_URL || 'http://localhost:8000'
      const gpuBackend = process.env.NEXT_PUBLIC_PYTHON_CROPPER_URL_GPU || cpuBackend
      const useGpu = process.env.NEXT_PUBLIC_USE_GPU_BACKEND === 'true'
      
      const PYTHON_CROPPER_URL = useGpu ? gpuBackend : cpuBackend
      
      console.log(`🖥️  Using ${useGpu ? 'GPU (Roboflow)' : 'CPU'} backend: ${PYTHON_CROPPER_URL}`)
      
      const cropPromises = Object.entries(categoryCounts).map(async ([category, count]) => {
        console.log(`🔄 Cropping ${category} ×${count}...`)

        try {
          const response = await fetch(`${PYTHON_CROPPER_URL}/crop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl,
              categories: [category],
              count: count, // Tell backend how many instances to find
            }),
          })

          const data = await response.json()
          console.log(`📥 Response for ${category}:`, data)

          // Handle multiple cropped URLs
          if (data.croppedImageUrls && Array.isArray(data.croppedImageUrls)) {
            return { category, urls: data.croppedImageUrls }
          } else if (data.croppedImageUrl) {
            // Fallback for single URL
            return { category, urls: [data.croppedImageUrl] }
          }
        } catch (error) {
          console.error(`❌ Error cropping ${category}:`, error)
        }
        return { category, urls: [] }
      })

      // Wait for all crops to complete
      const cropResults = await Promise.all(cropPromises)

      // Process results and assign to unique keys
      cropResults.forEach((result) => {
        if (result && result.urls.length > 0) {
          const { category, urls } = result

          // Create unique keys for each instance
          urls.forEach((url: string, instanceIndex: number) => {
            // First instance has no suffix, subsequent ones have _1, _2, _3, etc.
            const key = instanceIndex === 0 ? category : `${category}_${instanceIndex}`
            results[key] = url
          })

          setCroppedImages({ ...results })
        }
      })

      setIsCropping(false)
      console.log('📊 Final cropped results:', results)

      // Proceed immediately after crops finish
      onCropped(results)
    }

    cropImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, categories]) // Removed onCropped from deps to prevent duplicate calls

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
        Detecting Items
      </h1>

      <div className="bg-white rounded-2xl shadow-xl p-8">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">
              {isCropping 
                ? `Processing all items...` 
                : 'Complete!'}
            </span>
            <span className="text-sm text-gray-500">
              {Object.keys(croppedImages).length} / {categories.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ 
                width: `${(Object.keys(croppedImages).length / categories.length) * 100}%` 
              }}
            />
          </div>
        </div>

        {/* Show all cropped images as they come in */}
        {Object.keys(croppedImages).length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(croppedImages).map(([cat, url]) => (
              <div key={cat} className="border-2 border-indigo-200 rounded-lg p-2 bg-indigo-50">
                <p className="text-xs font-medium text-indigo-700 mb-1 text-center">
                  ✓ {categoryLabels[cat] || cat}
                </p>
                <img 
                  src={url} 
                  alt={`Cropped ${cat}`}
                  className="w-full rounded"
                />
              </div>
            ))}
          </div>
        )}
        
        {isCropping && Object.keys(croppedImages).length === 0 && (
          <div className="border-2 border-gray-200 rounded-lg p-12 bg-gray-50">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
              <p className="text-gray-600">
                Detecting fashion items...
              </p>
            </div>
          </div>
        )}

        {/* Show all detected items summary */}
        {Object.keys(croppedImages).length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Detected:</h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(croppedImages).map((cat) => {
                const categoryKey = cat.split('_')[0]
                const suffix = cat.includes('_') ? ` ${cat.split('_')[1]}` : ''
                const displayLabel = `${categoryLabels[categoryKey] || categoryKey}${suffix}`
                
                return (
                  <div
                    key={cat}
                    className="p-2 rounded text-center text-sm bg-green-100 text-green-700 border-2 border-green-300"
                  >
                    ✓ {displayLabel}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

