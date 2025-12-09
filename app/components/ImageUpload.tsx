'use client'

import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { useLanguage } from '../contexts/LanguageContext'
import { isSupportedImageType, needsConversion, getSupportedFormatsString } from '@/lib/imageFormats'

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string, uploadTimeSeconds?: number, localDataUrl?: string) => void
}

export default function ImageUpload({ onImageUploaded }: ImageUploadProps) {
  const { t } = useLanguage()
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!isSupportedImageType(file)) {
      alert(`Unsupported image format. Please use: ${getSupportedFormatsString()}`)
      return
    }

    // Check if file needs server-side conversion (HEIC/HEIF)
    const needsServerConversion = needsConversion(file)

    let processedFile = file

    if (needsServerConversion) {
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

    // ALWAYS generate preview using data URL (not blob URL)
    // This ensures the preview can be used for cropping without CORS issues
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      console.log(`📸 Generated data URL preview: ${dataUrl.substring(0, 50)}... (${Math.round(dataUrl.length / 1024)}KB)`)
    }
    reader.readAsDataURL(processedFile)
  }

  const handleUpload = async () => {
    if (!image) return

    setIsUploading(true)
    const uploadStartTime = performance.now()
    
    try {
      console.log('📤 Starting direct Supabase upload from frontend...', {
        name: image.name,
        type: image.type,
        size: image.size,
        hasPreview: !!preview,
        previewLength: preview?.length || 0,
        previewIsDataUrl: preview?.startsWith('data:'),
        previewStart: preview?.substring(0, 60)
      })
      
      // Critical check: Ensure preview is valid before proceeding
      if (!preview || !preview.startsWith('data:')) {
        console.error('❌ CRITICAL: Preview is not a valid data URL!', {
          hasPreview: !!preview,
          previewType: typeof preview,
          previewStart: preview?.substring(0, 100)
        })
      }

      let fileToUpload = image
      let compressionTime = 0

      // Compress image if it's larger than 2MB (more aggressive threshold)
      if (image.size > 2 * 1024 * 1024) {
        console.log('🗜️ Compressing large image...')
        const compressionStart = performance.now()
        try {
          const compressed = await imageCompression(image, {
            maxSizeMB: 1.5,          // Much smaller: 3.5MB → 1.5MB (faster!)
            maxWidthOrHeight: 1200,  // Lower resolution: 2048px → 1200px (faster!)
            maxIteration: 10,        // Limit iterations for speed
            initialQuality: 0.8,     // Start with lower quality for speed
            useWebWorker: true,
            fileType: 'image/jpeg',
          })
          compressionTime = (performance.now() - compressionStart) / 1000
          console.log(`✅ Compressed: ${(image.size / 1024 / 1024).toFixed(2)}MB → ${(compressed.size / 1024 / 1024).toFixed(2)}MB in ${compressionTime.toFixed(2)}s`)
          fileToUpload = compressed
        } catch (compressionError) {
          console.error('⚠️ Compression failed, uploading original:', compressionError)
        }
      }

      // Upload directly to Supabase from frontend
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Convert file to buffer
      const arrayBuffer = await fileToUpload.arrayBuffer()
      
      // Generate unique filename
      const timestamp = Date.now()
      const sanitizedName = fileToUpload.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .trim() || 'image'
      
      let filename = `upload_${timestamp}_${sanitizedName}`
      
      // Fix extension if needed
      if (fileToUpload.type === 'image/jpeg' && !filename.match(/\.(jpg|jpeg)$/i)) {
        filename = `upload_${timestamp}_${sanitizedName.replace(/\.[^.]+$/, '')}.jpg`
      }

      console.log('📁 Uploading to Supabase:', filename)

      const uploadRequestStart = performance.now()
      const { data, error } = await supabase.storage
        .from('images')
        .upload(filename, arrayBuffer, {
          contentType: fileToUpload.type || 'image/jpeg',
          upsert: false
        })

      const uploadRequestTime = (performance.now() - uploadRequestStart) / 1000

      if (error) {
        console.error('❌ Supabase upload failed:', error)
        throw new Error(error.message || 'Upload failed')
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filename)

      const totalUploadTime = (performance.now() - uploadStartTime) / 1000
      console.log('✅ Direct Supabase upload successful:', publicUrl)
      console.log(`⏱️  Frontend Upload Timing: ${totalUploadTime.toFixed(2)}s (compression: ${compressionTime.toFixed(2)}s, upload: ${uploadRequestTime.toFixed(2)}s)`)
      
      // Ensure we have a valid preview data URL
      // If preview state isn't ready yet, generate it synchronously
      let localDataUrl = preview
      if (!localDataUrl || !localDataUrl.startsWith('data:')) {
        console.warn('⚠️ Preview not ready, generating data URL synchronously...', {
          hasPreview: !!preview,
          previewLength: preview?.length || 0
        })
        const reader = new FileReader()
        localDataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const result = reader.result as string
            console.log(`✅ Sync generated data URL: ${result.substring(0, 60)}... (${Math.round(result.length / 1024)}KB)`)
            resolve(result)
          }
          reader.onerror = (err) => {
            console.error('❌ FileReader error:', err)
            reject(err)
          }
          reader.readAsDataURL(fileToUpload)
        })
      } else {
        console.log(`✅ Using preview state data URL: ${localDataUrl.substring(0, 60)}... (${Math.round(localDataUrl.length / 1024)}KB)`)
      }
      
      // Final validation before callback
      if (!localDataUrl || !localDataUrl.startsWith('data:image/')) {
        console.error('❌ CRITICAL: Final localDataUrl is invalid!', {
          hasLocalDataUrl: !!localDataUrl,
          starts: localDataUrl?.substring(0, 30),
          length: localDataUrl?.length || 0
        })
        throw new Error('Failed to generate valid data URL for cropping')
      }
      
      console.log('✅ Passing valid data URL to parent:', {
        supabaseUrl: publicUrl.substring(0, 60),
        dataUrlStart: localDataUrl.substring(0, 60),
        dataUrlSize: Math.round(localDataUrl.length / 1024) + 'KB'
      })
      
      // Pass local data URL for cropping (avoids CORS issues with Supabase storage)
      onImageUploaded(publicUrl, totalUploadTime, localDataUrl)
    } catch (error) {
      console.error('Error uploading image:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to upload image: ${errorMessage}`)
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center leading-relaxed whitespace-pre-line">
        {t('upload.title')}
      </h1>
      
      <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-20 text-center">
          {isConverting ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
              <p className="text-gray-600">{t('upload.converting')}</p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <img
                src={preview}
                alt={t('upload.preview')}
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
                {t('upload.change')}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
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
              <p className="text-gray-600 text-base">{t('upload.placeholder')}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-black text-white px-8 py-3.5 rounded-lg hover:bg-gray-800 transition-colors font-medium text-base"
              >
                {t('upload.select')}
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
            {isUploading ? t('upload.uploading') : t('upload.continue')}
          </button>
        )}
      </div>
    </div>
  )
}

