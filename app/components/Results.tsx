'use client'

import { useState, useEffect } from 'react'
import { categories } from '../constants/categories'
import PhoneModal from './PhoneModal'
import { getSessionManager } from '../../lib/sessionManager'

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
  selectedItems?: any[] // For tracking item descriptions
}

export default function Results({ results, isLoading, croppedImages, onReset, selectedItems }: ResultsProps) {
  const [showPhoneModal, setShowPhoneModal] = useState(true) // Show modal by default
  const [phoneSubmitted, setPhoneSubmitted] = useState(false)
  const [isReturningUser, setIsReturningUser] = useState(false)
  const [sessionManager, setSessionManager] = useState<any>(null)

  // Initialize session manager on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const manager = getSessionManager()
      setSessionManager(manager)
      setIsReturningUser(manager.isReturningUser())
    }
  }, [])

  const handlePhoneSubmit = async (phoneNumber: string) => {
    if (!sessionManager) return
    
    try {
      const result = await sessionManager.logPhoneNumber(phoneNumber)
      setPhoneSubmitted(true)
      setShowPhoneModal(false)
      
      // Show welcome message for returning users
      if (result.isReturningUser) {
        console.log(`환영합니다! 총 ${result.totalSearches}번 방문하셨습니다.`)
      }
    } catch (error) {
      console.error('Failed to submit phone number:', error)
      throw error
    }
  }

  const handleLinkClick = async (
    category: string,
    productLink: string,
    productTitle: string | null,
    productThumbnail: string | null,
    linkPosition: number
  ) => {
    if (!sessionManager) return
    
    // Find the item description from selectedItems
    const categoryKey = category.split('_')[0]
    const itemIndex = parseInt(category.split('_')[1] || '1') - 1
    const selectedItem = selectedItems?.[itemIndex]
    const itemDescription = selectedItem?.groundingdino_prompt || selectedItem?.description || categoryKey

    await sessionManager.logLinkClick({
      itemCategory: categoryKey,
      itemDescription,
      productLink,
      productTitle: productTitle || undefined,
      productThumbnail: productThumbnail || undefined,
      linkPosition,
    })
  }

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

  const totalCroppedImages = croppedImages ? Object.keys(croppedImages).length : 0

  // Debug logging
  useEffect(() => {
    console.log('🔍 Results Component State:', {
      showPhoneModal,
      phoneSubmitted,
      hasSessionManager: !!sessionManager,
      isReturningUser
    })
  }, [showPhoneModal, phoneSubmitted, sessionManager, isReturningUser])

  return (
    <>
      {/* Phone Modal - Shows on top of results */}
      {showPhoneModal && !phoneSubmitted && (
        <PhoneModal
          onPhoneSubmit={handlePhoneSubmit}
          isReturningUser={isReturningUser}
        />
      )}

      <div className="max-w-7xl mx-auto mt-8 px-4">
        {Object.keys(results).length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <p className="text-gray-600 text-lg">
            결과를 찾을 수 없습니다. 다른 이미지로 시도해보세요.
          </p>
          <button
            onClick={onReset}
            className="mt-6 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            처음부터 다시하기
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Cropped Images Section */}
          {croppedImages && totalCroppedImages > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-indigo-600 mb-6 flex items-center gap-2">
                <span>✂️</span>
                <span>Cropped Images ({totalCroppedImages}):</span>
              </h2>
              <div className="flex flex-wrap gap-4">
                {Object.entries(croppedImages).map(([category, imgUrl]) => (
                  <div 
                    key={category} 
                    className="rounded-2xl overflow-hidden shadow-md border border-gray-200"
                    style={{ width: '180px', height: '180px' }}
                  >
                    <img 
                      src={imgUrl} 
                      alt={`Cropped ${category}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results by Category */}
          {Object.entries(results).map(([category, links]) => {
            const categoryKey = category.split('_')[0]
            const displayName = categoryNames[categoryKey] || categoryKey
            const numProducts = links.length
            
            return (
              <div key={category} className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-3xl font-bold text-indigo-600 mb-8">
                  {displayName.toUpperCase()} ({numProducts} products)
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {links.map((option, index) => {
                    const isBlurred = !phoneSubmitted // Blur if phone not submitted
                    
                    return (
                      <div 
                        key={index}
                        className={`bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 hover:shadow-xl transition-all flex flex-col relative ${isBlurred ? 'pointer-events-none' : ''}`}
                      >
                        {/* Blur overlay when phone not submitted */}
                        {isBlurred && (
                          <div className="absolute inset-0 backdrop-blur-md bg-white/30 z-10 flex items-center justify-center">
                            <div className="bg-yellow-100 rounded-xl p-4 shadow-lg transform rotate-2">
                              <p className="text-gray-800 font-bold text-center">
                                🔒 전화번호 입력 후<br />확인 가능합니다
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Product Image */}
                        <div className="aspect-[4/3] overflow-hidden bg-gray-50">
                          {option.thumbnail ? (
                            <img 
                              src={option.thumbnail} 
                              alt={option.title || `Product ${index + 1}`}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              No Image
                            </div>
                          )}
                        </div>
                        
                        {/* Product Title */}
                        <div className="p-4 flex-grow">
                          <p className="text-sm text-gray-800 line-clamp-2 min-h-[2.5rem]">
                            {option.title || new URL(option.link).hostname}
                          </p>
                        </div>
                        
                        {/* View Product Button */}
                        <div className="p-4 pt-0">
                          <a
                            href={option.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleLinkClick(category, option.link, option.title, option.thumbnail, index + 1)}
                            className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
                          >
                            View Product →
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Reset Button */}
          <div className="text-center pb-8">
            <button
              onClick={onReset}
              className="bg-gray-100 text-gray-700 px-8 py-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              처음부터 다시하기
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  )
}

