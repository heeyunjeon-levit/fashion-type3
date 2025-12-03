'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface BboxItem {
  id: string
  bbox: [number, number, number, number]
  category: string
  mapped_category: string
  confidence: number
  selected?: boolean
}

interface ManualCropSelectorProps {
  imageUrl: string
  onCropComplete: (bboxes: BboxItem[]) => void
  onBack: () => void
}

const CATEGORY_OPTIONS = [
  { value: 'tops', labelEn: 'Top / Shirt', labelKo: '상의 / 셔츠' },
  { value: 'outerwear', labelEn: 'Jacket / Coat', labelKo: '재킷 / 코트' },
  { value: 'dress', labelEn: 'Dress', labelKo: '드레스' },
  { value: 'bottoms', labelEn: 'Pants / Skirt', labelKo: '바지 / 스커트' },
  { value: 'bag', labelEn: 'Bag', labelKo: '가방' },
  { value: 'shoes', labelEn: 'Shoes', labelKo: '신발' },
  { value: 'accessories', labelEn: 'Accessories', labelKo: '악세사리' },
]

export default function ManualCropSelector({ imageUrl, onCropComplete, onBack }: ManualCropSelectorProps) {
  const { language } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null)
  const [drawnBox, setDrawnBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('tops')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 })

  useEffect(() => {
    const img = imageRef.current
    if (img && img.complete) {
      handleImageLoad()
    }
  }, [])

  const handleImageLoad = () => {
    const img = imageRef.current
    if (img) {
      setImageDimensions({
        width: img.clientWidth,
        height: img.clientHeight,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      })
      setImageLoaded(true)
    }
  }

  const getRelativeCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }
    
    const rect = container.getBoundingClientRect()
    let clientX: number, clientY: number
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    }
  }

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const coords = getRelativeCoords(e)
    setIsDrawing(true)
    setStartPoint(coords)
    setCurrentPoint(coords)
    setDrawnBox(null)
  }

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPoint) return
    e.preventDefault()
    setCurrentPoint(getRelativeCoords(e))
  }

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPoint || !currentPoint) return
    e.preventDefault()
    setIsDrawing(false)
    
    // Calculate final box (normalized coordinates 0-1)
    const x1 = Math.min(startPoint.x, currentPoint.x)
    const y1 = Math.min(startPoint.y, currentPoint.y)
    const x2 = Math.max(startPoint.x, currentPoint.x)
    const y2 = Math.max(startPoint.y, currentPoint.y)
    
    // Only save if box is big enough (at least 5% of image)
    const boxWidth = x2 - x1
    const boxHeight = y2 - y1
    if (boxWidth > 0.05 && boxHeight > 0.05) {
      setDrawnBox({ x1, y1, x2, y2 })
    }
    
    setStartPoint(null)
    setCurrentPoint(null)
  }

  const handleSubmit = () => {
    if (!drawnBox) return
    
    // Create a bbox item from the drawn box
    const bboxItem: BboxItem = {
      id: `manual_${Date.now()}`,
      bbox: [drawnBox.x1, drawnBox.y1, drawnBox.x2, drawnBox.y2],
      category: selectedCategory,
      mapped_category: selectedCategory,
      confidence: 1.0, // User-drawn = full confidence
      selected: true
    }
    
    onCropComplete([bboxItem])
  }

  const handleClear = () => {
    setDrawnBox(null)
    setStartPoint(null)
    setCurrentPoint(null)
  }

  // Calculate current selection box for display
  const getSelectionStyle = () => {
    if (!startPoint || !currentPoint || !isDrawing) return null
    
    const x1 = Math.min(startPoint.x, currentPoint.x) * 100
    const y1 = Math.min(startPoint.y, currentPoint.y) * 100
    const x2 = Math.max(startPoint.x, currentPoint.x) * 100
    const y2 = Math.max(startPoint.y, currentPoint.y) * 100
    
    return {
      left: `${x1}%`,
      top: `${y1}%`,
      width: `${x2 - x1}%`,
      height: `${y2 - y1}%`
    }
  }

  const getDrawnBoxStyle = () => {
    if (!drawnBox) return null
    
    return {
      left: `${drawnBox.x1 * 100}%`,
      top: `${drawnBox.y1 * 100}%`,
      width: `${(drawnBox.x2 - drawnBox.x1) * 100}%`,
      height: `${(drawnBox.y2 - drawnBox.y1) * 100}%`
    }
  }

  const selectionStyle = getSelectionStyle()
  const drawnBoxStyle = getDrawnBoxStyle()

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="w-full mb-4 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          {language === 'ko' ? '✂️ 직접 영역 선택' : '✂️ Manual Crop'}
        </h2>
        <p className="text-gray-600 text-sm">
          {language === 'ko' 
            ? '이미지에서 검색할 영역을 드래그하여 선택하세요' 
            : 'Drag to select the area you want to search'}
        </p>
      </div>

      {/* Image with crop overlay */}
      <div 
        ref={containerRef}
        className="relative w-full bg-gray-100 rounded-xl overflow-hidden cursor-crosshair touch-none select-none"
        style={{ aspectRatio: imageDimensions.naturalWidth && imageDimensions.naturalHeight 
          ? `${imageDimensions.naturalWidth}/${imageDimensions.naturalHeight}` 
          : '1/1' 
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Image to crop"
          className="w-full h-full object-contain"
          onLoad={handleImageLoad}
          draggable={false}
        />
        
        {/* Overlay for dimming */}
        {(isDrawing || drawnBox) && (
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        )}
        
        {/* Current drawing selection */}
        {selectionStyle && (
          <div 
            className="absolute border-2 border-dashed border-white bg-white/20 pointer-events-none"
            style={selectionStyle}
          />
        )}
        
        {/* Final drawn box */}
        {drawnBoxStyle && !isDrawing && (
          <div 
            className="absolute border-3 border-solid border-purple-500 bg-purple-500/20 pointer-events-none"
            style={drawnBoxStyle}
          >
            <div className="absolute -top-6 left-0 bg-purple-500 text-white text-xs px-2 py-1 rounded">
              {CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.[language === 'ko' ? 'labelKo' : 'labelEn']}
            </div>
          </div>
        )}
        
        {/* Instructions overlay */}
        {!drawnBox && !isDrawing && imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 text-white px-4 py-2 rounded-lg text-center">
              <p className="text-sm font-medium">
                {language === 'ko' ? '👆 드래그하여 영역 선택' : '👆 Drag to select area'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Category selector */}
      <div className="w-full mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {language === 'ko' ? '카테고리 선택:' : 'Select Category:'}
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat.value
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {language === 'ko' ? cat.labelKo : cat.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full mt-6 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          {language === 'ko' ? '← 돌아가기' : '← Go Back'}
        </button>
        
        {drawnBox && (
          <button
            onClick={handleClear}
            className="px-4 py-3 bg-red-100 text-red-600 rounded-xl font-medium hover:bg-red-200 transition-colors"
          >
            {language === 'ko' ? '다시 선택' : 'Clear'}
          </button>
        )}
        
        <button
          onClick={handleSubmit}
          disabled={!drawnBox}
          className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
            drawnBox
              ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-md'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {language === 'ko' ? '검색하기 →' : 'Search →'}
        </button>
      </div>
    </div>
  )
}

