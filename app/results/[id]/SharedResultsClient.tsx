'use client'

import ResultsBottomSheet from '@/app/components/ResultsBottomSheet'
import { DetectedItem } from '@/app/page'

export default function SharedResultsClient({ 
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
    <>
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
        croppedImages={croppedImages}
        originalImageUrl={originalImageUrl}
        onReset={() => window.location.href = '/'}
        onBack={() => window.location.href = '/'}
        onResearch={() => {}}
        selectedItems={selectedItems}
        isSharedView={true}
      />
    </>
  )
}

