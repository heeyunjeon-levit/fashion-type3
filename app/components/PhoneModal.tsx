'use client'

import { useState } from 'react'

interface PhoneModalProps {
  onPhoneSubmit: (phoneNumber: string) => void
  onClose?: () => void
  isReturningUser?: boolean
}

export default function PhoneModal({ onPhoneSubmit, onClose, isReturningUser }: PhoneModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate Korean phone number (010-XXXX-XXXX or 01012345678)
    const cleanedPhone = phoneNumber.replace(/[^0-9]/g, '')
    
    if (cleanedPhone.length !== 11 && cleanedPhone.length !== 10) {
      setError('올바른 전화번호를 입력해주세요 (예: 010-1234-5678)')
      return
    }

    if (!cleanedPhone.startsWith('010')) {
      setError('010으로 시작하는 전화번호를 입력해주세요')
      return
    }

    setIsSubmitting(true)
    
    try {
      await onPhoneSubmit(cleanedPhone)
    } catch (err) {
      setError('전화번호 저장에 실패했습니다. 다시 시도해주세요.')
      setIsSubmitting(false)
    }
  }

  const formatPhoneNumber = (value: string) => {
    // Auto-format as user types: 010-1234-5678
    const cleaned = value.replace(/[^0-9]/g, '')
    
    if (cleaned.length <= 3) {
      return cleaned
    } else if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    } else {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal - Post-it style */}
      <div className="relative bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl shadow-2xl max-w-md w-full p-8 transform rotate-1 hover:rotate-0 transition-transform">
        {/* Tape effect at top */}
        <div className="absolute -top-3 left-1/4 right-1/4 h-6 bg-yellow-300/30 backdrop-blur-sm rounded-sm shadow-inner" />
        
        <div className="relative">
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute -top-4 -right-4 bg-red-400 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-colors shadow-lg"
            >
              ✕
            </button>
          )}

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="bg-yellow-400/50 rounded-full p-4">
              <svg className="w-12 h-12 text-yellow-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
            {isReturningUser ? '다시 찾아주셨네요! 👋' : '잠깐만요! 📱'}
          </h2>

          {/* Description */}
          <p className="text-gray-700 text-center mb-6 leading-relaxed">
            {isReturningUser ? (
              <>
                재방문 감사합니다!<br />
                전화번호를 다시 입력해주세요
              </>
            ) : (
              <>
                상품 링크를 확인하려면<br />
                전화번호를 입력해주세요<br />
                <span className="text-sm text-gray-600 mt-2 block">
                  (더 좋은 서비스를 위한 사용자 인터뷰에 활용됩니다)
                </span>
              </>
            )}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                placeholder="010-1234-5678"
                className="w-full px-4 py-3 border-2 border-yellow-800/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-transparent bg-white/80 text-gray-800 placeholder-gray-500 text-center text-lg font-medium"
                maxLength={13}
                disabled={isSubmitting}
                autoFocus
              />
              {error && (
                <p className="text-red-600 text-sm mt-2 text-center font-medium">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || phoneNumber.length < 10}
              className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 text-white py-3 rounded-xl font-bold text-lg hover:from-yellow-700 hover:to-amber-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
            >
              {isSubmitting ? '처리중...' : '링크 확인하기 🔗'}
            </button>
          </form>

          {/* Privacy note */}
          <p className="text-xs text-gray-600 text-center mt-4 leading-relaxed">
            🔒 전화번호는 안전하게 보관되며<br />
            사용자 인터뷰 목적으로만 사용됩니다
          </p>
        </div>
      </div>
    </div>
  )
}

