import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day ago`;
}

export async function GET() {
  try {
    const activities: any[] = [];
    
    // Exclude owner's phone number, user_id, and sessions from activity feed
    const excludedPhones = ['01090848563', '821090848563'];
    const excludedUserIds = ['fc878118-43dd-4363-93cf-d31e453df81e'];
    const excludedSessions = [
      // Original testing sessions
      'session_1763379288045_ymn5qkcw9',
      'session_1763379158148_0hffdwny3',
      'session_1763379063071_al1men7al',
      'session_1763379090206_irwup98ir',
      'session_1763359911250_3kuzgauqo',
      // Previous testing sessions
      'session_1763380393830_66kq8jdpw',
      'session_1763380388136_3jv92bpos',
      'session_1763380384685_xk587j0t6',
      'session_1763379130537_x071i25r2',
      'session_1763379146775_wg7xsarb4',
      'session_1763379141701_gchc7i99c',
      // Latest testing sessions (result page visits)
      'session_1763381631765_hunjmhga4',
      'session_1763381596010_isl1fsbxl',
      'session_1763381514465_pio5bkxcl',
      'session_1763381397821_606v2vwo2',
      'session_1763380975942_vjbnmc2pe',
      'session_1763380965996_0ztxwo15m',
      'session_1763380960356_cuvhfa5f2',
      'session_1763380957447_i3gs1sko8',
      'session_1763380949069_t92xrq97p',
      'session_1763380946488_hf0hqz9jb',
      'session_1763380943510_4a3h3y54w',
      'session_1763380940180_yhibv3evc',
      'session_1763379068462_pf5iw44ur',
      'session_1763379074246_l9gqzc77f',
      'session_1763379095785_9nm6sn9r2',
      'session_1763379108853_8zvnzuue7',
      'session_1763379116697_0xn4yn3f0',
      // Nov 17 evening testing sessions
      'session_1763387485308_8nsppteyc',
      'session_1763364199414_0mnwdw6y6',
      'session_1763366515564_xaicg5l8g',
      'session_1763122923543_nair7n15h',
      'session_1763122898201_9brucc4o0',
      // Nov 17 late night testing session
      'session_1763396695521_y8l0ggm5e'
    ]; // Owner's testing sessions
    
    // Exclude owner's recent test uploads by filename
    const excludedUploadFiles = [
      'upload_1763381333449_Resized_Screenshot_20251028_112857_Coupang.jpeg'
    ];

    // Get recent product clicks (last 24 hours) with full product details
    const { data: clicks } = await supabase
      .from('link_clicks')
      .select('id, user_id, clicked_at, product_title, product_thumbnail, product_link, item_category, item_description')
      .gte('clicked_at', new Date(Date.now() - 86400000).toISOString())
      .order('clicked_at', { ascending: false })
      .limit(20);

    // Get user phone numbers and result pages for clicks
    if (clicks && clicks.length > 0) {
      const userIds = clicks.map(c => c.user_id).filter(Boolean);
      const { data: users } = await supabase
        .from('users')
        .select('id, phone_number')
        .in('id', userIds);
      
      const userMap = new Map(users?.map(u => [u.id, u.phone_number]) || []);
      
      // Get result pages for these users
      const phones = users?.map(u => u.phone_number) || [];
      const { data: resultPages } = await supabase
        .from('result_page_visits')
        .select('phone_number, result_page_url')
        .in('phone_number', phones);
      
      const resultPageMap = new Map(resultPages?.map(rp => [rp.phone_number, rp.result_page_url]) || []);
      
      clicks.forEach(click => {
        const phone = userMap.get(click.user_id);
        // Show all product clicks (including owner's) for monitoring
        if (phone) {
          activities.push({
            id: `click-${click.id}`,
            type: 'click',
            phone: phone,
            timestamp: click.clicked_at,
            timeAgo: timeAgo(new Date(click.clicked_at)),
            productTitle: click.product_title,
            productThumbnail: click.product_thumbnail,
            productLink: click.product_link,
            itemCategory: click.item_category,
            itemDescription: click.item_description,
            resultPageUrl: resultPageMap.get(phone)
          });
        }
      });
    }

    // Get recent result page visits (last 24 hours) with full details
    const { data: visits } = await supabase
      .from('result_page_visits')
      .select('id, phone_number, visit_timestamp, result_page_url, clicked_products, session_id')
      .gte('visit_timestamp', new Date(Date.now() - 86400000).toISOString())
      .order('visit_timestamp', { ascending: false })
      .limit(50); // Increased to get past testing visits
    
    visits?.forEach(visit => {
      if (!excludedPhones.includes(visit.phone_number) && !excludedSessions.includes(visit.session_id)) {
        activities.push({
          id: `visit-${visit.id}`,
          type: 'visit',
          phone: visit.phone_number,
          timestamp: visit.visit_timestamp,
          timeAgo: timeAgo(new Date(visit.visit_timestamp)),
          resultPageUrl: visit.result_page_url,
          clickedProducts: visit.clicked_products
        });
      }
    });

    // Get recent image uploads from Supabase Storage
    const { data: storageFiles } = await supabase.storage
      .from('images')
      .list('', {
        limit: 50,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    // Filter for recent uploads (last 24h) and get public URLs
    const oneDayAgo = Date.now() - 86400000;
    const recentUploads = storageFiles?.filter(f => {
      const created = new Date(f.created_at).getTime();
      return created > oneDayAgo && f.name.startsWith('upload_');
    }) || [];

    // Get users active in the last 24 hours (by last_active_at OR created_at)
    const { data: recentUsers } = await supabase
      .from('users')
      .select('id, phone_number, created_at, last_active_at')
      .or(`created_at.gte.${new Date(oneDayAgo).toISOString()},last_active_at.gte.${new Date(oneDayAgo).toISOString()}`)
      .order('last_active_at', { ascending: false, nullsFirst: false });

    // Match uploads with users by timestamp (within 5 minutes)
    recentUploads.forEach(file => {
      // Skip if this file is in the exclusion list
      if (excludedUploadFiles.includes(file.name)) {
        return;
      }
      
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(file.name);
      const uploadTime = new Date(file.created_at).getTime();
      
      // Find user active within 5 minutes of upload (check both created_at and last_active_at)
      const matchedUser = recentUsers?.find(user => {
        const userCreateTime = new Date(user.created_at).getTime();
        const userActiveTime = user.last_active_at ? new Date(user.last_active_at).getTime() : userCreateTime;
        return Math.abs(uploadTime - userCreateTime) < 300000 || 
               Math.abs(uploadTime - userActiveTime) < 300000; // Within 5 minutes
      });
      
      if (matchedUser) {
        // Show all uploads (including owner's) - important for monitoring
        // Owner's test visits to result pages are still filtered elsewhere
        activities.push({
          id: `upload-${file.name}`,
          type: 'upload',
          phone: matchedUser.phone_number,
          timestamp: file.created_at,
          timeAgo: timeAgo(new Date(file.created_at)),
          uploadedImageUrl: publicUrl,
          isAnonymous: false
        });
      } else {
        // No matching user - show as anonymous (user still in progress)
        activities.push({
          id: `upload-${file.name}`,
          type: 'upload',
          phone: 'In Progress',
          timestamp: file.created_at,
          timeAgo: timeAgo(new Date(file.created_at)),
          uploadedImageUrl: publicUrl,
          isAnonymous: true
        });
      }
    });

    // Get recent "results viewed" events from events table (final_results_displayed)
    // This shows what users ACTUALLY saw, including fallback products
    const { data: resultEvents } = await supabase
      .from('events')
      .select('id, session_id, created_at, event_data')
      .eq('event_type', 'final_results_displayed')
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Get all recent users to match by timestamp (active OR created in last 24h)
    const { data: allRecentUsers } = await supabase
      .from('users')
      .select('id, phone_number, created_at, last_active_at')
      .or(`created_at.gte.${new Date(Date.now() - 86400000).toISOString()},last_active_at.gte.${new Date(Date.now() - 86400000).toISOString()}`)
      .order('last_active_at', { ascending: false, nullsFirst: false });

    // Group events by user to count searches per user
    const userSearchCounts = new Map<string, number>();
    const userEventMap = new Map<string, any[]>();

    // First pass: match all events to users and count
    resultEvents?.forEach(event => {
      const eventTime = new Date(event.created_at).getTime();
      const matchedUser = allRecentUsers?.find(user => {
        const userCreateTime = new Date(user.created_at).getTime();
        const userActiveTime = new Date(user.last_active_at).getTime();
        // Within 5 minutes of user creation or last active
        return Math.abs(eventTime - userCreateTime) < 300000 || 
               Math.abs(eventTime - userActiveTime) < 300000;
      });
      
      if (matchedUser) {
        const phone = matchedUser.phone_number;
        if (!userEventMap.has(phone)) {
          userEventMap.set(phone, []);
        }
        userEventMap.get(phone)!.push({ event, user: matchedUser });
      }
    });

    // Second pass: create activities with search numbers
    userEventMap.forEach((userEvents, phone) => {
      // Sort events chronologically for this user
      userEvents.sort((a, b) => 
        new Date(a.event.created_at).getTime() - new Date(b.event.created_at).getTime()
      );
      
      const totalSearches = userEvents.length;
      
      userEvents.forEach((item, searchIndex) => {
        const event = item.event;
        const matchedUser = item.user;
        
        // Show all search results (including owner's) for monitoring
        // Only result page visits are filtered to reduce testing noise
        
        const eventData = event.event_data as any;
        const displayedProducts = eventData?.displayedProducts || {};
        const summary = eventData?.summary || {};
        const categories = Object.keys(displayedProducts);
        
        // Skip if no categories
        if (categories.length === 0) return;
        
        // Extract category details with fallback information
        const itemDetails = categories.map(categoryKey => {
          const category = displayedProducts[categoryKey];
          return {
            category: categoryKey,
            productCount: category.count || 0,
            source: category.source || 'unknown', // 'gpt' or 'fallback'
            products: category.products || []
          };
        });
        
        // Flatten all products for easy display with source info
        const allProducts = categories.flatMap(categoryKey => {
          const category = displayedProducts[categoryKey];
          return (category.products || []).map((p: any) => ({
            title: p.title,
            link: p.link,
            thumbnail: p.thumbnail,
            category: categoryKey,
            source: category.source, // 'gpt' or 'fallback'
            position: p.position
          }));
        });
        
        activities.push({
          id: `results-${event.id}`,
          type: 'results',
          phone: phone,
          timestamp: event.created_at,
          timeAgo: timeAgo(new Date(event.created_at)),
          itemsDetected: categories.length,
          itemDetails: itemDetails,
          allProducts: allProducts,
          totalProducts: summary.totalProducts || allProducts.length,
          gptProducts: summary.gptProducts || 0,
          fallbackProducts: summary.fallbackProducts || 0,
          categoriesWithFallback: summary.categoriesWithFallback || 0,
          sourceCounts: eventData?.sourceCounts,
          searchNumber: searchIndex + 1,
          totalSearches: totalSearches
        });
      });
    });

    // Get recent feedback (last 24 hours)
    const { data: feedbacks } = await supabase
      .from('user_feedback')
      .select('id, phone_number, created_at')
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    feedbacks?.forEach(feedback => {
      if (!excludedPhones.includes(feedback.phone_number)) {
        activities.push({
          id: `feedback-${feedback.id}`,
          type: 'feedback',
          phone: feedback.phone_number,
          timestamp: feedback.created_at,
          timeAgo: timeAgo(new Date(feedback.created_at))
        });
      }
    });

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Return top 40 most recent with no-cache headers
    return NextResponse.json(activities.slice(0, 40), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Live activity error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live activity' },
      { status: 500 }
    );
  }
}

