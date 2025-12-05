'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ResultsBottomSheet from '@/app/components/ResultsBottomSheet'
import { DetectedItem } from '@/app/page'

export default function SharedResultsPage() {
  const params = useParams()
  const shareId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>>>({})
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('')
  const [selectedItems, setSelectedItems] = useState<DetectedItem[]>([])
  const [searchMode, setSearchMode] = useState<string>('unknown')
  const [createdAt, setCreatedAt] = useState<string>('')

  useEffect(() => {
    const fetchSharedResults = async () => {
      try {
        setLoading(true)
        console.log(`🔗 Loading shared results: ${shareId}`)
        
        const response = await fetch(`/api/share-results?id=${shareId}`)
        
        if (!response.ok) {
          throw new Error('Failed to load shared results')
        }
        
        const data = await response.json()
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load results')
        }
        
        setResults(data.results)
        setOriginalImageUrl(data.originalImageUrl || '')
        setSelectedItems(data.selectedItems || [])
        setSearchMode(data.searchMode || 'unknown')
        setCreatedAt(data.createdAt || '')
        
        console.log('✅ Shared results loaded:', {
          categories: Object.keys(data.results).length,
          totalProducts: Object.values(data.results).reduce((acc: number, arr: any) => acc + arr.length, 0)
        })
        
      } catch (err) {
        console.error('❌ Error loading shared results:', err)
        setError(err instanceof Error ? err.message : 'Failed to load results')
      } finally {
        setLoading(false)
      }
    }
    
    if (shareId) {
      fetchSharedResults()
    }
  }, [shareId])

  // Build croppedImages map for Results component
  const croppedImagesForResults: Record<string, string> = {}
  selectedItems.forEach((item, idx) => {
    if (item.croppedImageUrl) {
      const itemName = item.groundingdino_prompt || item.category
      const key = `${itemName}_${idx + 1}`
      croppedImagesForResults[key] = item.croppedImageUrl
    }
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="text-gray-600">공유된 결과를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <div className="text-6xl">❌</div>
          <h1 className="text-2xl font-bold text-gray-900">결과를 찾을 수 없습니다</h1>
          <p className="text-gray-600">{error}</p>
          <a 
            href="/"
            className="inline-block mt-4 px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
          >
            홈으로 돌아가기
          </a>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header with share info */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">공유된 검색 결과</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(createdAt).toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <a 
                href="/"
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                새로 검색하기
              </a>
            </div>
          </div>
        </div>

        {/* Results */}
        <ResultsBottomSheet
          results={results}
          isLoading={false}
          croppedImages={croppedImagesForResults}
          originalImageUrl={originalImageUrl}
          onReset={() => window.location.href = '/'}
          onBack={() => window.location.href = '/'}
          onResearch={() => {}}
          selectedItems={selectedItems}
          isSharedView={true}
        />
      </div>
    </main>
  )
}

