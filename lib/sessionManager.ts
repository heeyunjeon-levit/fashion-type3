/**
 * Session Manager - Track user sessions and events
 * Generates unique session IDs and stores them in localStorage
 */

export class SessionManager {
  private sessionId: string
  private userId: string | null = null
  private phoneNumber: string | null = null

  constructor() {
    // Get or create session ID
    if (typeof window !== 'undefined') {
      this.sessionId = this.getOrCreateSessionId()
      this.userId = localStorage.getItem('userId')
      this.phoneNumber = localStorage.getItem('phoneNumber')
    } else {
      this.sessionId = this.generateSessionId()
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('sessionId')
    
    if (!sessionId) {
      sessionId = this.generateSessionId()
      sessionStorage.setItem('sessionId', sessionId)
      
      // Set this.sessionId BEFORE initializing (fix timing bug)
      this.sessionId = sessionId
      
      // Initialize session in database
      this.initializeSession()
    }
    
    return sessionId
  }

  private async initializeSession() {
    try {
      console.log('🔄 Initializing session in database:', this.sessionId)
      const response = await fetch('/api/log/session/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          userId: this.userId,
          phoneNumber: this.phoneNumber,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        console.log('✅ Session initialized successfully:', data)
      } else {
        console.error('❌ Session initialization failed:', data)
      }
    } catch (error) {
      console.error('❌ Failed to initialize session:', error)
    }
  }

  getSessionId(): string {
    return this.sessionId
  }

  getUserId(): string | null {
    return this.userId
  }

  getPhoneNumber(): string | null {
    return this.phoneNumber
  }

  setUserInfo(userId: string, phoneNumber: string) {
    this.userId = userId
    this.phoneNumber = phoneNumber
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('userId', userId)
      localStorage.setItem('phoneNumber', phoneNumber)
    }
  }

  isReturningUser(): boolean {
    return this.userId !== null && this.phoneNumber !== null
  }

  // Log an event
  async logEvent(eventType: string, eventData: any = {}) {
    try {
      console.log(`📝 Logging event: ${eventType}, sessionId: ${this.sessionId}, userId: ${this.userId}`)
      const response = await fetch('/api/log/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          userId: this.userId,
          eventType,
          eventData,
          timestamp: new Date().toISOString(),
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error(`❌ Failed to log event ${eventType}:`, error)
      } else {
        console.log(`✅ Event ${eventType} logged successfully`)
      }
    } catch (error) {
      console.error('❌ Failed to log event:', error)
    }
  }

