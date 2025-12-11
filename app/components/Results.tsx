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

interface TwoStageResults {
  colorMatches: ProductOption[]
  styleMatches: ProductOption[]
}

interface ResultsProps {
  results: Record<string, ProductOption[] | TwoStageResults>
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

  // Debug logging
  useEffect(() => {
    console.log('🔍 Results Component State:', {
      showPhoneModal,
      phoneSubmitted,
      hasSessionManager: !!sessionManager,
      isReturningUser
    })
  }, [showPhoneModal, phoneSubmitted, sessionManager, isReturningUser])

  const handlePhoneSubmit = async (phoneNumber: string) => {
    if (!sessionManager) return
    
    // Close modal immediately for instant feedback (no delay!)
    setPhoneSubmitted(true)
    setShowPhoneModal(false)
    
    // Log phone number in background (non-blocking)
    sessionManager.logPhoneNumber(phoneNumber)
      .then((result: any) => {
        // Show welcome message for returning users
        if (result.isReturningUser) {
          console.log(`환영합니다! 총 ${result.totalSearches}번 방문하셨습니다.`)
        }
      })
      .catch((error: any) => {
        console.error('Failed to submit phone number:', error)
      })
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
    const itemDescription = selectedItem?.category || selectedItem?.description || categoryKey

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
    // Parent categories
    tops: '상의',
    bottoms: '하의',
    bag: '가방',
    shoes: '신발',
    accessory: '악세사리',
    accessories: '악세사리',
    dress: '드레스',
    // Specific DINO-X categories (tops)
    jacket: '재킷',
    coat: '코트',
    'fur coat': '퍼 코트',
    'fur jacket': '퍼 재킷',
    'leather jacket': '가죽 재킷',
    shirt: '셔츠',
    'button up shirt': '셔츠',
    'button_up_shirt': '셔츠',
    blouse: '블라우스',
    sweater: '스웨터',
    cardigan: '가디건',
    hoodie: '후드티',
    vest: '조끼',
    blazer: '블레이저',
    // Specific DINO-X categories (bottoms)
    pants: '바지',
    jeans: '청바지',
    shorts: '반바지',
    skirt: '치마',
    trousers: '바지',
    // Specific DINO-X categories (shoes)
    sneakers: '운동화',
    boots: '부츠',
    sandals: '샌들',
    heels: '힐',
    // Specific DINO-X categories (bags)
    backpack: '백팩',
    purse: '지갑',
    handbag: '핸드백',
    // Specific DINO-X categories (accessories)
    sunglasses: '선글라스',
    hat: '모자',
    cap: '모자',
    scarf: '스카프',
    belt: '벨트',
    watch: '시계',
    jewelry: '주얼리',
    necklace: '목걸이',
    bracelet: '팔찌',
    earrings: '귀걸이',
    ring: '반지',
  }

  const totalCroppedImages = croppedImages ? Object.keys(croppedImages).length : 0

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
          {Object.entries(results).map(([category, data]) => {
            const categoryKey = category.split('_')[0]
            const displayName = categoryNames[categoryKey] || categoryKey
            
            // Check if data is in two-stage format (with colorMatches/styleMatches)
            const isTwoStage = data && typeof data === 'object' && 'colorMatches' in data
            const colorMatches = isTwoStage ? (data as TwoStageResults).colorMatches : []
            const styleMatches = isTwoStage ? (data as TwoStageResults).styleMatches : []
            const legacyLinks = !isTwoStage ? (data as ProductOption[]) : []
            
            // Helper function to render product grid
            const renderProductGrid = (products: ProductOption[], matchType?: 'color' | 'style') => (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {products.map((option, index) => {
                  const isBlurred = !phoneSubmitted
                  
                  return (
                    <div 
                      key={index}
                      className={`bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 hover:shadow-xl transition-all flex flex-col relative ${isBlurred ? 'pointer-events-none' : ''}`}
                    >
                      {isBlurred && (
                        <div className="absolute inset-0 backdrop-blur-md bg-white/30 z-10 flex items-center justify-center">
                          <div className="bg-yellow-100 rounded-xl p-4 shadow-lg transform rotate-2">
                            <p className="text-gray-800 font-bold text-center">
                              🔒 전화번호 입력 후<br />확인 가능합니다
                            </p>
                          </div>
                        </div>
                      )}

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
                      
                      <div className="p-4 flex-grow">
                        <p className="text-sm text-gray-800 line-clamp-2 min-h-[2.5rem]">
                          {option.title || new URL(option.link).hostname}
                        </p>
                      </div>
                      
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
            )
            
            return (
              <div key={category} className="space-y-6">
                {/* Two-Stage Format: Color + Style Matches */}
                {isTwoStage ? (
                  <>
                    {/* Color Matches Section */}
                    {colorMatches.length > 0 && (
                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg p-8 border border-indigo-100">
                        <div className="flex items-center gap-3 mb-6">
                          <span className="text-3xl">🎨</span>
                          <div>
                            <h2 className="text-2xl font-bold text-indigo-600">
                              {displayName} · Color Match
                            </h2>
                            <p className="text-sm text-gray-600">Products matching your exact color</p>
                          </div>
                        </div>
                        {renderProductGrid(colorMatches, 'color')}
                      </div>
                    )}
                    
                    {/* Style Matches Section */}
                    {styleMatches.length > 0 && (
                      <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl shadow-lg p-8 border border-slate-100">
                        <div className="flex items-center gap-3 mb-6">
                          <span className="text-3xl">✂️</span>
                          <div>
                            <h2 className="text-2xl font-bold text-slate-700">
                              {displayName} · Style Match
                            </h2>
                            <p className="text-sm text-gray-600">Products matching your style & silhouette</p>
                          </div>
                        </div>
                        {renderProductGrid(styleMatches, 'style')}
                      </div>
                    )}
                  </>
                ) : (
                  /* Legacy Format: Single product list */
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    <h2 className="text-3xl font-bold text-indigo-600 mb-8">
                      {displayName.toUpperCase()} ({legacyLinks.length} products)
                    </h2>
                    {renderProductGrid(legacyLinks)}
                  </div>
                )}
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

