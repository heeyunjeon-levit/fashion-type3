'use client'

import { useState, useEffect } from 'react'
import { categories } from '../constants/categories'
import { useLanguage } from '../contexts/LanguageContext'

export interface DetectedItem {
  category: string
  groundingdino_prompt: string
  description: string
  croppedImageUrl?: string
  confidence?: number
}

interface CroppedImageGalleryProps {
  imageUrl: string
  detectedItems: DetectedItem[]
  onItemsSelected: (selectedItems: DetectedItem[]) => void
  onBack: () => void
}

export default function CroppedImageGallery({
  imageUrl,
  detectedItems,
  onItemsSelected,
  onBack,
}: CroppedImageGalleryProps) {
  const { t, language } = useLanguage()
  // Track selected items (pre-select all by default)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  // Pre-select all items on mount
  useEffect(() => {
    const allIndices = new Set(detectedItems.map((_, idx) => idx))
    setSelectedIndices(allIndices)
  }, [detectedItems])

  const toggleItem = (index: number) => {
    setSelectedIndices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const handleContinue = () => {
    const selected = detectedItems.filter((_, idx) => selectedIndices.has(idx))
    if (selected.length > 0) {
      onItemsSelected(selected)
    }
  }

  // Get category label in current language
  const getCategoryLabel = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return categoryId
    return language === 'en' ? category.englishLabel : category.label
  }

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-2 text-center">
        {t('gallery.title')}
      </h1>
      <p className="text-gray-600 text-center mb-2">
        {t('gallery.subtitle')}
      </p>
      {detectedItems.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 text-center">
          <p className="text-green-700 font-medium">
            {t('gallery.aiFound').replace('{count}', detectedItems.length.toString())}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        {/* Original Image */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">{t('gallery.original')}</h3>
          <img
            src={imageUrl}
            alt="Original"
            className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
          />
        </div>

        {detectedItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">{t('gallery.noItems')}</p>
            <button
              onClick={onBack}
              className="mt-6 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              {t('gallery.reupload')}
            </button>
          </div>
        ) : (
          <>
            {/* Cropped Items Grid */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                {t('gallery.croppedItems').replace('{count}', detectedItems.length.toString())}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {detectedItems.map((item, idx) => {
                  const isSelected = selectedIndices.has(idx)

                  return (
                    <button
                      key={idx}
                      onClick={() => toggleItem(idx)}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-black bg-gray-100 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="absolute top-2 left-2 z-10">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'bg-black border-black'
                              : 'bg-white border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-4 h-4 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Cropped Image */}
                      <div className="aspect-square mb-3 overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
                        {item.croppedImageUrl ? (
                          <img
                            src={item.croppedImageUrl}
                            alt={item.groundingdino_prompt}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-gray-400 text-sm">No Image</div>
                        )}
                      </div>

                      {/* Category & Description */}
                      <div className="text-left space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-black">
                            {getCategoryLabel(item.category)}
                          </span>
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                            AI
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {item.description || item.groundingdino_prompt}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={onBack}
                className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                {t('gallery.back')}
              </button>
              <button
                onClick={handleContinue}
                disabled={selectedIndices.size === 0}
                className="flex-2 bg-black text-white py-4 px-8 rounded-lg font-semibold hover:bg-gray-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('gallery.search').replace('{count}', selectedIndices.size.toString())}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