  // Update session data
  async updateSession(data: any) {
    try {
      await fetch('/api/log/session/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          ...data,
        }),
      })
    } catch (error) {
      console.error('Failed to update session:', error)
    }
  }

  // Log image upload
  async logImageUpload(imageUrl: string) {
    await this.logEvent('image_upload', { imageUrl })
    await this.updateSession({
      uploaded_image_url: imageUrl,
      uploaded_at: new Date().toISOString(),
    })
  }

  // Log GPT analysis (Stage 1: Detection with GroundingDINO prompts)
  async logGPTAnalysis(analysisResult: any) {
    console.log('📝 Logging GPT Analysis:')
    console.log(`   Items detected: ${analysisResult.items?.length || 0}`)
    console.log(`   Cached: ${analysisResult.cached}`)
    
    // Show ALL detected items (not just first one)
    if (analysisResult.items && analysisResult.items.length > 0) {
      console.log('   Detected items:')
      analysisResult.items.forEach((item: any, idx: number) => {
        console.log(`   ${idx + 1}. ${item.category}: "${item.groundingdino_prompt}" - ${item.description}`)
      })
    }
    
    await this.logEvent('gpt_analysis', { 
      itemCount: analysisResult.items?.length || 0,
      cached: analysisResult.cached,
      items: analysisResult.items,
      timestamp: new Date().toISOString(),
    })
    
    await this.updateSession({
      gpt_analysis: analysisResult,
      analyzed_at: new Date().toISOString(),
    })
    
    console.log('✅ GPT Analysis logged to session (all items saved)')
  }

  // Log cropped images
  async logCroppedImages(croppedImages: any[]) {
    await this.logEvent('items_cropped', { 
      count: croppedImages.length,
      items: croppedImages,
    })
    await this.updateSession({
      cropped_images: croppedImages,
      cropped_at: new Date().toISOString(),
    })
  }

  // Log user selection
  async logItemSelection(selectedItems: any[]) {
    await this.logEvent('items_selected', { 
      count: selectedItems.length,
      items: selectedItems,
    })
    await this.updateSession({
      selected_items: selectedItems,
      selected_at: new Date().toISOString(),
    })
  }

  // Log search results with GPT reasoning
  async logSearchResults(results: any, meta: any = {}) {
    await this.logEvent('search_completed', { 
      resultCount: Object.keys(results).length,
    })
    
    // Log GPT reasoning as a separate detailed event (what GPT selected)
    if (meta.gptReasoning && Object.keys(meta.gptReasoning).length > 0) {
      await this.logEvent('gpt_product_selection', {
        reasoning: meta.gptReasoning,
        sourceCounts: meta.sourceCounts,
      })
    }
    
    // Log FINAL RESULTS DISPLAYED (including fallback products)
    // This captures what the user ACTUALLY sees, not just what GPT selected
    await this.logFinalResultsDisplayed(results, meta)
    
    // Log detailed timing breakdown as a separate event
    if (meta.timing) {
      await this.logEvent('pipeline_timing', {
        // Chronological breakdown
        full_image_search_seconds: meta.timing.full_image_search_seconds,
        per_category_search_seconds: meta.timing.per_category_search_seconds,
        gpt4_turbo_api_time_seconds: meta.timing.gpt4_turbo_api_time_seconds,
        processing_overhead_seconds: meta.timing.processing_overhead_seconds,
        other_overhead_seconds: meta.timing.other_overhead_seconds,
        // Summary
        wall_clock_seconds: meta.timing.wall_clock_seconds,
        total_seconds: meta.timing.total_seconds,
        // API details
        serper_api_time_seconds: meta.timing.serper_api_time_seconds,
        serper_count: meta.timing.serper_count,
        gpt4_turbo_count: meta.timing.gpt4_turbo_count,
        categories_parallel: meta.timing.categories_parallel
      })
    }
    
    await this.updateSession({
      search_results: results,
      gpt_selection_reasoning: meta.gptReasoning || {},
      searched_at: new Date().toISOString(),
    })
  }

  // Log final results displayed to user (including fallback products)
  async logFinalResultsDisplayed(results: any, meta: any = {}) {
    // Extract what the user actually sees
    const displayedProducts: Record<string, any> = {}
    let totalProducts = 0
    let gptProducts = 0
    let fallbackProducts = 0
    
    // Parse through results and identify sources
    Object.entries(results).forEach(([category, products]: [string, any]) => {
      if (Array.isArray(products) && products.length > 0) {
        totalProducts += products.length
        
        // Check if this category used fallback (from gptReasoning)
        const categoryInfo = meta.gptReasoning?.[category]
        const usedFallback = categoryInfo?.selectedLinks?.length === 0 && products.length > 0
        
        displayedProducts[category] = {
          count: products.length,
          source: usedFallback ? 'fallback' : 'gpt',
          products: products.map((p: any, idx: number) => ({
            position: idx + 1,
            title: p.title,
            link: p.link,
            thumbnail: p.thumbnail,
          }))
        }
        
        if (usedFallback) {
          fallbackProducts += products.length
        } else {
          gptProducts += products.length
        }
      }
    })
    
    console.log(`📊 Final Results Displayed: ${totalProducts} products (GPT: ${gptProducts}, Fallback: ${fallbackProducts})`)
    
    await this.logEvent('final_results_displayed', {
      displayedProducts,
      summary: {
        totalProducts,
        gptProducts,
        fallbackProducts,
        categoriesWithFallback: Object.values(displayedProducts).filter((d: any) => d.source === 'fallback').length,
        totalCategories: Object.keys(displayedProducts).length,
      },
      sourceCounts: meta.sourceCounts,
      timestamp: new Date().toISOString(),
    })
  }

  // Log phone number collection
  async logPhoneNumber(phoneNumber: string, countryCode: string = '+82') {
    const response = await fetch('/api/log/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        phoneNumber,
        countryCode,
      }),
    })

    const data = await response.json()
    
    if (data.userId) {
      this.setUserInfo(data.userId, phoneNumber)
    }

    await this.logEvent('phone_provided', { phoneNumber, countryCode })
    await this.updateSession({
      phone_collected_at: new Date().toISOString(),
      status: 'completed',
    })

    return data
  }

  // Log link click
  async logLinkClick(linkData: {
    itemCategory: string
    itemDescription: string
    productLink: string
    productTitle?: string
    productThumbnail?: string
    linkPosition: number
  }) {
    await fetch('/api/log/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        userId: this.userId,
        ...linkData,
      }),
    })

    await this.logEvent('link_clicked', linkData)
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager()
  }
  return sessionManagerInstance
}

