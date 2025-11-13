import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

interface PageTrackingOptions {
  uploadedImage?: boolean
  completedAnalysis?: boolean
  clickedSearch?: boolean
}

export function usePageTracking(options: PageTrackingOptions = {}) {
  const pathname = usePathname()
  const pageLoadTime = useRef(Date.now())
  const [sessionId, setSessionId] = useState<string>('')
  const [deviceId, setDeviceId] = useState<string>('')
  const maxScrollDepth = useRef(0)
  const isTracking = useRef(false)

  useEffect(() => {
    // Generate or retrieve session ID (persists until browser closed)
    let sid = sessionStorage.getItem('app_session_id')
    const isNewSession = !sid
    
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('app_session_id', sid)
    }
    setSessionId(sid)

    // Generate or retrieve device ID (persists long-term)
    let did = localStorage.getItem('app_device_id')
    if (!did) {
      did = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('app_device_id', did)
    }
    setDeviceId(did)

    // Track scroll depth
    const handleScroll = () => {
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollTop = window.scrollY
      const scrollPercent = Math.round(((scrollTop + windowHeight) / documentHeight) * 100)
      maxScrollDepth.current = Math.max(maxScrollDepth.current, Math.min(scrollPercent, 100))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    // Log initial page visit
    const logPageVisit = async (timeOnPage: number | null = null) => {
      if (isTracking.current) return // Prevent duplicate calls
      
      // Capture URL parameters for conversion tracking
      const urlParams = new URLSearchParams(window.location.search)
      const source = urlParams.get('source')
      const phoneParam = urlParams.get('phone')
      
      // Build referrer string with source info
      let referrerString = document.referrer || null
      if (source && phoneParam) {
        referrerString = `${document.referrer || 'direct'} (source: ${source}, phone: ${phoneParam})`
      }
      
      try {
        await fetch('/api/track-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sid,
            pagePath: pathname,
            deviceId: did,
            isNewSession: isNewSession,
            timeOnPage: timeOnPage,
            scrollDepth: maxScrollDepth.current,
            uploadedImage: options.uploadedImage || false,
            completedAnalysis: options.completedAnalysis || false,
            clickedSearch: options.clickedSearch || false,
            referrer: referrerString
          })
        })
      } catch (error) {
        console.error('Error logging page visit:', error)
      }
    }

    // Log on mount
    logPageVisit()

    // Log with time on page when leaving
    const handleBeforeUnload = () => {
      isTracking.current = true
      const timeOnPage = Math.floor((Date.now() - pageLoadTime.current) / 1000)
      
      // Capture URL parameters for conversion tracking
      const urlParams = new URLSearchParams(window.location.search)
      const source = urlParams.get('source')
      const phoneParam = urlParams.get('phone')
      
      // Build referrer string with source info
      let referrerString = document.referrer || null
      if (source && phoneParam) {
        referrerString = `${document.referrer || 'direct'} (source: ${source}, phone: ${phoneParam})`
      }
      
      // Use sendBeacon for reliable delivery
      const data = JSON.stringify({
        sessionId: sid,
        pagePath: pathname,
        deviceId: did,
        isNewSession: false,
        timeOnPage: timeOnPage,
        scrollDepth: maxScrollDepth.current,
        uploadedImage: options.uploadedImage || false,
        completedAnalysis: options.completedAnalysis || false,
        clickedSearch: options.clickedSearch || false,
        referrer: referrerString
      })
      navigator.sendBeacon('/api/track-page', new Blob([data], { type: 'application/json' }))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [pathname, options.uploadedImage, options.completedAnalysis, options.clickedSearch])

  return { sessionId, deviceId }
}

