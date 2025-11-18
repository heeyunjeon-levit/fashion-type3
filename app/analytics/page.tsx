'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

  // Check for search parameter in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const searchParam = params.get('search');
      if (searchParam && isAuthenticated) {
        setUserSearch(searchParam);
        fetchUserJourney(searchParam);
        // Scroll to user journey section
        setTimeout(() => {
          const element = document.getElementById('user-journey-section');
          element?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [isAuthenticated]);

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

  // Fetch all data (used on initial load and manual refresh)
  const fetchData = async () => {
    try {
      setLoading(true);
      
      const timestamp = Date.now();
      const fetchOptions = {
        cache: 'no-store' as RequestCache,
        headers: {
          'Cache-Control': 'no-cache'
        }
      };
      
      // Fetch metrics
      const metricsRes = await fetch('/api/analytics/metrics?t=' + timestamp, fetchOptions);
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      // Fetch top users
      const usersRes = await fetch('/api/analytics/top-users?t=' + timestamp, fetchOptions);
      const usersData = await usersRes.json();
      setTopUsers(usersData);

      // Fetch live activity
      const activityRes = await fetch('/api/analytics/live-activity?t=' + timestamp, fetchOptions);
      const activityData = await activityRes.json();
      setLiveActivity(activityData);

      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setLoading(false);
    }
  };

  // Fetch only live activity (for auto-refresh, no loading state)
  const fetchLiveActivityOnly = async () => {
    try {
      // Add cache-busting and force fresh data
      const activityRes = await fetch('/api/analytics/live-activity?t=' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const activityData = await activityRes.json();
      setLiveActivity(activityData);
      setLastUpdated(new Date());
      console.log('🔄 Live activity refreshed at', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch live activity:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Auto-refresh ONLY live activity every 30 seconds (no flicker)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      fetchLiveActivityOnly();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
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
            <Link
              href="/analytics/users"
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-all font-semibold"
            >
              👥 View All Users
            </Link>
            <button
              onClick={fetchData}
              className="bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 transition-all"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* User Journey Search */}
        <div id="user-journey-section" className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-700/50 mb-8">
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="text-gray-400 text-sm mb-1">Phone</div>
                  <div className="font-mono text-lg">{userJourney.user.phone}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-purple-500/50">
                  <div className="text-gray-400 text-sm mb-1">Total Searches</div>
                  <div className="text-2xl font-bold text-purple-400">{userJourney.stats.total_searches}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-green-500/50">
                  <div className="text-gray-400 text-sm mb-1">Product Clicks</div>
                  <div className="text-2xl font-bold text-green-400">{userJourney.stats.total_clicks}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-blue-500/50">
                  <div className="text-gray-400 text-sm mb-1">Page Visits</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {userJourney.stats.total_result_visits + userJourney.stats.total_app_visits}
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-pink-500/50">
                  <div className="text-gray-400 text-sm mb-1">Source</div>
                  <div className="text-sm font-semibold text-pink-300">{userJourney.user.conversion_source || 'Unknown'}</div>
                  {userJourney.stats.total_feedback > 0 && (
                    <div className="text-xs text-gray-400 mt-1">💬 {userJourney.stats.total_feedback} feedback</div>
                  )}
                </div>
              </div>

              {/* Additional User Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-gray-400 text-xs mb-2">ACCOUNT CREATED</div>
                  <div className="text-sm text-white">
                    {new Date(userJourney.user.created_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-gray-400 text-xs mb-2">LAST ACTIVE</div>
                  <div className="text-sm text-white">
                    {new Date(userJourney.user.last_active_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>

              {userJourney.user.notes && (
                <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4">
                  <div className="text-yellow-400 text-xs font-semibold mb-2">📝 NOTES</div>
                  <div className="text-sm text-yellow-100">{userJourney.user.notes}</div>
                </div>
              )}

              {/* Feedback Summary */}
              {userJourney.stats.total_feedback > 0 && (
                <div className="bg-gradient-to-r from-pink-900/30 to-purple-900/30 border border-pink-500/50 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">💬</span>
                    <h3 className="text-lg font-bold text-pink-300">User Feedback ({userJourney.stats.total_feedback})</h3>
                  </div>
                  <div className="space-y-3">
                    {userJourney.timeline
                      .filter((item: any) => item.type === 'feedback')
                      .map((item: any, idx: number) => (
                        <div key={idx} className="bg-gray-800/60 rounded-lg p-4 border border-pink-400/30">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {item.data.satisfaction === '만족' ? (
                                <span className="text-3xl">😊</span>
                              ) : (
                                <span className="text-3xl">😞</span>
                              )}
                              <span className={`text-lg font-bold ${
                                item.data.satisfaction === '만족' ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {item.data.satisfaction}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">{item.timeAgo}</span>
                          </div>
                          {item.data.comment && (
                            <div className="mt-2 bg-gray-900/50 rounded px-3 py-2">
                              <div className="text-xs text-gray-400 mb-1">Comment:</div>
                              <div className="text-sm text-white">{item.data.comment}</div>
                            </div>
                          )}
                          {item.data.result_page_url && (
                            <div className="mt-2 text-xs text-gray-500">
                              Page: {item.data.result_page_url.split('/').pop()}
                            </div>
                          )}
                          {item.data.page_load_time && (
                            <div className="mt-1 text-xs text-gray-500">
                              Submitted after {item.data.page_load_time}s
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-lg font-bold mb-3 flex items-center justify-between">
                  <span>📅 Complete Timeline</span>
                  <span className="text-sm font-normal text-gray-400">{userJourney.timeline.length} events</span>
                </h3>
                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-gray-800">
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">🔥 Live Activity Feed</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
            
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
    final_results: '✨',
    click: '🛍️',
    result_visit: '👁️',
    app_visit: '📱',
    feedback: '💬'
  };

  const labels: Record<string, string> = {
    upload: 'Uploaded image',
    search: 'GPT filtered products',
    final_results: 'Final results displayed',
    click: 'Clicked product',
    result_visit: 'Visited result page',
    app_visit: 'Visited app page',
    feedback: 'Submitted feedback'
  };

  // UPLOAD - Show large image
  if (item.type === 'upload' && item.data.url) {
    return (
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-yellow-500 transition-all">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{icons[item.type]}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-semibold text-yellow-400">{labels[item.type]}</span>
              <span className="text-xs text-gray-400">{item.timeAgo}</span>
            </div>
            <img 
              src={item.data.url} 
              alt="Upload" 
              className="w-full max-w-md h-auto object-cover rounded-lg shadow-lg border border-gray-600" 
            />
          </div>
        </div>
      </div>
    );
  }

  // SEARCH RESULTS (GPT Selection) - Show all products with images in a grid
  if (item.type === 'search' && item.data.itemDetails) {
    const allProducts = item.data.itemDetails.flatMap((detail: any) => 
      (detail.products || []).map((p: any) => ({
        ...p,
        category: detail.category,
        description: detail.description
      }))
    );

    return (
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 rounded-lg p-5 border border-purple-500/50 hover:border-purple-400 transition-all">
        <div className="flex items-start gap-4 mb-4">
          <div className="text-3xl">{icons[item.type]}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-semibold text-purple-300">{labels[item.type]}</span>
              <span className="text-xs text-gray-400">{item.timeAgo}</span>
            </div>
            <div className="text-sm text-purple-200 mb-3">
              {item.data.itemsDetected} items detected • {item.data.totalProducts} products found
            </div>
            
            {/* Items detected details */}
            <div className="space-y-2 mb-4">
              {item.data.itemDetails.map((detail: any, idx: number) => (
                <div key={idx} className="bg-gray-800/60 rounded-lg px-3 py-2 border border-purple-400/30">
                  <span className="text-sm font-semibold text-purple-300">{detail.category}:</span>{' '}
                  <span className="text-sm text-gray-200">{detail.description}</span>
                  <span className="text-xs text-gray-400 ml-2">({detail.productCount} products)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid - Show ALL products */}
        {allProducts.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-purple-300 mb-3 uppercase tracking-wide">
              All {allProducts.length} Products Selected by AI
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {allProducts.map((product: any, idx: number) => (
                <a
                  key={idx}
                  href={product.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-800/80 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-400 transition-all group shadow-lg hover:shadow-purple-500/50"
                >
                  {product.thumbnail && (
                    <img 
                      src={product.thumbnail} 
                      alt={product.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-2">
                    <div className="text-xs text-purple-300 font-semibold mb-1">
                      {product.description}
                    </div>
                    <div className="text-xs text-white line-clamp-2 group-hover:text-purple-300 transition-colors">
                      {product.title}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {allProducts.length === 0 && (
          <div className="text-sm text-gray-500 italic text-center py-4">No products selected by AI</div>
        )}
      </div>
    );
  }

  // FINAL RESULTS DISPLAYED - Show what user actually saw (including fallback)
  if (item.type === 'final_results' && item.data.categoryDetails) {
    const allProducts = item.data.categoryDetails.flatMap((cat: any) => 
      (cat.products || []).map((p: any) => ({
        ...p,
        category: cat.category,
        source: cat.source,
        productCount: cat.productCount
      }))
    );

    return (
      <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 rounded-lg p-5 border border-green-500/50 hover:border-green-400 transition-all">
        <div className="flex items-start gap-4 mb-4">
          <div className="text-3xl">{icons[item.type]}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-semibold text-green-300">{labels[item.type]}</span>
              <span className="text-xs text-gray-400">{item.timeAgo}</span>
            </div>
            <div className="text-sm text-green-200 mb-3">
              {item.data.totalProducts} total products displayed
              {item.data.gptProducts > 0 && (
                <span className="ml-2 text-purple-300">({item.data.gptProducts} from AI)</span>
              )}
              {item.data.fallbackProducts > 0 && (
                <span className="ml-2 text-orange-300">({item.data.fallbackProducts} fallback)</span>
              )}
            </div>
            
            {/* Category breakdown */}
            <div className="space-y-2 mb-4">
              {item.data.categoryDetails.map((cat: any, idx: number) => (
                <div key={idx} className="bg-gray-800/60 rounded-lg px-3 py-2 border border-green-400/30">
                  <span className="text-sm font-semibold text-green-300">{cat.category}:</span>{' '}
                  <span className="text-sm text-gray-200">{cat.productCount} products</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                    cat.source === 'gpt' 
                      ? 'bg-purple-600/50 text-purple-200' 
                      : 'bg-orange-600/50 text-orange-200'
                  }`}>
                    {cat.source === 'gpt' ? 'AI Selected' : 'Fallback'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid - Show ALL displayed products */}
        {allProducts.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-green-300 mb-3 uppercase tracking-wide">
              All {allProducts.length} Products User Saw
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {allProducts.map((product: any, idx: number) => (
                <a
                  key={idx}
                  href={product.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded-lg overflow-hidden hover:ring-2 transition-all group shadow-lg relative ${
                    product.source === 'gpt'
                      ? 'bg-purple-900/40 hover:ring-purple-400 hover:shadow-purple-500/50'
                      : 'bg-orange-900/40 hover:ring-orange-400 hover:shadow-orange-500/50'
                  }`}
                >
                  {product.thumbnail && (
                    <img 
                      src={product.thumbnail} 
                      alt={product.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      product.source === 'gpt'
                        ? 'bg-purple-600 text-white'
                        : 'bg-orange-600 text-white'
                    }`}>
                      #{product.position}
                    </span>
                  </div>
                  <div className="p-2">
                    <div className="text-xs text-green-300 font-semibold mb-1">
                      {product.category}
                    </div>
                    <div className="text-xs text-white line-clamp-2 group-hover:text-green-300 transition-colors">
                      {product.title}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // PRODUCT CLICK - Show clicked product with image
  if (item.type === 'click') {
    return (
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-green-500 transition-all">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{icons[item.type]}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-semibold text-green-400">{labels[item.type]}</span>
              <span className="text-xs text-gray-400">{item.timeAgo}</span>
            </div>
            
            {item.data.product_thumbnail && (
              <img 
                src={item.data.product_thumbnail} 
                alt={item.data.product_title}
                className="w-full max-w-xs h-48 object-cover rounded-lg mb-3 shadow-lg"
              />
            )}
            
            <div className="space-y-2">
              {item.data.item_category && (
                <div className="text-sm">
                  <span className="text-purple-400 font-semibold">{item.data.item_category}:</span>{' '}
                  <span className="text-gray-300">{item.data.item_description}</span>
                </div>
              )}
              <div className="text-sm text-white font-semibold">
                {item.data.product_title}
              </div>
              {item.data.product_link && (
                <a 
                  href={item.data.product_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-blue-400 hover:underline mt-2"
                >
                  View product →
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FEEDBACK - Show detailed feedback
  if (item.type === 'feedback') {
    const isSatisfied = item.data.satisfaction === '만족';
    
    return (
      <div className={`rounded-lg p-5 border transition-all ${
        isSatisfied 
          ? 'bg-green-900/20 border-green-500/50 hover:border-green-400' 
          : 'bg-red-900/20 border-red-500/50 hover:border-red-400'
      }`}>
        <div className="flex items-start gap-4">
          <div className="text-4xl">{isSatisfied ? '😊' : '😞'}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-pink-400">{labels[item.type]}</span>
                <span className={`text-2xl font-bold ${
                  isSatisfied ? 'text-green-400' : 'text-red-400'
                }`}>
                  {item.data.satisfaction}
                </span>
              </div>
              <span className="text-xs text-gray-400">{item.timeAgo}</span>
            </div>
            
            {item.data.comment && (
              <div className="bg-gray-800/60 rounded-lg px-4 py-3 mb-3">
                <div className="text-xs text-gray-400 font-semibold mb-2">💬 Comment:</div>
                <div className="text-sm text-white leading-relaxed">{item.data.comment}</div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              {item.data.result_page_url && (
                <div className="flex items-center gap-1">
                  <span>📄</span>
                  <span>Page: {item.data.result_page_url.split('/').pop()?.replace('.html', '')}</span>
                </div>
              )}
              {item.data.page_load_time && (
                <div className="flex items-center gap-1">
                  <span>⏱️</span>
                  <span>Submitted after {item.data.page_load_time}s</span>
                </div>
              )}
              {item.data.user_agent && (
                <div className="flex items-center gap-1">
                  <span>{item.data.user_agent.includes('Mobile') ? '📱' : '💻'}</span>
                  <span>{item.data.user_agent.includes('Mobile') ? 'Mobile' : 'Desktop'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RESULT VISIT
  if (item.type === 'result_visit') {
    return (
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-blue-500 transition-all">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{icons[item.type]}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-semibold text-blue-400">{labels[item.type]}</span>
              <span className="text-xs text-gray-400">{item.timeAgo}</span>
            </div>
            <div className="text-sm text-gray-300 space-y-1">
              <div>Time on page: <span className="text-white font-semibold">{item.data.time_on_page_seconds || 0} seconds</span></div>
              {item.data.session_hash && (
                <div className="text-xs text-gray-500">Session: {item.data.session_hash.slice(0, 8)}...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // APP VISIT
  if (item.type === 'app_visit') {
    return (
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-cyan-500 transition-all">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{icons[item.type]}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-semibold text-cyan-400">{labels[item.type]}</span>
              <span className="text-xs text-gray-400">{item.timeAgo}</span>
            </div>
            <div className="text-sm text-gray-300 space-y-1">
              <div>Page: <span className="text-white font-mono">{item.data.page_path}</span></div>
              {item.data.user_agent && (
                <div className="text-xs text-gray-500">Device: {item.data.user_agent.includes('Mobile') ? '📱 Mobile' : '💻 Desktop'}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FALLBACK for any other types
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-purple-500 transition-all">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icons[item.type] || '❓'}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">{labels[item.type] || item.type}</span>
            <span className="text-xs text-gray-400">{item.timeAgo}</span>
          </div>
          <div className="text-sm text-gray-400">
            {JSON.stringify(item.data)}
          </div>
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

