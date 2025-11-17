'use client';

import { useState, useEffect } from 'react';

interface Metrics {
  batchSMSSent: number;
  linksVisited: number;
  converts: number;
  conversionRate: number;
  feedbackRate: number;
  activeUsersNow: number;
  todayVisits: number;
}

interface TopUser {
  phone: string;
  source: string;
  productClicks: number;
  appTime: number;
  batchTime: number;
  score: number;
}

interface Activity {
  id: string;
  type: 'click' | 'visit' | 'feedback' | 'upload' | 'results';
  phone: string;
  timestamp: string;
  timeAgo: string;
  // Product click details
  productTitle?: string;
  productThumbnail?: string;
  productLink?: string;
  itemCategory?: string;
  itemDescription?: string;
  // Result page visit details
  resultPageUrl?: string;
  clickedProducts?: number;
  // Upload details
  uploadedImageUrl?: string;
  isAnonymous?: boolean;
  // Results viewed details
  itemsDetected?: number;
  itemDetails?: Array<{
    category: string;
    description: string;
    productCount: number;
    products?: Array<{
      title: string;
      link: string;
      thumbnail: string;
    }>;
  }>;
  allProducts?: Array<{
    title: string;
    link: string;
    thumbnail: string;
    category: string;
    itemDescription: string;
  }>;
  totalProducts?: number;
  searchNumber?: number;
  totalSearches?: number;
  sourceCounts?: {
    gpt: number;
    fallback: number;
    none: number;
    error: number;
  };
}

