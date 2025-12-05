import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import ResultsBottomSheet from '@/app/components/ResultsBottomSheet'
import { DetectedItem } from '@/app/page'
import { getSupabaseServerClient } from '@/lib/supabaseServer'

// Enable caching for shared results pages (revalidate every hour)
export const revalidate = 3600

// This is now a Server Component - data fetched on server before render
async function getSharedResults(shareId: string) {
  const startTime = Date.now()
  
  try {
    console.log(`🔍 [SSR] Fetching shared results: ${shareId}`)
    
    const supabase = getSupabaseServerClient()
    
    const { data, error } = await supabase
      .from('shared_results')
      .select('*')
      .eq('id', shareId)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      console.error('❌ [SSR] Error fetching:', error)
      return null
    }

    // Increment view count (non-blocking)
    supabase
      .from('shared_results')
      .update({ 
        view_count: (data.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString()
      })
      .eq('id', shareId)
      .then((result) => {
        if (!result.error) {
          console.log(`👁️  [SSR] View count updated: ${shareId}`)
        }
      })

    const elapsed = Date.now() - startTime
    console.log(`✅ [SSR] Retrieved in ${elapsed}ms`)

    return {
      results: data.results,
      originalImageUrl: data.original_image_url,
      selectedItems: data.selected_items,
      searchMode: data.search_mode,
      createdAt: data.created_at
    }
  } catch (error) {
    console.error('❌ [SSR] Error:', error)
    return null
  }
}

export default async function SharedResultsPage({ params }: { params: { id: string } }) {
  const shareId = params.id
  const data = await getSharedResults(shareId)

  if (!data) {
    notFound()
  }

  const { results, originalImageUrl, selectedItems, searchMode, createdAt } = data

  // Build croppedImages map for Results component
  const croppedImagesForResults: Record<string, string> = {}
  selectedItems?.forEach((item: any, idx: number) => {
    if (item.croppedImageUrl) {
      const itemName = item.groundingdino_prompt || item.category
      const key = `${itemName}_${idx + 1}`
      croppedImagesForResults[key] = item.croppedImageUrl
    }
  })

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
        <Suspense fallback={
          <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
              <p className="text-gray-600">공유된 결과를 불러오는 중...</p>
            </div>
          </div>
        }>
          <SharedResultsClient
            results={results}
            originalImageUrl={originalImageUrl || ''}
            selectedItems={selectedItems || []}
            createdAt={createdAt || ''}
            croppedImages={croppedImagesForResults}
          />
        </Suspense>
      </div>
    </main>
  )
}

// Client component for interactive parts only
'use client'

function SharedResultsClient({ 
  results, 
  originalImageUrl, 
  selectedItems, 
  createdAt,
  croppedImages 
}: {
  results: Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>>
  originalImageUrl: string
  selectedItems: DetectedItem[]
  createdAt: string
  croppedImages: Record<string, string>
}) {
  return (
    <ResultsBottomSheet
      results={results}
      isLoading={false}
      croppedImages={croppedImages}
      originalImageUrl={originalImageUrl}
      onReset={() => window.location.href = '/'}
      onBack={() => window.location.href = '/'}
      onResearch={() => {}}
      selectedItems={selectedItems}
      isSharedView={true}
    />
  )
}

