'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ResultsBottomSheet from '@/app/components/ResultsBottomSheet';

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: any;
  meta?: any;
  error?: string;
  originalImageUrl?: string;
  croppedImages?: Record<string, string>;
  categories?: string[];
}

export default function SearchResultsPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResults() {
      try {
        console.log(`📂 Loading search results for job: ${jobId}`);
        
        const response = await fetch(`/api/search-job/${jobId}`);
        
        if (!response.ok) {
          throw new Error('Results not found');
        }
        
        const data = await response.json();
        console.log(`✅ Loaded job data:`, data);
        
        setJobStatus(data);
        setLoading(false);
      } catch (err: any) {
        console.error('❌ Error loading results:', err);
        setError(err.message || 'Failed to load results');
        setLoading(false);
      }
    }
    
    if (jobId) {
      loadResults();
    }
  }, [jobId]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your results...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !jobStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Results Not Found</h1>
          <p className="text-gray-600 mb-6">
            {error || 'This search may have expired or the link is invalid.'}
          </p>
          <a
            href="/"
            className="inline-block bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition"
          >
            Start New Search
          </a>
        </div>
      </div>
    );
  }

  // Still processing
  if (jobStatus.status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-black mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Still Processing</h1>
          <p className="text-gray-600 mb-2">
            Your search is still being processed...
          </p>
          <p className="text-sm text-gray-500">Progress: {jobStatus.progress}%</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-block bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Failed state
  if (jobStatus.status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Search Failed</h1>
          <p className="text-gray-600 mb-6">
            {jobStatus.error || 'An error occurred while processing your search.'}
          </p>
          <a
            href="/"
            className="inline-block bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition"
          >
            Try Again
          </a>
        </div>
      </div>
    );
  }

  // Completed - show results (no header, just results with background image like main page)
  if (jobStatus.status === 'completed' && jobStatus.results) {
    return (
      <ResultsBottomSheet
        results={jobStatus.results}
        isLoading={false}
        croppedImages={jobStatus.croppedImages || {}}
        originalImageUrl={jobStatus.originalImageUrl || ''}
        onReset={() => window.location.href = '/'}
        onBack={() => window.location.href = '/'}
        onResearch={() => window.location.href = '/'}
        selectedItems={Object.keys(jobStatus.results)}
        isSharedView={true}
      />
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600">No results available</p>
      </div>
    </div>
  );
}

