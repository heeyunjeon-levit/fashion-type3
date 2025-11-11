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
  onBack?: () => void // Go back to cropped images selection
  selectedItems?: any[]
}

export default function ResultsBottomSheet({
  results,
  isLoading,
  croppedImages,
  originalImageUrl,
  onReset,
  onBack,
  selectedItems
}: ResultsBottomSheetProps) {
  const [showPhoneModal, setShowPhoneModal] = useState(true)
  const [phoneSubmitted, setPhoneSubmitted] = useState(false)
  const [isReturningUser, setIsReturningUser] = useState(false)
  const [sessionManager, setSessionManager] = useState<any>(null)
  const [sheetPosition, setSheetPosition] = useState<'peek' | 'half' | 'full'>('half')
  const [dragStartY, setDragStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

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

  // Drag handlers
  const handleDragStart = (clientY: number) => {
    setIsDragging(true)
    setDragStartY(clientY)
    setCurrentY(clientY)
  }

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return
    setCurrentY(clientY)
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)

    const deltaY = currentY - dragStartY
    const threshold = 50 // minimum drag distance to trigger change

    if (Math.abs(deltaY) < threshold) {
      return // No change if drag too small
    }

    // Dragging down (positive deltaY)
    if (deltaY > 0) {
      if (sheetPosition === 'full') {
        setSheetPosition('half')
      } else if (sheetPosition === 'half') {
        setSheetPosition('peek')
      }
    }
    // Dragging up (negative deltaY)
    else {
      if (sheetPosition === 'peek') {
        setSheetPosition('half')
      } else if (sheetPosition === 'half') {
        setSheetPosition('full')
      }
    }
  }

  // Mouse events - only for handle
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent event from bubbling
    handleDragStart(e.clientY)
  }

  const handleMouseMove = (e: MouseEvent) => {
    handleDragMove(e.clientY)
  }

  const handleMouseUp = () => {
    handleDragEnd()
  }

  // Touch events - only for handle
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation() // Prevent event from bubbling
    handleDragStart(e.touches[0].clientY)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return
    e.preventDefault() // Only prevent when actually dragging
    handleDragMove(e.touches[0].clientY)
  }

  const handleTouchEnd = () => {
    handleDragEnd()
  }

  // Attach global mouse/touch listeners when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleTouchEnd)
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('touchmove', handleTouchMove)
        window.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging, currentY])

  // Prevent drag when scrolling content + prevent pull-to-refresh
  useEffect(() => {
    if (isDragging) {
      document.body.style.overflow = 'hidden'
      document.body.style.overscrollBehavior = 'none' // Prevent pull-to-refresh
    } else {
      document.body.style.overflow = ''
      document.body.style.overscrollBehavior = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.overscrollBehavior = ''
    }
  }, [isDragging])

  // Prevent pull-to-refresh globally on this page (but not on input fields, scrollable content, or horizontal scrolls)
  useEffect(() => {
    let touchStartY = 0
    let touchStartX = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
      touchStartX = e.touches[0].clientX
    }

    const preventPullToRefresh = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      
      // Don't prevent if user is interacting with an input field
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      // Don't prevent if user is inside the bottom sheet content area
      const contentArea = document.querySelector('.overflow-y-auto')
      if (contentArea && contentArea.contains(target)) {
        return // Allow scrolling inside bottom sheet
      }

      // Check if this is a horizontal scroll
      const touchCurrentY = e.touches[0].clientY
      const touchCurrentX = e.touches[0].clientX
      const deltaX = Math.abs(touchCurrentX - touchStartX)
      const deltaY = Math.abs(touchCurrentY - touchStartY)

      // If horizontal movement is greater, allow it (horizontal scroll)
      if (deltaX > deltaY) {
        return
      }

      // Only prevent vertical pull-to-refresh if we're at the top of the page
      if (window.scrollY === 0 && touchCurrentY > touchStartY) {
        e.preventDefault()
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', preventPullToRefresh)
    }
  }, [])

  const categoryNames: Record<string, string> = {
    tops: '상의',
    bottoms: '하의',
    bag: '가방',
    shoes: '신발',
    accessory: '악세사리',
    dress: '드레스',
  }

  const isBlurred = !phoneSubmitted

  // Calculate sheet height based on position and drag
  const getSheetStyle = () => {
    const positions = {
      peek: '85vh',    // Show just a peek
      half: '60vh',    // Half screen
      full: '10vh',    // Almost full (leave space for status bar)
    }

    let topPosition = positions[sheetPosition]

    // Apply drag offset while dragging
    if (isDragging) {
      const dragOffset = currentY - dragStartY
      const currentTop = parseInt(positions[sheetPosition])
      const newTop = Math.max(10, Math.min(85, currentTop + (dragOffset / window.innerHeight) * 100))
      topPosition = `${newTop}vh`
    }

    return { top: topPosition }
  }

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
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${originalImageUrl})`,
          backgroundSize: 'cover',
          touchAction: 'none' // Prevent pull-to-refresh on background
        }}
      >
        {/* Dark overlay - lighter when sheet is down */}
        <div 
          className="absolute inset-0 bg-black transition-opacity duration-300"
          style={{
            opacity: sheetPosition === 'peek' ? 0.2 : 0.4
          }}
        ></div>
      </div>

      {/* Back button */}
      <button
        onClick={onBack || onReset}
        className="fixed top-6 left-6 z-40 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white transition-colors"
        title="뒤로가기"
      >
        <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Bottom Sheet */}
      <div 
        className="fixed left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-30"
        style={{ 
          ...getSheetStyle(),
          bottom: 0,
          filter: isBlurred ? 'blur(4px)' : 'none',
          pointerEvents: isBlurred ? 'none' : 'auto',
          transition: isDragging ? 'none' : 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'top'
          // touchAction removed - allow scrolling inside
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

        {/* Drag handle - ONLY area that controls sheet position */}
        <div 
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none', userSelect: 'none' }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Content */}
        <div 
          className="overflow-y-auto h-full pb-24 px-4"
          style={{ 
            touchAction: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain'
          }}
        >
          {Object.keys(results).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-gray-600 text-lg mb-4">결과를 찾을 수 없습니다</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onReset}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  처음부터
                </button>
                <button
                  onClick={onBack || onReset}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all active:scale-95"
                >
                  다시 선택하기
                </button>
              </div>
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
                    <div 
                      className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
                      style={{ 
                        touchAction: 'auto',
                        overscrollBehaviorX: 'contain'
                      }}
                    >
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

        {/* Bottom action bar - only show when not at peek */}
        {sheetPosition !== 'peek' && (
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-2 z-20">
            <button
              onClick={onReset}
              className="flex-shrink-0 bg-gray-100 text-gray-700 p-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
              title="처음부터 다시"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <button
              onClick={onBack || onReset}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
            >
              다시 선택
            </button>
            <button
              onClick={() => setSheetPosition(sheetPosition === 'full' ? 'half' : 'full')}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg active:scale-95"
            >
              {sheetPosition === 'full' ? '접기' : '전체보기'}
            </button>
          </div>
        )}

        {/* Peek state hint */}
        {sheetPosition === 'peek' && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <div className="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
              ↑ 위로 드래그하여 상품 보기
            </div>
          </div>
        )}
      </div>

      {/* Global styles */}
      <style jsx global>{`
        /* Prevent pull-to-refresh globally on iOS */
        html, body {
          overscroll-behavior-y: none;
        }
        
        /* Hide scrollbar */
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

