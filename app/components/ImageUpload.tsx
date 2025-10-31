'use client'

import { useState, useRef } from 'react'

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void
}

export default function ImageUpload({ onImageUploaded }: ImageUploadProps) {
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check if file is HEIC/HEIF format
    const isHEIC = file.type === 'image/heic' || 
                   file.type === 'image/heif' || 
                   file.name.toLowerCase().endsWith('.heic') || 
                   file.name.toLowerCase().endsWith('.heif')

    let processedFile = file
    let previewUrl = ''

    if (isHEIC) {
      setIsConverting(true)
      try {
        console.log('🔄 Converting HEIC to JPEG via server...')
        
        // Send to server for conversion
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/convert-heic', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Conversion failed')
        }

        console.log('✅ HEIC converted to JPEG successfully')

        // Convert data URL back to File object
        const base64Response = await fetch(data.dataUrl)
        const blob = await base64Response.blob()
        
        const originalName = file.name.replace(/\.heic$/i, '').replace(/\.heif$/i, '')
        processedFile = new File([blob], `${originalName}.jpg`, { type: 'image/jpeg' })
        
        // Use the data URL for preview
        previewUrl = data.dataUrl

      } catch (error) {
        console.error('❌ Error converting HEIC:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        alert(`Failed to convert HEIC image: ${errorMessage}`)
        setIsConverting(false)
        return
      } finally {
        setIsConverting(false)
      }
    }

    // Set the processed file
    setImage(processedFile)

    // Generate preview
    if (previewUrl) {
      setPreview(previewUrl)
    } else {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(processedFile)
    }
  }

  const handleUpload = async () => {
    if (!image) return

    setIsUploading(true)
    try {
      console.log('📤 Starting upload...', {
        name: image.name,
        type: image.type,
        size: image.size,
      })

      // Create FormData to send the file
      const formData = new FormData()
      formData.append('file', image)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Upload failed:', data)
        throw new Error(data.error || 'Upload failed')
      }

      console.log('✅ Upload successful:', data.imageUrl)
      onImageUploaded(data.imageUrl)
    } catch (error) {
      console.error('Error uploading image:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to upload image: ${errorMessage}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
        Image Search
      </h1>
      
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          {isConverting ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-600">Converting HEIC to JPEG...</p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <img
                src={preview}
                alt="Preview"
                className="max-h-64 mx-auto rounded-lg shadow-md"
              />
              <button
                onClick={() => {
                  setImage(null)
                  setPreview('')
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="text-gray-600 hover:text-gray-800 underline"
              >
                Change Image
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-gray-600">Upload an image to get started</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Select Image
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {image && (
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  )
}

