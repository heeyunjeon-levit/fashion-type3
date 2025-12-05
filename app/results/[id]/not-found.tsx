export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md mx-auto px-4">
        <div className="text-6xl">❌</div>
        <h1 className="text-2xl font-bold text-gray-900">결과를 찾을 수 없습니다</h1>
        <p className="text-gray-600">
          이 공유 링크가 만료되었거나 존재하지 않습니다.
        </p>
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

