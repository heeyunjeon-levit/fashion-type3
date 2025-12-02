'use client'

import { useState, useEffect, useRef } from 'react'
import PhoneModal from './PhoneModal'
import FeedbackModal from './FeedbackModal'
import { getSessionManager } from '../../lib/sessionManager'
import { useLanguage } from '../contexts/LanguageContext'

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
  onResearch?: () => void // Re-run search with same items
  selectedItems?: any[]
}

export default function ResultsBottomSheet({
  results,
  isLoading,
  croppedImages,
  originalImageUrl,
  onReset,
  onBack,
  onResearch,
  selectedItems
}: ResultsBottomSheetProps) {
  const { t, language } = useLanguage()
  const [showPhoneModal, setShowPhoneModal] = useState(true)
  const [phoneSubmitted, setPhoneSubmitted] = useState(false)
  const [isReturningUser, setIsReturningUser] = useState(false)
  const [sessionManager, setSessionManager] = useState<any>(null)
  const [sheetPosition, setSheetPosition] = useState<'peek' | 'half' | 'full'>('half')
  const [dragStartY, setDragStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  
  // Feedback modal
  const feedbackModalRef = useRef<any>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userPhoneNumber, setUserPhoneNumber] = useState<string>('')
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const productClickTimeKey = 'product_click_time_main_app'

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
      setUserPhoneNumber(phoneNumber)
      
      console.log('📱 Phone submitted:', phoneNumber)
      console.log('🎯 FeedbackModal will render with phone:', phoneNumber)
      
      // Start 45-second fallback timer for feedback modal
      feedbackTimerRef.current = setTimeout(() => {
        console.log('⏰ 45s fallback - attempting to show feedback modal')
        console.log('📍 feedbackModalRef.current:', feedbackModalRef.current)
        if (feedbackModalRef.current) {
          console.log('✅ Ref exists, calling show()')
          feedbackModalRef.current.show()
        } else {
          console.error('❌ feedbackModalRef.current is null!')
        }
      }, 45000)
      
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
    
    // Save product click timestamp for feedback modal trigger
    if (typeof window !== 'undefined') {
      const timestamp = Date.now().toString()
      localStorage.setItem(productClickTimeKey, timestamp)
      console.log('🖱️ Product clicked, timestamp saved:', timestamp)
      console.log('💡 When you return to this page, modal should show after 3s')
    }
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

  // Feedback modal: Check for product click on page return
  useEffect(() => {
    if (!userPhoneNumber) return

    const handleVisibilityChange = () => {
      console.log('👁️ Visibility changed:', document.visibilityState)
      
      if (document.visibilityState === 'visible') {
        console.log('✅ Page became visible, checking for product click...')
        const clickTime = localStorage.getItem(productClickTimeKey)
        console.log('🔍 Product click timestamp:', clickTime)
        
        if (clickTime) {
          const timeSinceClick = Date.now() - parseInt(clickTime)
          const fiveMinutes = 5 * 60 * 1000
          
          console.log(`⏱️ Time since product click: ${Math.round(timeSinceClick / 1000)}s`)
          
          if (timeSinceClick < fiveMinutes) {
            console.log('👋 User returned from product page, showing feedback modal in 3s')
            console.log('📍 feedbackModalRef.current:', feedbackModalRef.current)
            setTimeout(() => {
              console.log('⏰ 3s elapsed, calling show()')
              feedbackModalRef.current?.show()
            }, 3000)
            
            // Clear the timestamp so we don't show again
            localStorage.removeItem(productClickTimeKey)
          } else {
            console.log('⏭️ Product click was too long ago (>5min)')
          }
        } else {
          console.log('ℹ️ No product click timestamp found')
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [userPhoneNumber, productClickTimeKey])

  // Feedback modal: Detect scroll to bottom
  useEffect(() => {
    if (!userPhoneNumber || !scrollContainerRef.current) return

    const handleScroll = () => {
      const container = scrollContainerRef.current
      if (!container) return

      const scrollTop = container.scrollTop
      const scrollHeight = container.scrollHeight
      const clientHeight = container.clientHeight
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      console.log('📜 Scroll detected, distance from bottom:', Math.round(distanceFromBottom), 'px')

      // If within 50px of bottom
      if (distanceFromBottom < 50) {
        console.log('✅ Near bottom! Starting 3s timer for feedback modal')
        
        // Clear any existing timer
        if (scrollTimerRef.current) {
          clearTimeout(scrollTimerRef.current)
        }

        // Show modal after 3 seconds at bottom
        scrollTimerRef.current = setTimeout(() => {
          console.log('📜 User stayed at bottom for 3s, showing feedback modal')
          console.log('📍 feedbackModalRef.current:', feedbackModalRef.current)
          feedbackModalRef.current?.show()
        }, 3000)
      } else {
        // Clear timer if user scrolls away from bottom
        if (scrollTimerRef.current) {
          console.log('⏹️ Scrolled away from bottom, canceling timer')
          clearTimeout(scrollTimerRef.current)
          scrollTimerRef.current = null
        }
      }
    }

    const container = scrollContainerRef.current
    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [userPhoneNumber])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
      }
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
      }
    }
  }, [])

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

  const getCategoryName = (categoryKey: string): string => {
    if (language !== 'en') {
      // Korean translations for specific item names
      const categoryMap: Record<string, string> = {
        // Broad categories (fallback)
        'top': '상의',
        'tops': '상의',
        'bottom': '하의',
        'bottoms': '하의',
        'bag': '가방',
        'shoes': '신발',
        'accessory': '악세사리',
        'accessories': '악세사리',
        'dress': '드레스',
        'outerwear': '아우터',
        // Specific items
        'button up shirt': '셔츠',
        'button_up_shirt': '셔츠',
        'shirt': '셔츠',
        'blouse': '블라우스',
        't-shirt': '티셔츠',
        'tshirt': '티셔츠',
        'tee': '티셔츠',
        'jacket': '재킷',
        'coat': '코트',
        'cardigan': '가디건',
        'hoodie': '후드티',
        'vest': '조끼',
        'blazer': '블레이저',
        'sweater': '스웨터',
        'pants': '바지',
        'jeans': '청바지',
        'skirt': '치마',
        'shorts': '반바지',
        'leggings': '레깅스',
        'handbag': '핸드백',
        'backpack': '백팩',
        'tote': '토트백',
        'clutch': '클러치',
        'crossbody': '크로스백',
        'shoulder bag': '숄더백',
        'purse': '지갑',
        'wallet': '지갑',
        'sneakers': '운동화',
        'boots': '부츠',
        'sandals': '샌들',
        'heels': '힐',
        'flats': '플랫슈즈',
        'loafers': '로퍼',
        'belt': '벨트',
        'watch': '시계',
        'sunglasses': '선글라스',
        'hat': '모자',
        'cap': '모자',
        'scarf': '스카프',
        'gloves': '장갑',
        'tie': '넥타이',
        'bowtie': '나비넥타이',
        'socks': '양말',
        'stockings': '스타킹',
        'necklace': '목걸이',
        'bracelet': '팔찌',
        'ring': '반지',
        'earring': '귀걸이',
        'earrings': '귀걸이',
        'jewelry': '주얼리',
      }
      const lowerKey = categoryKey.toLowerCase().replace(/_/g, ' ')
      return categoryMap[lowerKey] || categoryMap[categoryKey] || categoryKey
    }
    
    // English: capitalize first letter of each word
    return categoryKey.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-black mx-auto"></div>
          <p className="text-gray-800 mt-4 font-medium">{t('results.searching')}</p>
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
        title={t('results.back')}
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
              <p className="text-gray-800 font-bold text-center text-lg whitespace-pre-line">
                {t('phone.locked')}
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
          ref={scrollContainerRef}
          className="overflow-y-auto h-full pb-24 px-4"
          style={{ 
            touchAction: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain'
          }}
        >
          {Object.keys(results).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-gray-600 text-lg mb-4">{t('results.noResults')}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onReset}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  {t('results.startOver')}
                </button>
                <button
                  onClick={onResearch || onReset}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all active:scale-95"
                >
                  {t('results.searchAgain')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pb-8">
              {/* Each category = one section */}
              {Object.entries(results).map(([category, links]) => {
                // Extract category name and item number (format: "categoryName_number")
                const parts = category.split('_')
                const itemNumber = parts[parts.length - 1] || '1'
                const categoryKey = parts.slice(0, -1).join('_')
                const displayName = getCategoryName(categoryKey)

                return (
                  <div key={category} className="space-y-3">
                    {/* Category header with cropped image */}
                    <div className="flex items-center gap-3">
                      {croppedImages?.[category] && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-gray-300">
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
                        <p className="text-sm text-gray-500">{t('results.products').replace('{count}', links.length.toString())}</p>
                      </div>
                    </div>

                    {/* Horizontal scroll for 3 products */}
                    <div 
                      className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
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
                          onClick={(e) => {
                            e.preventDefault()
                            handleLinkClick(category, option.link, option.title, option.thumbnail, index + 1)
                            // Explicitly open in new tab for mobile compatibility
                            window.open(option.link, '_blank', 'noopener,noreferrer')
                          }}
                          className="flex-shrink-0 w-36 snap-start group"
                        >
                          <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200 group-hover:border-gray-400">
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
              title={t('results.startOver')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <button
              onClick={onResearch || onReset}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
            >
              {t('results.searchAgain')}
            </button>
            <button
              onClick={() => setSheetPosition(sheetPosition === 'full' ? 'half' : 'full')}
              className="flex-1 bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg active:scale-95"
            >
              {sheetPosition === 'full' ? t('results.collapse') : t('results.viewAll')}
            </button>
          </div>
        )}

        {/* Peek state hint */}
        {sheetPosition === 'peek' && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <div className="bg-black text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
              {t('results.dragHint')}
            </div>
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {userPhoneNumber && (
        <FeedbackModal
          ref={feedbackModalRef}
          phoneNumber={userPhoneNumber}
          resultPageUrl="main_app_result_page"
        />
      )}

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

