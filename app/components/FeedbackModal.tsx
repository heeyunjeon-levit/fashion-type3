'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface FeedbackModalProps {
  phoneNumber: string
  resultPageUrl?: string
  onClose?: () => void
}

export interface FeedbackModalRef {
  show: () => void
}

const FeedbackModal = forwardRef<FeedbackModalRef, FeedbackModalProps>(({ phoneNumber, resultPageUrl = 'main_app_result_page', onClose }, ref) => {
  const { t, language } = useLanguage()
  const [isVisible, setIsVisible] = useState(false)
  const [showTab, setShowTab] = useState(false)
  const [selectedSatisfaction, setSelectedSatisfaction] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pageLoadTime, setPageLoadTime] = useState(Date.now())

  // Check if feedback was already submitted
  useEffect(() => {
    console.log('🎬 FeedbackModal MOUNTED for phone:', phoneNumber)
    
    const feedbackKey = `feedback_submitted_${phoneNumber}`
    const tabStateKey = `feedback_tab_state_${phoneNumber}`
    const autoShownKey = `feedback_auto_shown_${phoneNumber}`

    const alreadySubmitted = localStorage.getItem(feedbackKey)
    const tabShouldShow = localStorage.getItem(tabStateKey) === 'visible'
    const autoShownThisSession = sessionStorage.getItem(autoShownKey)

    if (tabShouldShow && !alreadySubmitted) {
      setShowTab(true)
    }

    console.log('🔍 Feedback Modal State Check:', {
      feedbackSubmitted: !!alreadySubmitted,
      modalShownThisSession: !!autoShownThisSession,
      tabVisible: tabShouldShow,
      phoneNumber: phoneNumber
    })
    
    return () => {
      console.log('🔚 FeedbackModal UNMOUNTED')
    }
  }, [phoneNumber])

  // Show modal programmatically (called by parent via ref)
  const show = () => {
    const feedbackKey = `feedback_submitted_${phoneNumber}`
    const autoShownKey = `feedback_auto_shown_${phoneNumber}`
    
    console.log('📊 Feedback Modal - show() called for:', phoneNumber)
    
    if (localStorage.getItem(feedbackKey)) {
      console.warn('❌ FEEDBACK MODAL BLOCKED: Already submitted feedback')
      console.log('To test again, run in console: localStorage.removeItem("' + feedbackKey + '")')
      return
    }

    if (sessionStorage.getItem(autoShownKey)) {
      console.warn('❌ FEEDBACK MODAL BLOCKED: Already shown this session')
      console.log('To test again, run in console: sessionStorage.removeItem("' + autoShownKey + '")')
      return
    }

    console.log('✅✅✅ SHOWING FEEDBACK MODAL ✅✅✅')
    setIsVisible(true)
    sessionStorage.setItem(autoShownKey, 'true')
  }

  // Expose show method to parent via ref
  useImperativeHandle(ref, () => ({
    show
  }))

  const handleClose = () => {
    setIsVisible(false)
    setShowTab(true)
    const tabStateKey = `feedback_tab_state_${phoneNumber}`
    localStorage.setItem(tabStateKey, 'visible')
  }

  const handleTabClick = () => {
    setShowTab(false)
    setIsVisible(true)
    const tabStateKey = `feedback_tab_state_${phoneNumber}`
    localStorage.removeItem(tabStateKey)
  }

  const handleSatisfactionClick = (satisfaction: string) => {
    setSelectedSatisfaction(satisfaction)
  }

  const handleSubmit = async () => {
    if (!selectedSatisfaction) return

    setIsSubmitting(true)

    try {
      const timeToFeedback = Math.floor((Date.now() - pageLoadTime) / 1000)

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          satisfaction: selectedSatisfaction,
          comment: comment || null,
          resultPageUrl: resultPageUrl,
          pageLoadTime: timeToFeedback,
        }),
      })

      if (response.ok) {
        console.log('✅ Feedback submitted successfully')
        const feedbackKey = `feedback_submitted_${phoneNumber}`
        localStorage.setItem(feedbackKey, 'true')
        setIsVisible(false)
        setShowTab(false)
        
        // Clear tab state
        const tabStateKey = `feedback_tab_state_${phoneNumber}`
        localStorage.removeItem(tabStateKey)
      } else {
        console.error('❌ Feedback submission failed')
        alert('피드백 전송에 실패했습니다. 다시 시도해주세요.')
      }
    } catch (error) {
      console.error('❌ Feedback submission error:', error)
      alert('피드백 전송 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Feedback Modal */}
      {isVisible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md mx-4 p-6 animate-in zoom-in-95 duration-200">
            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t('feedback.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {t('feedback.subtitle')}
            </p>

            {/* Satisfaction Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => handleSatisfactionClick(language === 'en' ? 'satisfied' : '만족')}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${
                  selectedSatisfaction === (language === 'en' ? 'satisfied' : '만족')
                    ? 'bg-green-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('feedback.satisfied')}
              </button>
              <button
                onClick={() => handleSatisfactionClick(language === 'en' ? 'unsatisfied' : '불만족')}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${
                  selectedSatisfaction === (language === 'en' ? 'unsatisfied' : '불만족')
                    ? 'bg-red-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('feedback.unsatisfied')}
              </button>
            </div>

            {/* Comment Textarea */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('feedback.comment')}
              className="w-full p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mb-4"
              rows={3}
            />

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                {t('feedback.notDone')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedSatisfaction || isSubmitting}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                  selectedSatisfaction && !isSubmitting
                    ? 'bg-black text-white hover:bg-gray-800 shadow-lg'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Tab (Side Button) */}
      {showTab && (
        <button
          onClick={handleTabClick}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-black text-white px-3 py-6 rounded-l-xl font-semibold shadow-lg z-[9998] hover:bg-gray-800 transition-all hover:pr-4 text-sm"
          style={{ writingMode: 'vertical-rl' }}
        >
          {t('feedback.tab')}
        </button>
      )}
    </>
  )
})

FeedbackModal.displayName = 'FeedbackModal'

export default FeedbackModal

