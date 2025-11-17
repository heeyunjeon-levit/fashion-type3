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
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    // Exclude owner's phone numbers from search
    const excludedPhones = ['01090848563', '821090848563'];
    if (excludedPhones.includes(phone)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Double-check user ID exclusion
    const excludedUserIds = ['fc878118-43dd-4363-93cf-d31e453df81e'];
    if (excludedUserIds.includes(user.id)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all events for this user
    const userCreateTime = new Date(user.created_at).getTime();
    const { data: allEvents } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    // Match events by timestamp (within 5 minutes of user creation or activity)
    const userEvents = allEvents?.filter(e => {
      const eventTime = new Date(e.created_at).getTime();
      return Math.abs(eventTime - userCreateTime) < 300000 || 
             Math.abs(eventTime - new Date(user.last_active_at).getTime()) < 300000;
    }) || [];

    // Get all product clicks
    const { data: clicks } = await supabase
      .from('link_clicks')
      .select('*')
      .eq('user_id', user.id)
      .order('clicked_at', { ascending: false });

    // Get result page visits
    const { data: resultVisits } = await supabase
      .from('result_page_visits')
      .select('*')
      .eq('phone_number', phone)
      .order('visit_timestamp', { ascending: false });

    // Get app page visits
    const { data: appVisits } = await supabase
      .from('app_page_visits')
      .select('*')
      .eq('user_phone', phone)
      .order('visit_timestamp', { ascending: false });

    // Get feedback
    const { data: feedback } = await supabase
      .from('user_feedback')
      .select('*')
      .eq('phone_number', phone)
      .order('created_at', { ascending: false });

    // Get image uploads from events table
    const uploadEvents = userEvents.filter(e => e.event_type === 'image_upload');
    const uploads = uploadEvents.map(e => ({
      url: e.event_data?.imageUrl || '',
      created_at: e.created_at
    }));

    // Extract GPT product selections
    const gptSelections = userEvents
      .filter(e => e.event_type === 'gpt_product_selection')
      .map(e => {
        const reasoning = e.event_data.reasoning || {};
        const items = Object.keys(reasoning);
        const itemDetails = items.map(itemKey => {
          const item = reasoning[itemKey];
          return {
            category: itemKey,
            description: item.itemDescription || 'unknown item',
            productCount: item.selectedLinks?.length || 0,
            products: (item.selectedLinks || []).map((link: any) => ({
              title: link.title,
              link: link.link,
              thumbnail: link.thumbnail
            }))
          };
        });

        return {
          id: e.id,
          created_at: e.created_at,
          timeAgo: timeAgo(new Date(e.created_at)),
          itemsDetected: items.length,
          itemDetails,
          totalProducts: itemDetails.reduce((sum, item) => sum + item.productCount, 0)
        };
      });

    // Build complete timeline
    const timeline: any[] = [];

    // Add uploads
    uploads.forEach(upload => {
      timeline.push({
        type: 'upload',
        timestamp: upload.created_at,
        timeAgo: timeAgo(new Date(upload.created_at)),
        data: upload
      });
    });

    // Add searches
    gptSelections.forEach(search => {
      timeline.push({
        type: 'search',
        timestamp: search.created_at,
        timeAgo: search.timeAgo,
        data: search
      });
    });

    // Add clicks
    clicks?.forEach(click => {
      timeline.push({
        type: 'click',
        timestamp: click.clicked_at,
        timeAgo: timeAgo(new Date(click.clicked_at)),
        data: click
      });
    });

    // Add result visits
    resultVisits?.forEach(visit => {
      timeline.push({
        type: 'result_visit',
        timestamp: visit.visit_timestamp,
        timeAgo: timeAgo(new Date(visit.visit_timestamp)),
        data: visit
      });
    });

    // Add app visits
    appVisits?.forEach(visit => {
      timeline.push({
        type: 'app_visit',
        timestamp: visit.visit_timestamp,
        timeAgo: timeAgo(new Date(visit.visit_timestamp)),
        data: visit
      });
    });

    // Add feedback
    feedback?.forEach(fb => {
      timeline.push({
        type: 'feedback',
        timestamp: fb.created_at,
        timeAgo: timeAgo(new Date(fb.created_at)),
        data: fb
      });
    });

    // Sort timeline chronologically (most recent first)
    timeline.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      user: {
        phone: user.phone_number,
        created_at: user.created_at,
        last_active_at: user.last_active_at,
        total_searches: user.total_searches,
        conversion_source: user.conversion_source,
        notes: user.notes
      },
      stats: {
        total_uploads: uploads.length,
        total_searches: gptSelections.length,
        total_clicks: clicks?.length || 0,
        total_result_visits: resultVisits?.length || 0,
        total_app_visits: appVisits?.length || 0,
        total_feedback: feedback?.length || 0
      },
      timeline
    });
  } catch (error) {
    console.error('User journey error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user journey' },
      { status: 500 }
    );
  }
}

