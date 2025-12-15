'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'en' | 'ko'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const translations = {
  en: {
    // ImageUpload
    'upload.title': 'Find the clothes\nyou want!',
    'upload.converting': 'Converting HEIC to JPEG...',
    'upload.preview': 'Preview',
    'upload.change': 'Change image',
    'upload.placeholder': 'Upload an image to get started',
    'upload.select': 'Select Image',
    'upload.uploading': 'Uploading...',
    'upload.continue': 'Continue',

    // Analyzing
    'analyzing.title': 'AI is analyzing...',
    'analyzing.subtitle': 'Finding items in your image',

    // CroppedImageGallery
    'gallery.title': 'Detected Items',
    'gallery.subtitle': 'Select items to search for',
    'gallery.aiFound': '🤖 AI found {count} items!',
    'gallery.original': 'Original Image',
    'gallery.noItems': 'No items detected',
    'gallery.reupload': 'Upload Again',
    'gallery.croppedItems': 'Cropped Items ({count})',
    'gallery.back': 'Back',
    'gallery.search': 'Search {count} selected items',

    // Searching
    'searching.title': 'AI is finding products for you',

    // ResultsBottomSheet
    'results.searching': 'Searching for products...',
    'results.noResults': 'No results found',
    'results.startOver': 'Start Over',
    'results.searchAgain': 'Search Again',
    'results.products': '{count} products',
    'results.collapse': 'Collapse',
    'results.viewAll': 'View All',
    'results.dragHint': '↑ Drag up to view products',
    'results.back': 'Back',

    // PhoneModal
    'phone.returning': 'Welcome back! 👋',
    'phone.title': 'Just a moment! 📱',
    'phone.titleOcr': 'Just a moment! 📱',
    'phone.returningDesc': 'Thanks for coming back!\nPlease enter your phone number again',
    'phone.desc': 'To view product links,\nplease enter your phone number\n(Used for user interviews to improve our service)',
    'phone.descOcr': 'Your phone number is used only\nfor future user interviews\nto improve our service',
    'phone.placeholder': '555-123-4567',
    'phone.error': 'Please enter a valid phone number (e.g., 555-123-4567)',
    'phone.errorPrefix': 'Please enter a valid phone number',
    'phone.submitting': 'Processing...',
    'phone.submit': 'View Links 🔗',
    'phone.submitOcr': 'View Results 🔗',
    'phone.privacy': '🔒 Your phone number is securely stored\nand used only for user interviews',
    'phone.locked': '🔒 Enter your phone number\nto view product links!',

    // SMS Waiting Screen
    'sms.title': 'Search started! ✨',
    'sms.safeToClose': 'Safe to close your browser',
    'sms.background': 'The search will continue in the background',
    'sms.timing': 'We\'ll text you the results link in 1-2 minutes! 📱',
    'sms.infoNote': '💡 Note: If you don\'t receive a text after 2 minutes, please try again',
    'sms.confirm': 'Got it 👍',

    // FeedbackModal
    'feedback.title': 'How was your experience?',
    'feedback.subtitle': 'We\'d love to hear your feedback 💭',
    'feedback.satisfied': '😊 Satisfied',
    'feedback.unsatisfied': '😞 Unsatisfied',
    'feedback.comment': 'Share more details (optional)',
    'feedback.notDone': 'Still browsing!',
    'feedback.submit': 'Submit',
    'feedback.submitting': 'Sending...',
    'feedback.tab': 'Feedback 💭',

    // Categories
    'category.tops': 'Top',
    'category.bottoms': 'Bottom',
    'category.bag': 'Bag',
    'category.shoes': 'Shoes',
    'category.accessory': 'Accessory',
    'category.dress': 'Dress',
  },
  ko: {
    // ImageUpload
    'upload.title': '어떤 패션템이든\n바로 찾아드려요.',
    'upload.converting': 'HEIC를 JPEG로 변환하는 중...',
    'upload.preview': '미리보기',
    'upload.change': '이미지 변경',
    'upload.placeholder': '이미지를 업로드하여 시작하세요',
    'upload.select': '이미지 선택',
    'upload.uploading': '업로드 중...',
    'upload.continue': '계속하기',

    // Analyzing
    'analyzing.title': 'AI 분석중...',
    'analyzing.subtitle': '이미지에서 아이템을 찾고 있어요',

    // CroppedImageGallery
    'gallery.title': '발견된 아이템',
    'gallery.subtitle': '검색할 아이템을 선택하세요',
    'gallery.aiFound': '🤖 AI가 {count}개의 아이템을 찾았어요!',
    'gallery.original': '원본 이미지',
    'gallery.noItems': '아이템을 찾지 못했어요',
    'gallery.reupload': '다시 업로드',
    'gallery.croppedItems': '자른 아이템 ({count}개)',
    'gallery.back': '뒤로가기',
    'gallery.search': '선택한 {count}개 아이템 검색',

    // Searching
    'searching.title': 'AI가 요청하신 상품을 찾고 있어요',

    // ResultsBottomSheet
    'results.searching': '제품 검색 중...',
    'results.noResults': '결과를 찾을 수 없습니다',
    'results.startOver': '처음부터',
    'results.searchAgain': '다시 검색',
    'results.products': '{count}개 상품',
    'results.collapse': '접기',
    'results.viewAll': '전체보기',
    'results.dragHint': '↑ 위로 드래그하여 상품 보기',
    'results.back': '뒤로가기',

    // PhoneModal
    'phone.returning': '다시 찾아주셨네요! 👋',
    'phone.title': '잠깐만요! 📱',
    'phone.titleOcr': '잠깐만요! 📱',
    'phone.returningDesc': '재방문 감사합니다!\n전화번호를 다시 입력해주세요',
    'phone.desc': '검색을 하는데 1분 이상 소요될 예정이예요.\n기다리실 필요없이 전화번호를 적어주시면\n결과링크를 문자로 보내드릴께요!',
    'phone.descOcr': '전화번호는 향후 사용자 인터뷰 목적으로만\n사용됩니다. 서비스 개선을 위해\n협조 부탁드립니다.',
    'phone.placeholder': '010-1234-5678',
    'phone.error': '올바른 전화번호를 입력해주세요 (예: 010-1234-5678)',
    'phone.errorPrefix': '010으로 시작하는 전화번호를 입력해주세요',
    'phone.submitting': '처리중...',
    'phone.submit': '검색 시작하기 🔗',
    'phone.submitOcr': '결과 보기 🔗',
    'phone.privacy': '🔒 전화번호는 안전하게 보관됩니다',
    'phone.locked': '🔒 전화번호 입력 후\n상품 링크를 확인하세요!',

    // SMS Waiting Screen
    'sms.title': '검색을 시작했어요! ✨',
    'sms.safeToClose': '브라우저를 닫아도 괜찮아요',
    'sms.background': '백그라운드에서 검색이 계속 진행됩니다',
    'sms.timing': '1~2분 후 결과 링크를 문자로 보내드릴게요! 📱',
    'sms.infoNote': '💡 알림: 문자가 2분 이상 안 오면 다시 시도해주세요',
    'sms.confirm': '확인 👍',

    // FeedbackModal
    'feedback.title': '결과가 만족스러우셨나요?',
    'feedback.subtitle': '여러분의 소중한 의견을 들려주세요 💭',
    'feedback.satisfied': '😊 만족',
    'feedback.unsatisfied': '😞 불만족',
    'feedback.comment': '자세한 의견을 남겨주세요 (선택사항)',
    'feedback.notDone': '아직 결과를 다 못봤어요!',
    'feedback.submit': '확인',
    'feedback.submitting': '전송중...',
    'feedback.tab': '피드백 💭',

    // Categories
    'category.tops': '상의',
    'category.bottoms': '하의',
    'category.bag': '가방',
    'category.shoes': '신발',
    'category.accessory': '악세사리',
    'category.dress': '드레스',
  },
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ko')

  // Load language from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('language') as Language
      if (savedLang && (savedLang === 'en' || savedLang === 'ko')) {
        setLanguageState(savedLang)
      }
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang)
    }
  }

  const t = (key: string): string => {
    const translation = translations[language][key as keyof typeof translations['en']]
    return translation || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