export default function AnalyticsDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [liveActivity, setLiveActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [userSearch, setUserSearch] = useState('');
  const [userJourney, setUserJourney] = useState<any>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [journeyError, setJourneyError] = useState('');

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

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch metrics
      const metricsRes = await fetch('/api/analytics/metrics');
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      // Fetch top users
      const usersRes = await fetch('/api/analytics/top-users');
      const usersData = await usersRes.json();
      setTopUsers(usersData);

      // Fetch live activity
      const activityRes = await fetch('/api/analytics/live-activity');
      const activityData = await activityRes.json();
      setLiveActivity(activityData);

      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Fetch user journey
  const fetchUserJourney = async (phone: string) => {
    if (!phone.trim()) return;
    
    setLoadingJourney(true);
    setJourneyError('');
    
    try {
      const res = await fetch(`/api/analytics/user-journey?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      
      if (res.ok) {
        setUserJourney(data);
      } else {
        setJourneyError(data.error || 'User not found');
        setUserJourney(null);
      }
    } catch (error) {
      setJourneyError('Failed to fetch user journey');
      setUserJourney(null);
    } finally {
      setLoadingJourney(false);
    }
  };

  const handleUserSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUserJourney(userSearch);
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-6">🔒 Analytics Dashboard</h1>
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
  if (loading || !metrics) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">📊 FashionSource Analytics</h1>
            <p className="text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-red-500/20 text-red-500 px-4 py-2 rounded-lg border border-red-500/50">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-semibold">LIVE</span>
            </div>
            <button
              onClick={fetchData}
              className="bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 transition-all"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* User Journey Search */}
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-700/50 mb-8">
          <h2 className="text-2xl font-bold mb-4">🔍 Search User Journey</h2>
          <form onSubmit={handleUserSearchSubmit} className="mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Enter phone number (e.g. 01049971672)"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={loadingJourney}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingJourney ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {journeyError && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
              {journeyError}
            </div>
          )}

          {userJourney && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Phone</div>
                  <div className="font-mono text-lg">{userJourney.user.phone}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Total Searches</div>
                  <div className="text-2xl font-bold text-purple-400">{userJourney.stats.total_searches}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Product Clicks</div>
                  <div className="text-2xl font-bold text-green-400">{userJourney.stats.total_clicks}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Source</div>
                  <div className="text-sm">{userJourney.user.conversion_source || 'Unknown'}</div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-lg font-bold mb-3">📅 Complete Timeline</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {userJourney.timeline.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No activity found</p>
                  ) : (
                    userJourney.timeline.map((item: any, idx: number) => (
                      <TimelineItem key={idx} item={item} />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon="🔥"
            label="Active (24h)"
            value={metrics.activeUsersNow}
            subtitle={`${metrics.todayVisits} page visits`}
          />
          <MetricCard
            icon="📱"
            label="Batch Visitors"
            value={metrics.linksVisited}
            subtitle={`${((metrics.linksVisited / metrics.batchSMSSent) * 100).toFixed(1)}% open rate`}
          />
          <MetricCard
            icon="✅"
            label="Converts"
            value={metrics.converts}
            subtitle={`${metrics.conversionRate}% conversion`}
            highlight
          />
          <MetricCard
            icon="💬"
            label="Feedback Rate"
            value={`${metrics.feedbackRate}%`}
            subtitle="amazing engagement!"
          />
        </div>

        {/* Conversion Funnel */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
          <h2 className="text-xl font-bold mb-4">📈 Conversion Funnel</h2>
          <div className="space-y-3">
            <FunnelStep
              label="SMS Sent"
              count={metrics.batchSMSSent}
              percentage={100}
            />
            <FunnelStep
              label="Visited Links"
              count={metrics.linksVisited}
              percentage={(metrics.linksVisited / metrics.batchSMSSent) * 100}
            />
            <FunnelStep
              label="Converted to Main App"
              count={metrics.converts}
              percentage={(metrics.converts / metrics.batchSMSSent) * 100}
              highlight
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Live Activity Feed */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-bold mb-4">🔥 Live Activity Feed</h2>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {liveActivity.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No recent activity</p>
              ) : (
                liveActivity.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))
              )}
            </div>
          </div>

          {/* Top Engaged Users */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-bold mb-4">🏆 Top Engaged Users</h2>
            <p className="text-xs text-gray-400 mb-4">Click on a user to see their journey</p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {topUsers.map((user, idx) => (
                <UserItem 
                  key={user.phone} 
                  user={user} 
                  rank={idx + 1}
                  onClickUser={() => {
                    setUserSearch(user.phone);
                    fetchUserJourney(user.phone);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Components
function MetricCard({ icon, label, value, subtitle, highlight }: any) {
  return (
    <div className={`bg-gray-900 rounded-xl p-6 border ${
      highlight ? 'border-green-500/50 bg-green-500/5' : 'border-gray-800'
    }`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
  );
}

function FunnelStep({ label, count, percentage, highlight }: any) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-semibold">{count} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${highlight ? 'bg-green-500' : 'bg-blue-500'} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const icons = {
    click: '🛍️',
    visit: '👁️',
    feedback: '💬',
    upload: '📸',
    results: '🎯'
  };

  // Handle image uploads
  if (activity.type === 'upload') {
    const isAnonymous = activity.isAnonymous;
    const phoneDisplay = isAnonymous ? activity.phone : activity.phone.slice(0, 7) + '...';
    
    return (
      <div className={`p-4 rounded-lg hover:bg-gray-750 transition-all border ${
        isAnonymous 
          ? 'bg-gray-850 border-gray-700/50 opacity-80' 
          : 'bg-gray-800 border-gray-700'
      }`}>
        <div className="flex gap-3">
          {activity.uploadedImageUrl && (
            <img 
              src={activity.uploadedImageUrl} 
              alt="Uploaded"
              className="w-16 h-16 object-cover rounded"
            />
          )}
          <div className="flex-1">
            <div className="text-sm mb-1">
              <span className="text-yellow-400">📸</span>
              <span className={`font-mono ml-2 ${isAnonymous ? 'text-gray-500 italic' : 'text-gray-400'}`}>
                {phoneDisplay}
              </span>
              <span className="text-gray-500 mx-2">•</span>
              <span className="text-gray-300">uploaded new image</span>
              {isAnonymous && (
                <span className="ml-2 text-xs text-orange-400">(no phone yet)</span>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {activity.timeAgo}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activity.type === 'click' && activity.productTitle) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-all border border-gray-700">
        <div className="flex gap-3">
          {activity.productThumbnail && (
            <img 
              src={activity.productThumbnail} 
              alt={activity.productTitle}
              className="w-16 h-16 object-cover rounded"
            />
          )}
          <div className="flex-1">
            <div className="text-sm mb-1">
              <span className="text-green-400">🛍️</span>
              <span className="font-mono text-gray-400 ml-2">{activity.phone.slice(0, 7)}...</span>
              <span className="text-gray-500 mx-2">•</span>
              <span className="text-gray-300">clicked product</span>
            </div>
            <div className="text-xs font-semibold text-white mb-1 line-clamp-2">
              {activity.productTitle}
            </div>
            {activity.itemCategory && (
              <div className="text-xs text-gray-400 mb-1">
                <span className="text-purple-400">{activity.itemCategory}</span>
                {activity.itemDescription && (
                  <span className="text-gray-500"> - {activity.itemDescription}</span>
                )}
                <span className="text-gray-600"> • {activity.timeAgo}</span>
              </div>
            )}
            <div className="flex gap-3 text-xs">
              {activity.productLink && (
                <a 
                  href={activity.productLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  View product →
                </a>
              )}
              {activity.resultPageUrl && (
                <>
                  <span className="text-gray-600">|</span>
                  <a 
                    href={activity.resultPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:underline"
                  >
                    View their result page →
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activity.type === 'visit' && activity.resultPageUrl) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-all border border-gray-700">
        <div className="text-sm mb-2">
          <span className="text-blue-400">👁️</span>
          <span className="font-mono text-gray-400 ml-2">{activity.phone.slice(0, 7)}...</span>
          <span className="text-gray-500 mx-2">•</span>
          <span className="text-gray-300">viewed result page</span>
        </div>
        <div className="text-xs text-gray-400 mb-2">
          {activity.clickedProducts ? `Clicked ${activity.clickedProducts} products` : 'No clicks yet'} • {activity.timeAgo}
        </div>
        <a 
          href={activity.resultPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline"
        >
          View their result page →
        </a>
      </div>
    );
  }

  if (activity.type === 'results' && activity.allProducts) {
    return (
      <div className="p-4 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg hover:from-purple-900/40 hover:to-blue-900/40 transition-all border border-purple-700/50">
        <div className="text-sm mb-3">
          <span className="text-purple-400">🎯</span>
          <span className="font-mono text-gray-400 ml-2">{activity.phone.slice(0, 7)}...</span>
          <span className="text-gray-500 mx-2">•</span>
          <span className="text-gray-300">viewed search results</span>
          {activity.totalSearches && activity.totalSearches > 1 && (
            <span className="ml-2 px-2 py-0.5 bg-purple-600/50 text-purple-200 text-xs rounded">
              Search {activity.searchNumber} of {activity.totalSearches}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 mb-3">
          {activity.itemsDetected} items detected • {activity.totalProducts} products found • {activity.timeAgo}
        </div>
        
        {/* Items detected summary */}
        <div className="mb-3 space-y-1">
          {activity.itemDetails?.map((item, idx) => (
            <div key={idx} className="text-xs bg-gray-800/50 rounded px-2 py-1">
              <span className="text-purple-300 font-semibold">{item.category}:</span>{' '}
              <span className="text-gray-300">{item.description}</span>
            </div>
          ))}
        </div>

        {/* Product cards - horizontal scroll */}
        {activity.allProducts.length > 0 && (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {activity.allProducts.map((product, idx) => (
                <a
                  key={idx}
                  href={product.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-40 bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-400 transition-all group"
                >
                  {product.thumbnail && (
                    <img 
                      src={product.thumbnail} 
                      alt={product.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-2">
                    <div className="text-xs text-purple-300 mb-1">{product.itemDescription}</div>
                    <div className="text-xs text-white line-clamp-2 group-hover:text-purple-300 transition-colors">
                      {product.title}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {activity.allProducts.length === 0 && (
          <div className="text-xs text-gray-500 italic">No products found</div>
        )}
      </div>
    );
  }

  // Fallback for other activity types
  const labels = {
    click: 'clicked product',
    visit: 'viewed result page',
    feedback: 'submitted feedback',
    upload: 'uploaded image',
    results: 'viewed results'
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-all">
      <div className="text-2xl">{icons[activity.type]}</div>
      <div className="flex-1">
        <div className="text-sm">
          <span className="font-mono text-gray-400">{activity.phone.slice(0, 7)}...</span>
          <span className="text-gray-500 mx-2">•</span>
          <span>{labels[activity.type]}</span>
        </div>
        <div className="text-xs text-gray-500">{activity.timeAgo}</div>
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: any }) {
  const icons: Record<string, string> = {
    upload: '📸',
    search: '🎯',
    click: '🛍️',
    result_visit: '👁️',
    app_visit: '📱',
    feedback: '💬'
  };

  const labels: Record<string, string> = {
    upload: 'Uploaded image',
    search: 'Viewed search results',
    click: 'Clicked product',
    result_visit: 'Visited result page',
    app_visit: 'Visited app page',
    feedback: 'Submitted feedback'
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-purple-500 transition-all">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icons[item.type]}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">{labels[item.type]}</span>
            <span className="text-xs text-gray-400">{item.timeAgo}</span>
          </div>
          
          {item.type === 'upload' && item.data.url && (
            <img src={item.data.url} alt="Upload" className="w-24 h-24 object-cover rounded mt-2" />
          )}
          
          {item.type === 'search' && (
            <div className="text-sm text-gray-300 space-y-1">
              <div>{item.data.itemsDetected} items • {item.data.totalProducts} products found</div>
              {item.data.itemDetails.map((detail: any, idx: number) => (
                <div key={idx} className="text-xs text-gray-400">
                  • {detail.description}: {detail.productCount} products
                </div>
              ))}
            </div>
          )}
          
          {item.type === 'click' && (
            <div className="text-sm space-y-1">
              <div className="text-purple-300">{item.data.item_category}: {item.data.item_description}</div>
              <div className="text-gray-400 text-xs line-clamp-1">{item.data.product_title}</div>
            </div>
          )}
          
          {item.type === 'feedback' && (
            <div className="text-sm text-gray-300">
              <div>Rating: {item.data.satisfaction_rating}/5</div>
              {item.data.reason && <div className="text-xs text-gray-400 mt-1">Reason: {item.data.reason}</div>}
            </div>
          )}
          
          {item.type === 'result_visit' && (
            <div className="text-sm text-gray-400">
              Time on page: {item.data.time_on_page_seconds || 0}s
            </div>
          )}
          
          {item.type === 'app_visit' && (
            <div className="text-sm text-gray-400">
              Page: {item.data.page_path}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserItem({ user, rank, onClickUser }: { user: TopUser; rank: number; onClickUser: () => void }) {
  const medals = ['🥇', '🥈', '🥉'];
  
  return (
    <button
      onClick={onClickUser}
      className="w-full flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-all cursor-pointer hover:ring-2 hover:ring-purple-500"
    >
      <div className="text-2xl w-8">
        {rank <= 3 ? medals[rank - 1] : rank}
      </div>
      <div className="flex-1 text-left">
        <div className="font-mono text-sm">{user.phone}</div>
        <div className="text-xs text-gray-500">{user.source}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold">{user.productClicks} clicks</div>
        <div className="text-xs text-gray-500">{user.score} pts</div>
      </div>
    </button>
  );
}

