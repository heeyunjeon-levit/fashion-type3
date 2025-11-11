'use client'

import { useState, useEffect } from 'react'
import PhoneModal from './PhoneModal'
import { getSessionManager } from '../../lib/sessionManager'

interface ProductOption {
  link: string
  thumbnail: string | null
  title: string | null
}

interface ResultsBottomSheetProps {
  results: Record<string, ProductOption[]>
  isLoading: boolean
  croppedImages?: Record<string, string>
  originalImageUrl: string // Background image
  onReset: () => void
  selectedItems?: any[]
}

export default function ResultsBottomSheet({
  results,
  isLoading,
  croppedImages,
  originalImageUrl,
  onReset,
  selectedItems
}: ResultsBottomSheetProps) {
  const [showPhoneModal, setShowPhoneModal] = useState(true)
  const [phoneSubmitted, setPhoneSubmitted] = useState(false)
  const [isReturningUser, setIsReturningUser] = useState(false)
  const [sessionManager, setSessionManager] = useState<any>(null)
  const [sheetHeight, setSheetHeight] = useState<'half' | 'full'>('half')

  // Initialize session manager
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

  const categoryNames: Record<string, string> = {
    tops: '상의',
    bottoms: '하의',
    bag: '가방',
    shoes: '신발',
    accessory: '악세사리',
    dress: '드레스',
  }

  const isBlurred = !phoneSubmitted

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
          <p className="text-gray-800 mt-4 font-medium">제품 검색 중...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Phone Modal */}
      {showPhoneModal && !phoneSubmitted && (
        <PhoneModal
          onPhoneSubmit={handlePhoneSubmit}
          isReturningUser={isReturningUser}
        />
      )}

      {/* Background: Original Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: `url(${originalImageUrl})`,
          filter: isBlurred ? 'blur(8px)' : 'none'
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Close button */}
      <button
        onClick={onReset}
        className="fixed top-6 left-6 z-40 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white transition-colors"
      >
        <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Bottom Sheet */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 z-30 ${
          sheetHeight === 'full' ? 'top-20' : 'top-1/3'
        }`}
        style={{ 
          filter: isBlurred ? 'blur(4px)' : 'none',
          pointerEvents: isBlurred ? 'none' : 'auto'
        }}
      >
        {/* Blur overlay for unpaid access */}
        {isBlurred && (
          <div className="absolute inset-0 backdrop-blur-sm bg-white/30 z-50 flex items-center justify-center rounded-t-3xl">
            <div className="bg-yellow-100 rounded-2xl p-6 shadow-2xl transform rotate-2 max-w-xs mx-4">
              <p className="text-gray-800 font-bold text-center text-lg">
                🔒 전화번호 입력 후<br />상품 링크를 확인하세요!
              </p>
            </div>
          </div>
        )}

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <button
            onClick={() => setSheetHeight(sheetHeight === 'half' ? 'full' : 'half')}
            className="w-12 h-1.5 bg-gray-300 rounded-full hover:bg-gray-400 transition-colors"
          />
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-full pb-24 px-4">
          {Object.keys(results).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-gray-600 text-lg mb-4">결과를 찾을 수 없습니다</p>
              <button
                onClick={onReset}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                다시 시도하기
              </button>
            </div>
          ) : (
            <div className="space-y-8 pb-8">
              {/* Each category = one section */}
              {Object.entries(results).map(([category, links]) => {
                const categoryKey = category.split('_')[0]
                const displayName = categoryNames[categoryKey] || categoryKey
                const itemNumber = category.split('_')[1] || '1'

                return (
                  <div key={category} className="space-y-3">
                    {/* Category header with cropped image */}
                    <div className="flex items-center gap-3">
                      {croppedImages?.[category] && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-indigo-200">
                          <img
                            src={croppedImages[category]}
                            alt={displayName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {displayName} {Object.keys(results).length > 1 && `#${itemNumber}`}
                        </h3>
                        <p className="text-sm text-gray-500">{links.length}개 상품</p>
                      </div>
                    </div>

                    {/* Horizontal scroll for 3 products */}
                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                      {links.map((option, index) => (
                        <a
                          key={index}
                          href={option.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleLinkClick(category, option.link, option.title, option.thumbnail, index + 1)}
                          className="flex-shrink-0 w-40 snap-center group"
                        >
                          <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200 group-hover:border-indigo-300">
                            {/* Product image */}
                            <div className="aspect-square bg-gray-100 relative overflow-hidden">
                              {option.thumbnail ? (
                                <img
                                  src={option.thumbnail}
                                  alt={option.title || 'Product'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Product info */}
                            <div className="p-3 space-y-1">
                              <p className="text-xs text-gray-500 uppercase tracking-wide truncate">
                                {option.link ? new URL(option.link).hostname.replace('www.', '') : 'Store'}
                              </p>
                              <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                                {option.title || 'View Product'}
                              </p>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3">
          <button
            onClick={onReset}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
          >
            새로 시작
          </button>
          <button
            onClick={() => setSheetHeight(sheetHeight === 'full' ? 'half' : 'full')}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
          >
            {sheetHeight === 'full' ? '접기' : '전체보기'}
          </button>
        </div>
      </div>

      {/* Custom scrollbar hide */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  )
}

