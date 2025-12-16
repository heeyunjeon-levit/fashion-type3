'use client'

import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface PhoneModalProps {
  onPhoneSubmit: (phoneNumber: string) => void
  onClose?: () => void
  isReturningUser?: boolean
  defaultPhoneNumber?: string  // Pre-fill phone number for returning users
  ocrMode?: boolean  // True if using OCR mode (fast results, no SMS)
  at21Percent?: boolean  // True if showing modal at 21% safe point (job queued, can close browser)
}

export default function PhoneModal({ onPhoneSubmit, onClose, isReturningUser, defaultPhoneNumber, ocrMode, at21Percent }: PhoneModalProps) {
  const { t, language } = useLanguage()
  
  // Helper function for formatting phone numbers
  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '')
    
    if (language === 'ko') {
      // Korean format: 010-1234-5678
      if (cleaned.length <= 3) {
        return cleaned
      } else if (cleaned.length <= 7) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
      } else {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`
      }
    } else {
      // US format: 555-123-4567
      if (cleaned.length <= 3) {
        return cleaned
      } else if (cleaned.length <= 6) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
      } else {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
      }
    }
  }
  
  // Pre-fill with default phone if provided (for returning users)
  const [phoneNumber, setPhoneNumber] = useState(defaultPhoneNumber ? formatPhoneNumber(defaultPhoneNumber) : '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate phone number based on language
    const cleanedPhone = phoneNumber.replace(/[^0-9]/g, '')
    
    if (language === 'ko') {
      // Korean phone validation (010-XXXX-XXXX or 01012345678)
      if (cleanedPhone.length !== 11 && cleanedPhone.length !== 10) {
        setError(t('phone.error'))
        return
      }

      if (!cleanedPhone.startsWith('010')) {
        setError(t('phone.errorPrefix'))
        return
      }
    } else {
      // English phone validation (more lenient, 10+ digits)
      if (cleanedPhone.length < 10) {
        setError(t('phone.error'))
        return
      }
    }

    setIsSubmitting(true)
    
    try {
      await onPhoneSubmit(cleanedPhone)
    } catch (err) {
      setError('Failed to save phone number. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ touchAction: 'auto' }}>
      {/* Backdrop - No click to close (phone required for tracking) */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ touchAction: 'auto' }} />
      
      {/* Modal - Post-it style */}
      <div className="relative bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl shadow-2xl max-w-md w-full p-8 transform rotate-1 hover:rotate-0 transition-transform" style={{ touchAction: 'auto' }}>
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
            {isReturningUser ? t('phone.returning') : (ocrMode ? t('phone.titleOcr') : t('phone.title'))}
          </h2>

          {/* Description */}
          <p className="text-gray-700 text-center mb-6 leading-relaxed whitespace-pre-line">
            {isReturningUser ? t('phone.returningDesc') : (ocrMode ? t('phone.descOcr') : t('phone.desc'))}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                placeholder={t('phone.placeholder')}
                className="w-full px-4 py-3 border-2 border-yellow-800/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-transparent bg-white/80 text-gray-800 placeholder-gray-500 text-center text-lg font-medium"
                style={{ touchAction: 'auto' }}
                maxLength={13}
                disabled={isSubmitting}
                autoFocus
                inputMode="numeric"
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
              {isSubmitting ? t('phone.submitting') : (at21Percent ? '문자로 받을께요' : (ocrMode ? t('phone.submitOcr') : t('phone.submit')))}
            </button>
          </form>

          {/* Privacy note */}
          <p className="text-xs text-gray-600 text-center mt-4 leading-relaxed whitespace-pre-line">
            {t('phone.privacy')}
          </p>
        </div>
      </div>
    </div>
  )
}

