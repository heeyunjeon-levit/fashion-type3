'use client'

import { useLanguage } from '../contexts/LanguageContext'

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')}
      className="fixed top-6 right-6 z-50 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg hover:bg-white transition-colors border border-gray-200 font-medium text-sm"
      title="Switch language"
    >
      {language === 'en' ? '한국어' : 'English'}
    </button>
  )
}

