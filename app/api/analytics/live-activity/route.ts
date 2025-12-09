import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

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

    // Get recent image uploads directly from sessions table (MUCH MORE RELIABLE)
    // This uses actual database relationships instead of timestamp guessing
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('uploaded_image_url, uploaded_at, phone_number, user_id, session_id')
      .not('uploaded_image_url', 'is', null)
      .not('uploaded_at', 'is', null)
      .gte('uploaded_at', oneDayAgo)
      .order('uploaded_at', { ascending: false })
      .limit(50);

    // Get user phone numbers for sessions that don't have phone_number yet
    const sessionsNeedingPhone = recentSessions?.filter(s => !s.phone_number && s.user_id) || [];
    let userPhoneMap = new Map<string, string>();
    
    if (sessionsNeedingPhone.length > 0) {
      const userIds = [...new Set(sessionsNeedingPhone.map(s => s.user_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, phone_number')
        .in('id', userIds);
      
      userPhoneMap = new Map(users?.map(u => [u.id, u.phone_number]) || []);
    }

    // Add uploads from sessions
    recentSessions?.forEach(session => {
      // Get phone from session or user
      const phone = session.phone_number || (session.user_id ? userPhoneMap.get(session.user_id) : null);
      
      // Skip excluded sessions and phones
      if (excludedSessions.includes(session.session_id) || (phone && excludedPhones.includes(phone))) {
        return;
      }
      
      activities.push({
        id: `upload-${session.session_id}`,
        type: 'upload',
        phone: phone || 'In Progress',
        timestamp: session.uploaded_at,
        timeAgo: timeAgo(new Date(session.uploaded_at)),
        uploadedImageUrl: session.uploaded_image_url,
        isAnonymous: !phone
      });
    });

    // Get recent "results viewed" events from events table (final_results_displayed)
    // This shows what users ACTUALLY saw, including fallback products
    // Use user_id directly instead of timestamp matching!
    const { data: resultEvents } = await supabase
      .from('events')
      .select('id, session_id, created_at, event_data, user_id')
      .eq('event_type', 'final_results_displayed')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(100);

    // Get user phone numbers for all result events
    const resultUserIds = [...new Set(resultEvents?.map(e => e.user_id).filter(Boolean) || [])];
    const resultSessionIds = [...new Set(resultEvents?.map(e => e.session_id).filter(Boolean) || [])];
    
    let resultUserPhoneMap = new Map<string, string>();
    let resultSessionPhoneMap = new Map<string, string>();
    
    // Get phones from users table
    if (resultUserIds.length > 0) {
      const { data: resultUsers } = await supabase
        .from('users')
        .select('id, phone_number')
        .in('id', resultUserIds);
      
      resultUserPhoneMap = new Map(resultUsers?.map(u => [u.id, u.phone_number]) || []);
    }
    
    // Get phones from sessions table (fallback for events without user_id)
    if (resultSessionIds.length > 0) {
      const { data: resultSessions } = await supabase
        .from('sessions')
        .select('id, phone_number')
        .in('id', resultSessionIds)
        .not('phone_number', 'is', null);
      
      resultSessionPhoneMap = new Map(resultSessions?.map(s => [s.id, s.phone_number]) || []);
    }

    // Group events by user phone to count searches per user
    const userEventMap = new Map<string, any[]>();

    // Match all events to phone numbers using actual relationships
    resultEvents?.forEach(event => {
      // Try to get phone from user_id first, then session_id
      const phone = event.user_id ? resultUserPhoneMap.get(event.user_id) : 
                    event.session_id ? resultSessionPhoneMap.get(event.session_id) : null;
      
      if (phone) {
        if (!userEventMap.has(phone)) {
          userEventMap.set(phone, []);
        }
        userEventMap.get(phone)!.push(event);
      }
    });

    // Second pass: create activities with search numbers
    userEventMap.forEach((userEvents, phone) => {
      // Skip excluded phones
      if (excludedPhones.includes(phone)) return;
      
      // Sort events chronologically for this user
      userEvents.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      const totalSearches = userEvents.length;
      
      userEvents.forEach((event, searchIndex) => {
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

