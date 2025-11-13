'use client'

import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string, uploadTimeSeconds?: number) => void
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

        console.log('📥 Conversion response status:', response.status)
        console.log('📥 Response content-type:', response.headers.get('content-type'))

        if (!response.ok) {
          // Try to get error message from JSON response
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Conversion failed')
          } else {
            const errorText = await response.text()
            console.error('❌ Non-JSON error response:', errorText.substring(0, 200))
            throw new Error(`Server error: ${response.status}`)
          }
        }

        // Check if response is actually an image
        const contentType = response.headers.get('content-type')
        if (contentType !== 'image/jpeg') {
          console.error('❌ Unexpected content type:', contentType)
          throw new Error('Server returned invalid response type')
        }

        console.log('✅ HEIC converted to JPEG successfully')

        // Get the converted JPEG as a blob
        const blob = await response.blob()
        console.log('📦 Converted blob size:', blob.size, 'type:', blob.type)
        
        const originalName = file.name.replace(/\.heic$/i, '').replace(/\.heif$/i, '')
        processedFile = new File([blob], `${originalName}.jpg`, { type: 'image/jpeg' })
        
        // Create object URL for preview
        previewUrl = URL.createObjectURL(blob)

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
    const uploadStartTime = performance.now()
    
    try {
      console.log('📤 Starting frontend upload...', {
        name: image.name,
        type: image.type,
        size: image.size,
      })

      let fileToUpload = image
      let compressionTime = 0

      // Compress image if it's larger than 4MB (Vercel limit is 4.5MB)
      if (image.size > 4 * 1024 * 1024) {
        console.log('🗜️ Compressing large image...')
        const compressionStart = performance.now()
        try {
          const compressed = await imageCompression(image, {
            maxSizeMB: 3.5, // Target 3.5MB to have buffer
            maxWidthOrHeight: 2048, // Max dimension
            useWebWorker: true,
            fileType: 'image/jpeg',
          })
          compressionTime = (performance.now() - compressionStart) / 1000
          console.log(`✅ Compressed: ${image.size} → ${compressed.size} bytes (${compressionTime.toFixed(2)}s)`)
          fileToUpload = compressed
        } catch (compressionError) {
          console.error('⚠️ Compression failed, uploading original:', compressionError)
          // Continue with original file
        }
      }

      // Create FormData to send the file
      const formData = new FormData()
      formData.append('file', fileToUpload)

      const uploadRequestStart = performance.now()
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      const uploadRequestTime = (performance.now() - uploadRequestStart) / 1000

      if (!response.ok) {
        console.error('❌ Upload failed:', data)
        throw new Error(data.error || 'Upload failed')
      }

      const totalUploadTime = (performance.now() - uploadStartTime) / 1000
      console.log('✅ Upload successful:', data.imageUrl)
      console.log(`⏱️  Frontend Upload Timing: ${totalUploadTime.toFixed(2)}s (compression: ${compressionTime.toFixed(2)}s, network: ${uploadRequestTime.toFixed(2)}s)`)
      
      onImageUploaded(data.imageUrl, totalUploadTime)
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
      <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center leading-relaxed">
        원하시는 옷<br />찾아드려요!
      </h1>
      
      <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          {isConverting ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
              <p className="text-gray-600">HEIC를 JPEG로 변환하는 중...</p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <img
                src={preview}
                alt="미리보기"
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
                이미지 변경
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
              <p className="text-gray-600">이미지를 업로드하여 시작하세요</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                이미지 선택
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
            disabled={isUploading || isConverting}
            className="mt-6 w-full bg-black text-white py-4 rounded-lg font-semibold hover:bg-gray-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? '업로드 중...' : '계속하기'}
          </button>
        )}
      </div>
    </div>
  )
}

