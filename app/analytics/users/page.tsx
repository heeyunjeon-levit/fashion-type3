'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserSummary {
  phone: string;
  created_at: string;
  conversion_source: string;
  total_searches: number;
  total_uploads: number;
  total_clicks: number;
  total_visits: number;
  total_feedback: number;
  feedback_satisfaction?: string;
  last_active_at: string;
  journey: {
    uploads: number;
    searches: number;
    clicks: number;
    feedback: number;
    hasPositiveFeedback: boolean;
    hasNegativeFeedback: boolean;
  };
}

// Hash phone number for privacy-safe URLs
async function hashPhone(phone: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phone);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16); // Use first 16 chars for shorter URL
}

export default function UsersAnalytics() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'feedback' | 'converts' | 'clicks' | 'batch'>('all');
  const [sortBy, setSortBy] = useState<'first' | 'recent' | 'clicks' | 'engagement'>('recent');
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [userJourney, setUserJourney] = useState<any>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [phoneHashMap, setPhoneHashMap] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const userListRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<number>(0);

  // Check password
  const handleLogin = () => {
    if (password === '2025') {
      setIsAuthenticated(true);
      localStorage.setItem('analytics_auth', 'true');
    } else {
      alert('Incorrect password!');
    }
  };

  // Check if already authenticated
  useEffect(() => {
    const auth = localStorage.getItem('analytics_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch user journey details
  const fetchUserJourney = async (phone: string) => {
    try {
      setLoadingJourney(true);
      const res = await fetch(`/api/analytics/user-journey?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      
      if (res.ok) {
        setUserJourney(data);
      } else {
        setUserJourney(null);
      }
    } catch (error) {
      console.error('Failed to fetch user journey:', error);
      setUserJourney(null);
    } finally {
      setLoadingJourney(false);
    }
  };

  // Handle user selection
  const handleSelectUser = async (user: UserSummary) => {
    // Save current scroll position to ref (persists across renders)
    savedScrollRef.current = userListRef.current?.scrollTop || 0;
    
    setSelectedUser(user);
    fetchUserJourney(user.phone);
    
    // Update URL with hashed user ID (privacy-safe shareable link!)
    const hash = await hashPhone(user.phone);
    router.push(`/analytics/users?u=${hash}`, { scroll: false });
  };

  // Restore scroll position after user selection
  useEffect(() => {
    if (selectedUser && savedScrollRef.current > 0) {
      // Use multiple requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (userListRef.current) {
            userListRef.current.scrollTop = savedScrollRef.current;
          }
        });
      });
    }
  }, [selectedUser]);

  // Fetch all users (fresh data on page load/refresh)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Cache-busting to ensure fresh data
      const timestamp = Date.now();
      const res = await fetch(`/api/analytics/all-users?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json();
      
      // Debug: Log top 3 users to verify correct data
      console.log('📊 Top 3 users from API:', data.slice(0, 3).map((u: any) => ({
        phone: u.phone,
        last_active_at: u.last_active_at,
        activities: `U:${u.total_uploads} S:${u.total_searches} C:${u.total_clicks} F:${u.total_feedback}`
      })));
      
      setUsers(data);
      
      // Build hash map for all users (hash -> phone)
      const hashMap = new Map<string, string>();
      for (const user of data) {
        const hash = await hashPhone(user.phone);
        hashMap.set(hash, user.phone);
      }
      setPhoneHashMap(hashMap);
      setLastUpdated(new Date());
      
      // Check if there's a user hash parameter in URL
      const userHashParam = searchParams.get('u');
      
      if (userHashParam && data.length > 0) {
        // Try to find user from hashed URL parameter
        const phoneNumber = hashMap.get(userHashParam);
        const userFromUrl = phoneNumber ? data.find((u: UserSummary) => u.phone === phoneNumber) : null;
        
        if (userFromUrl) {
          setSelectedUser(userFromUrl);
          fetchUserJourney(userFromUrl.phone);
        } else {
          // Hash not found, select first user
          setSelectedUser(data[0]);
          fetchUserJourney(data[0].phone);
        }
      } else if (data.length > 0) {
        // No URL param, auto-select first user
        setSelectedUser(data[0]);
        fetchUserJourney(data[0].phone);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch users on mount or when URL params change
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUsers();
  }, [isAuthenticated, searchParams]);

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      // Filter by search query first
      if (searchQuery.trim()) {
        return user.phone.includes(searchQuery.trim());
      }
      
      // Then filter by category
      if (filter === 'all') return true;
      if (filter === 'feedback') return user.total_feedback > 0;
      if (filter === 'converts') return user.conversion_source !== 'unknown' && user.conversion_source !== null;
      if (filter === 'clicks') return user.total_clicks > 0;
      if (filter === 'batch') return user.total_uploads === 0 && user.total_searches === 0 && user.journey.searches === 0; // Batch users = really no searches
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'first') {
        // Earliest first (oldest created_at on top)
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'recent') {
        // Most recent activity first
        const aTime = new Date(a.last_active_at).getTime();
        const bTime = new Date(b.last_active_at).getTime();
        
        // Debug first 3 comparisons
        if (sortBy === 'recent' && users.indexOf(a) < 3 && users.indexOf(b) < 3) {
          console.log(`🔀 Comparing: ${a.phone} (${a.last_active_at}) vs ${b.phone} (${b.last_active_at})`);
        }
        
        return bTime - aTime;
      } else if (sortBy === 'clicks') {
        return b.total_clicks - a.total_clicks;
      } else {
        // engagement = clicks + searches + feedback
        const aScore = a.total_clicks + a.total_searches + (a.total_feedback * 5);
        const bScore = b.total_clicks + b.total_searches + (b.total_feedback * 5);
        return bScore - aScore;
      }
    });

  // Debug: Log final sorted result
  if (filteredUsers.length > 0 && sortBy === 'recent') {
    console.log('✅ Final top 3 after sort:', filteredUsers.slice(0, 3).map(u => ({
      phone: u.phone,
      last_active_at: u.last_active_at
    })));
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-6">🔒 Users Analytics</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Enter password"
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 mb-4 focus:outline-none focus:border-white"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:bg-gray-200 transition-all"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex overflow-hidden">
      {/* Left Sidebar - User List */}
      <div className="w-80 border-r border-gray-800 flex flex-col overflow-hidden">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-800">
          <Link 
            href="/analytics" 
            className="text-sm text-gray-400 hover:text-white mb-3 inline-block"
          >
            ← Dashboard
          </Link>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">👥 All Users</h2>
            <div className="text-xs text-gray-500">
              {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="mb-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search phone number..."
                className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 text-sm placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          
          {/* Filters */}
          <div className="space-y-2 mb-3">
            <button
              onClick={() => setFilter('all')}
              className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all text-left ${
                filter === 'all' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setFilter('clicks')}
              className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all text-left ${
                filter === 'clicks' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🛍️ Clicked ({users.filter(u => u.total_clicks > 0).length})
            </button>
            <button
              onClick={() => setFilter('feedback')}
              className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all text-left ${
                filter === 'feedback' 
                  ? 'bg-pink-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              💬 Feedback ({users.filter(u => u.total_feedback > 0).length})
            </button>
            <button
              onClick={() => setFilter('batch')}
              className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all text-left ${
                filter === 'batch' 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              📧 Batch Only ({users.filter(u => u.total_uploads === 0 && u.total_searches === 0 && u.journey.searches === 0).length})
            </button>
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 text-sm"
          >
            <option value="recent">📅 Most Recent</option>
            <option value="first">⏰ First Activity</option>
            <option value="clicks">🛍️ Most Clicks</option>
            <option value="engagement">⭐ Most Engaged</option>
          </select>
        </div>

        {/* User List */}
        <div ref={userListRef} className="flex-1 overflow-y-auto" style={{ scrollBehavior: 'auto' }}>
          {filteredUsers.length === 0 ? (
            <div className="text-center text-gray-500 py-8 px-4 text-sm">
              No users found
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredUsers.map((user) => (
                <button
                  key={user.phone}
                  onClick={() => handleSelectUser(user)}
                  className={`w-full p-4 text-left hover:bg-gray-800 transition-all ${
                    selectedUser?.phone === user.phone ? 'bg-gray-800 border-l-4 border-purple-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-mono text-sm font-semibold">{user.phone}</div>
                    {/* Show batch badge only if REALLY no searches (check DB total_searches too) */}
                    {user.total_uploads === 0 && user.total_searches === 0 && user.journey.searches === 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-orange-600/30 text-orange-400 rounded">
                        📧
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {user.total_clicks > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-green-600/30 text-green-400 rounded">
                        🛍️ {user.total_clicks}
                      </span>
                    )}
                    {user.total_feedback > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        user.journey.hasPositiveFeedback 
                          ? 'bg-green-600/30 text-green-400' 
                          : 'bg-red-600/30 text-red-400'
                      }`}>
                        {user.journey.hasPositiveFeedback ? '😊' : '😞'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {user.conversion_source || 'Unknown'} • {new Date(user.last_active_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - User Journey */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {!selectedUser ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a user to view their journey
          </div>
        ) : loadingJourney ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading journey...</div>
          </div>
        ) : userJourney ? (
          <UserJourneyView user={selectedUser} journey={userJourney} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No journey data available
          </div>
        )}
      </div>
    </div>
  );
}

function UserJourneyView({ user, journey }: { user: UserSummary; journey: any }) {
  // Define event type priority for proper chronological ordering
  const eventTypePriority: Record<string, number> = {
    'upload': 1,           // Always first
    'search': 2,           // GPT selection
    'final_results': 3,    // Result page shown
    'click': 4,            // Product clicks
    'result_visit': 5,     // Page visits
    'feedback': 6          // Feedback (always last)
  };

  // Sort timeline by logical event order, NOT by timestamp
  // (timestamps can be unreliable due to logging issues)
  const sortedTimeline = [...journey.timeline].sort((a, b) => {
    const priorityA = eventTypePriority[a.type] || 99;
    const priorityB = eventTypePriority[b.type] || 99;
    
    // If same event type, sort by timestamp
    if (priorityA === priorityB) {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    }
    
    // Otherwise, always use logical priority order
    return priorityA - priorityB;
  });

  // Find result page URL from journey data
  const resultPageUrl = journey.timeline.find((t: any) => t.type === 'result_visit')?.data?.result_page_url;
  
  // Determine user type
  const hasUploads = sortedTimeline.some((t: any) => t.type === 'upload');
  const hasSearches = sortedTimeline.some((t: any) => t.type === 'search' || t.type === 'final_results');
  const hasResultVisit = sortedTimeline.some((t: any) => t.type === 'result_visit');
  const hasFeedback = sortedTimeline.some((t: any) => t.type === 'feedback');
  
  // Trust users.total_searches if events are missing (legacy users before proper event logging)
  const hasSearchesFromDB = journey.user.total_searches > 0;
  
  const isBatchUser = !hasUploads && !hasSearches && !hasSearchesFromDB && (hasResultVisit || hasFeedback);
  const userType = isBatchUser ? 'batch' : 'main_app';

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold font-mono">{user.phone}</h1>
            {isBatchUser && (
              <span className="px-3 py-1 bg-orange-600/30 text-orange-300 rounded-lg text-sm font-semibold border border-orange-500/50">
                📧 Batch User
              </span>
            )}
            {!isBatchUser && hasUploads && (
              <span className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded-lg text-sm font-semibold border border-blue-500/50">
                📱 Main App User
              </span>
            )}
          </div>
          {resultPageUrl && (
            <a
              href={resultPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
            >
              🔗 View Result Page
            </a>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Source: {journey.user.conversion_source || 'Unknown'}</span>
          <span>•</span>
          <span>Created: {new Date(journey.user.created_at).toLocaleDateString()}</span>
          <span>•</span>
          <span>Last active: {new Date(journey.user.last_active_at).toLocaleDateString()}</span>
        </div>
        
        {/* Batch user explanation */}
        {isBatchUser && (
          <div className="mt-3 px-4 py-2 bg-orange-900/20 border border-orange-600/30 rounded-lg text-sm text-orange-200">
            <strong>📧 Batch User:</strong> This user received a pre-generated result page via SMS. They never uploaded their own images or used the main app.
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <div className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded text-sm">
            {journey.stats.total_searches} searches
          </div>
          <div className="px-3 py-1 bg-green-600/30 text-green-300 rounded text-sm">
            {journey.stats.total_clicks} clicks
          </div>
          {journey.stats.total_feedback > 0 && (
            <div className="px-3 py-1 bg-pink-600/30 text-pink-300 rounded text-sm">
              {journey.stats.total_feedback} feedback
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute top-12 left-0 right-0 h-0.5 bg-gray-800"></div>
        
        {/* Timeline events */}
        <div className="flex gap-6 overflow-x-auto pb-6 relative">
          {sortedTimeline.map((item: any, idx: number) => (
            <TimelineEventNode key={idx} item={item} index={idx} />
          ))}
        </div>
      </div>

      {sortedTimeline.length === 0 && (
        <div className="text-center py-12">
          {journey.user.total_searches > 0 ? (
            <div className="text-gray-400">
              <div className="text-yellow-400 text-4xl mb-3">⚠️</div>
              <div className="font-semibold mb-2">Legacy User - Incomplete Data</div>
              <div className="text-sm">
                This user completed {journey.user.total_searches} search{journey.user.total_searches > 1 ? 'es' : ''} but events weren&apos;t logged.
                <br />
                They used the app before comprehensive event tracking was implemented.
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No activity recorded for this user</div>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineEventNode({ item, index }: { item: any; index: number }) {
  const typeColors: Record<string, { bg: string; border: string; text: string }> = {
    upload: { bg: 'bg-yellow-900/30', border: 'border-yellow-500/50', text: 'text-yellow-400' },
    search: { bg: 'bg-purple-900/30', border: 'border-purple-500/50', text: 'text-purple-400' },
    final_results: { bg: 'bg-green-900/30', border: 'border-green-500/50', text: 'text-green-400' },
    click: { bg: 'bg-green-900/30', border: 'border-green-500/50', text: 'text-green-400' },
    feedback: { 
      bg: item.data.satisfaction === '만족' ? 'bg-green-900/30' : 'bg-red-900/30',
      border: item.data.satisfaction === '만족' ? 'border-green-500/50' : 'border-red-500/50',
      text: item.data.satisfaction === '만족' ? 'text-green-400' : 'text-red-400'
    },
    result_visit: { bg: 'bg-blue-900/30', border: 'border-blue-500/50', text: 'text-blue-400' },
    app_visit: { bg: 'bg-cyan-900/30', border: 'border-cyan-500/50', text: 'text-cyan-400' },
  };

  const icons: Record<string, string> = {
    upload: '📸',
    search: '🎯',
    final_results: '✨',
    click: '🛍️',
    feedback: item.data.satisfaction === '만족' ? '😊' : '😞',
    result_visit: '👁️',
    app_visit: '📱',
  };

  const labels: Record<string, string> = {
    upload: 'Uploaded Image',
    search: 'GPT Selection',
    final_results: 'Results Shown',
    click: 'Clicked Product',
    feedback: 'Feedback',
    result_visit: 'Visited Results',
    app_visit: 'App Visit',
  };

  const colors = typeColors[item.type] || { bg: 'bg-gray-800', border: 'border-gray-700', text: 'text-gray-400' };

  // Expand cards for GPT selection and Results Shown
  const isExpanded = item.type === 'search' || item.type === 'final_results';
  const cardWidth = isExpanded ? '400px' : '250px';

  return (
    <div className="flex-shrink-0 relative" style={{ minWidth: cardWidth, maxWidth: cardWidth }}>
      {/* Connection dot on timeline */}
      <div className={`absolute top-12 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-4 border-black ${colors.bg} ${colors.border} z-10`}></div>
      
      {/* Event card */}
      <div className={`mt-20 rounded-lg border ${colors.bg} ${colors.border} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{icons[item.type]}</span>
          <span className={`text-sm font-semibold ${colors.text}`}>{labels[item.type]}</span>
        </div>
        
        <div className="text-xs text-gray-400 mb-2">{item.timeAgo}</div>
        
        {/* Type-specific content */}
        {item.type === 'upload' && item.data.url && (
          <img src={item.data.url} alt="Upload" className="w-full h-32 object-cover rounded mt-2" />
        )}
        
        {/* GPT Selection - Show detailed reasoning */}
        {item.type === 'search' && (
          <div className="text-xs">
            <div className="text-gray-300 mb-2">
              {item.data.itemsDetected} items detected • {item.data.totalProducts} products selected
            </div>
            {item.data.itemDetails && item.data.itemDetails.length > 0 && (
              <div className="space-y-2">
                {item.data.itemDetails.map((detail: any, idx: number) => (
                  <div key={idx} className="bg-gray-800/60 rounded p-2 border border-purple-400/20">
                    <div className="font-semibold text-purple-300 mb-1">{detail.category}</div>
                    <div className="text-gray-400 text-xs mb-1">{detail.description}</div>
                    <div className="text-purple-400">{detail.productCount} products selected</div>
                    {/* Show product thumbnails */}
                    {detail.products && detail.products.length > 0 && (
                      <div className="grid grid-cols-3 gap-1 mt-2">
                        {detail.products.slice(0, 3).map((product: any, pIdx: number) => (
                          product.thumbnail && (
                            <img 
                              key={pIdx}
                              src={product.thumbnail} 
                              alt=""
                              className="w-full h-16 object-cover rounded"
                            />
                          )
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Results Shown - Show actual product cards */}
        {item.type === 'final_results' && (
          <div className="text-xs">
            <div className="text-gray-300 mb-2">
              {item.data.totalProducts} products displayed
              {item.data.gptProducts > 0 && <div className="text-purple-400">{item.data.gptProducts} from AI</div>}
              {item.data.fallbackProducts > 0 && <div className="text-orange-400">{item.data.fallbackProducts} fallback</div>}
            </div>
            {item.data.categoryDetails && item.data.categoryDetails.length > 0 && (
              <div className="space-y-2">
                {item.data.categoryDetails.map((cat: any, idx: number) => (
                  <div key={idx} className="bg-gray-800/60 rounded p-2 border border-green-400/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-green-300">{cat.category}</div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        cat.source === 'gpt' 
                          ? 'bg-purple-600/50 text-purple-200' 
                          : 'bg-orange-600/50 text-orange-200'
                      }`}>
                        {cat.source === 'gpt' ? 'AI' : 'Fallback'}
                      </span>
                    </div>
                    {/* Show product thumbnails */}
                    {cat.products && cat.products.length > 0 && (
                      <div className="grid grid-cols-3 gap-1">
                        {cat.products.slice(0, 6).map((product: any, pIdx: number) => (
                          product.thumbnail && (
                            <div key={pIdx} className="relative">
                              <img 
                                src={product.thumbnail} 
                                alt=""
                                className="w-full h-16 object-cover rounded"
                              />
                              <div className="absolute top-0 right-0 bg-black/70 text-white text-xs px-1 rounded-bl">
                                #{product.position}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {item.type === 'click' && (
          <div className="text-sm">
            {item.data.product_thumbnail && (
              <img src={item.data.product_thumbnail} alt="" className="w-full h-32 object-cover rounded mb-2" />
            )}
            <div className="text-white font-medium mb-2 leading-snug">{item.data.product_title}</div>
            {item.data.product_link && (
              <a 
                href={item.data.product_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline font-semibold"
              >
                🔗 View Product
              </a>
            )}
          </div>
        )}
        
        {item.type === 'feedback' && (
          <div className="text-sm">
            <div className={`font-semibold text-lg ${colors.text} mb-2`}>
              {item.data.satisfaction === '만족' ? '😊 만족' : '😞 불만족'}
            </div>
            {item.data.comment && (
              <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-white leading-relaxed">
                💬 {item.data.comment}
              </div>
            )}
          </div>
        )}
        
        {item.type === 'result_visit' && item.data.result_page_url && (
          <div className="text-xs mt-2">
            <a 
              href={item.data.result_page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline"
            >
              🔗 View Page
            </a>
            {item.data.time_on_page_seconds && (
              <div className="text-gray-400 mt-1">
                {item.data.time_on_page_seconds}s on page
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

