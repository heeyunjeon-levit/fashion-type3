'use client'

import { useState } from 'react'
import { categories } from '../constants/categories'

interface CategorySelectionProps {
  imageUrl: string
  onCategoriesSelected: (categories: string[]) => void
  onBack: () => void
}

export default function CategorySelection({
  imageUrl,
  onCategoriesSelected,
  onBack,
}: CategorySelectionProps) {
  // Track category counts instead of simple selection
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})

  const toggleCategory = (categoryId: string) => {
    setCategoryCounts((prev) => {
      const currentCount = prev[categoryId] || 0
      if (currentCount === 0) {
        // First selection: set to 1
        return { ...prev, [categoryId]: 1 }
      } else {
        // Remove category
        const newCounts = { ...prev }
        delete newCounts[categoryId]
        return newCounts
      }
    })
  }

  const incrementCategory = (e: React.MouseEvent, categoryId: string) => {
    e.stopPropagation()
    setCategoryCounts((prev) => {
      const currentCount = prev[categoryId] || 0
      return { ...prev, [categoryId]: currentCount + 1 }
    })
  }

  const decrementCategory = (e: React.MouseEvent, categoryId: string) => {
    e.stopPropagation()
    setCategoryCounts((prev) => {
      const currentCount = prev[categoryId] || 0
      if (currentCount <= 1) {
        // Remove category if count would be 0
        const newCounts = { ...prev }
        delete newCounts[categoryId]
        return newCounts
      } else {
        return { ...prev, [categoryId]: currentCount - 1 }
      }
    })
  }

  // Build the flat array of categories with duplicates
  const getSelectedCategories = () => {
    const result: string[] = []
    Object.entries(categoryCounts).forEach(([categoryId, count]) => {
      for (let i = 0; i < count; i++) {
        result.push(categoryId)
      }
    })
    return result
  }

  const totalCount = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0)

  const handleContinue = () => {
    const categories = getSelectedCategories()
    if (categories.length > 0) {
      onCategoriesSelected(categories)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
        아이템 선택
      </h1>
      <p className="text-gray-600 text-center mb-8">
        클릭하여 선택 후 +/- 버튼으로 수량 조정
      </p>

      <div className="bg-white rounded-2xl shadow-xl p-8">
        {/* Preview Image */}
        <div className="mb-6">
          <img
            src={imageUrl}
            alt="Uploaded"
            className="w-full h-64 object-contain rounded-lg border border-gray-200 bg-gray-50"
          />
        </div>

        {/* Category Buttons */}
        <div className="space-y-4 mb-6">
          {categories.map((category) => {
            const count = categoryCounts[category.id] || 0
            const isSelected = count > 0
            
            return (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className={`w-full p-6 text-left rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-medium text-gray-800 flex items-center gap-3">
                    {category.label}
                    {isSelected && (
                      <span className="text-lg font-semibold text-indigo-600">
                        ×{count}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => decrementCategory(e, category.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-100 font-bold"
                      >
                        −
                      </button>
                      <span className="text-2xl font-bold text-indigo-600 w-8 text-center">
                        {count}
                      </span>
                      <button
                        onClick={(e) => incrementCategory(e, category.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 font-bold"
                      >
                        +
                      </button>
                      <svg
                        className="w-6 h-6 text-indigo-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            뒤로가기
          </button>
          <button
            onClick={handleContinue}
            disabled={totalCount === 0}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            검색 ({totalCount})
          </button>
        </div>
      </div>
    </div>
  )
}
