'use client'

import { categories } from '../constants/categories'

interface ProductOption {
  link: string
  thumbnail: string | null
  title: string | null
}

interface ResultsProps {
  results: Record<string, ProductOption[]>
  isLoading: boolean
  croppedImages?: Record<string, string>
  onReset: () => void
}

export default function Results({ results, isLoading, croppedImages, onReset }: ResultsProps) {
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-white rounded-2xl shadow-xl p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
            <p className="text-gray-600 text-lg">제품 검색 중...</p>
          </div>
        </div>
      </div>
    )
  }

  const categoryNames: Record<string, string> = {
    tops: '상의',
    bottoms: '하의',
    bag: '가방',
    shoes: '신발',
    accessory: '악세사리',
    dress: '드레스',
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
        검색 결과
      </h1>

      <div className="bg-white rounded-2xl shadow-xl p-8">
        {Object.keys(results).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              결과를 찾을 수 없습니다. 다른 이미지로 시도해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Show all cropped images if available */}
        {croppedImages && Object.keys(croppedImages).length > 0 && (
                      <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                        <p className="text-sm font-medium text-gray-700 mb-3">감지된 아이템:</p>
                        <div className="flex flex-wrap gap-3 justify-center">
                          {Object.entries(croppedImages).map(([category, imgUrl]) => {
                            // Handle duplicate categories (e.g., "tops", "tops_1", "tops_2")
                            const categoryKey = category.split('_')[0]
                            const suffix = category.includes('_') ? ` ${category.split('_')[1]}` : ''
                            const displayName = `${categoryNames[categoryKey] || categoryKey}${suffix}`
                            
                            return (
                              <div key={category} className="border border-gray-200 rounded-lg overflow-hidden max-w-[200px]">
                                <p className="text-xs font-medium text-gray-600 px-2 py-1 bg-gray-100 text-center">
                                  {displayName}
                                </p>
                                <img 
                                  src={imgUrl} 
                                  alt={`Cropped ${category}`}
                                  className="w-full h-auto object-contain"
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
            {Object.entries(results).map(([category, links]) => {
              // Handle duplicate categories (e.g., "tops", "tops_1", "tops_2")
              const categoryKey = category.split('_')[0] // Get base category name
              const suffix = category.includes('_') ? ` ${category.split('_')[1]}` : ''
              const displayName = `${categoryNames[categoryKey] || categoryKey}${suffix}`
              
              return (
                <div
                  key={category}
                  className="border-2 border-gray-200 rounded-lg p-6 hover:border-indigo-500 transition-colors"
                >
                  <h3 className="text-xl font-medium text-gray-800 mb-4">
                    {displayName}
                  </h3>
                <div className="grid grid-cols-3 gap-4">
                  {links.map((option, index) => (
                    <a
                      key={index}
                      href={option.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg overflow-hidden transition-colors flex flex-col group relative"
                    >
                      {option.thumbnail ? (
                        <img 
                          src={option.thumbnail} 
                          alt={option.title || `Product ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-2">
                          <span className="text-xs text-gray-600 font-medium mb-2 text-center">
                            옵션 {index + 1}
                          </span>
                          <span className="text-sm text-gray-800 font-semibold text-center mb-3">
                            {new URL(option.link).hostname}
                          </span>
                          <svg
                            className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-white text-xs font-medium line-clamp-2">
                          {option.title || new URL(option.link).hostname}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
              )
            })}
          </div>
        )}

        <button
          onClick={onReset}
          className="mt-8 w-full bg-gray-100 text-gray-700 py-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
        >
          처음부터 다시하기
        </button>
      </div>
    </div>
  )
}

