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

// Normalize phone number (remove leading 0 for consistency)
function normalizePhone(phone: string): string {
  if (!phone) return phone;
  return phone.startsWith('0') ? phone.substring(1) : phone;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phoneParam = searchParams.get('phone');

    if (!phoneParam) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    // Normalize the phone number
    const phone = normalizePhone(phoneParam);

    // Exclude owner's phone numbers from search (check all variants)
    const excludedPhones = ['01090848563', '821090848563', '1090848563'];
    if (excludedPhones.includes(phone) || excludedPhones.includes(phoneParam)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Generate phone variants for querying (with and without leading 0)
    const phoneVariants = [
      phone,
      phone.startsWith('0') ? phone : '0' + phone,
      phone.startsWith('0') ? phone.substring(1) : phone
    ];

    // Get user info (may not exist for batch users who only visited result page)
    // Check all phone variants
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .in('phone_number', phoneVariants)
      .maybeSingle();

    // Double-check user ID exclusion
    const excludedUserIds = ['fc878118-43dd-4363-93cf-d31e453df81e'];
    if (existingUser && excludedUserIds.includes(existingUser.id)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create synthetic batch user if doesn't exist in users table
    let user = existingUser;
    
    if (!user) {
      // Batch user - hasn't used main app yet, but may have visited result page or given feedback
      const { data: firstVisit } = await supabase
        .from('result_page_visits')
        .select('*')
        .in('phone_number', phoneVariants)
        .order('visit_timestamp', { ascending: true })
        .limit(1)
        .single();
      
      const { data: firstFeedback } = await supabase
        .from('user_feedback')
        .select('*')
        .in('phone_number', phoneVariants)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      
      const firstActivity = firstVisit?.visit_timestamp || firstFeedback?.created_at;
      
      if (!firstActivity) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Create synthetic user object
      user = {
        id: `batch_${phone}`,
        phone_number: phone,
        created_at: firstActivity,
        last_active_at: firstActivity,
        total_searches: 0,
        conversion_source: null,
        country_code: null
      };
    }

    // Get sessions for this user first (primary source)
    // Check all phone variants to catch sessions with different formats
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .or(`phone_number.in.(${phoneVariants.join(',')}),user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    // Get session UUIDs (events.session_id references sessions.id, NOT sessions.session_id!)
    const sessionUUIDs = sessions?.map(s => s.id) || [];

    // Get events for this user (match by user_id OR session UUID)
    // For batch users (synthetic ID), only match by sessions
    const isBatchUser = user.id.toString().startsWith('batch_');
    
    let userEvents: any[] = [];
    
    if (isBatchUser) {
      // Batch user - only get events from their sessions (if any)
      if (sessionUUIDs.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('*')
          .in('session_id', sessionUUIDs)
          .order('created_at', { ascending: false});
        userEvents = data || [];
      }
    } else {
      // Real user - match by user_id OR session UUID
      const { data: allUserEvents } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false});

      // Filter events that belong to this user (by user_id or session UUID)
      userEvents = allUserEvents?.filter(e => 
        e.user_id === user.id || sessionUUIDs.includes(e.session_id)
      ) || [];
    }

    // Get product clicks ONLY from sessions matching this phone number
    // Don't match by user_id alone - that would include clicks from other phone numbers
    let clicks: any[] = [];
    if (sessionUUIDs.length > 0) {
      const { data } = await supabase
        .from('link_clicks')
        .select('*')
        .in('session_id', sessionUUIDs)
        .order('clicked_at', { ascending: false });
      clicks = data || [];
    }

    // Get result page visits
    const { data: resultVisits } = await supabase
      .from('result_page_visits')
      .select('*')
      .in('phone_number', phoneVariants)
      .order('visit_timestamp', { ascending: false });

    // Get app page visits
    const { data: appVisits } = await supabase
      .from('app_page_visits')
      .select('*')
      .in('user_phone', phoneVariants)
      .order('visit_timestamp', { ascending: false });

    // Get feedback
    const { data: feedback } = await supabase
      .from('user_feedback')
      .select('*')
      .in('phone_number', phoneVariants)
      .order('created_at', { ascending: false });

    // Get ONLY original image uploads (not cropped images)
    // Only from image_upload events and sessions table
    const uploadEvents = userEvents?.filter(e => e.event_type === 'image_upload') || [];
    const uploads = uploadEvents.map(e => ({
      url: e.event_data?.imageUrl || '',
      created_at: e.created_at
    }));

    // Also add uploads from sessions table (original uploaded image)
    sessions?.forEach(session => {
      if (session.uploaded_image_url && session.uploaded_at) {
        // Check if this image isn't already in uploads (avoid duplicates)
        const alreadyExists = uploads.some(u => u.url === session.uploaded_image_url);
        if (!alreadyExists) {
          uploads.push({
            url: session.uploaded_image_url,
            created_at: session.uploaded_at
          });
        }
      }
    });

    // NOTE: We intentionally DON'T include cropped images from items_cropped or items_selected
    // Those are internal system artifacts, not user uploads

    // Extract GPT product selections (what GPT selected)
    const gptSelections: any[] = [];
    
    // Pattern 1: gpt_product_selection events (has reasoning with selectedLinks)
    (userEvents || [])
      .filter(e => e.event_type === 'gpt_product_selection')
      .forEach(e => {
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

        gptSelections.push({
          id: e.id,
          created_at: e.created_at,
          timeAgo: timeAgo(new Date(e.created_at)),
          itemsDetected: items.length,
          itemDetails,
          totalProducts: itemDetails.reduce((sum, item) => sum + item.productCount, 0),
          source: 'gpt_selection'
        });
      });
    
    // Pattern 2: items_selected events (has items array with category/description)
    (userEvents || [])
      .filter(e => e.event_type === 'items_selected')
      .forEach(e => {
        const items = e.event_data?.items || [];
        if (items.length > 0) {
          const itemDetails = items.map((item: any) => ({
            category: item.category || 'unknown',
            description: item.description || 'unknown item',
            productCount: 0, // items_selected doesn't have product links yet
            products: []
          }));

          gptSelections.push({
            id: e.id,
            created_at: e.created_at,
            timeAgo: timeAgo(new Date(e.created_at)),
            itemsDetected: items.length,
            itemDetails,
            totalProducts: 0,
            source: 'items_selected'
          });
        }
      });

    // Extract FINAL RESULTS DISPLAYED (what user actually saw, including fallback)
    const finalResults = (userEvents || [])
      .filter(e => e.event_type === 'final_results_displayed')
      .map(e => {
        const displayed = e.event_data.displayedProducts || {};
        const summary = e.event_data.summary || {};
        const categories = Object.keys(displayed);
        const categoryDetails = categories.map(categoryKey => {
          const category = displayed[categoryKey];
          return {
            category: categoryKey,
            productCount: category.count || 0,
            source: category.source || 'unknown', // 'gpt' or 'fallback'
            products: (category.products || []).map((p: any) => ({
              position: p.position,
              title: p.title,
              link: p.link,
              thumbnail: p.thumbnail
            }))
          };
        });

        return {
          id: e.id,
          created_at: e.created_at,
          timeAgo: timeAgo(new Date(e.created_at)),
          totalProducts: summary.totalProducts || 0,
          gptProducts: summary.gptProducts || 0,
          fallbackProducts: summary.fallbackProducts || 0,
          categoriesWithFallback: summary.categoriesWithFallback || 0,
          categoryDetails,
          source: 'final_displayed'
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

    // Add searches (GPT selections - what GPT filtered)
    gptSelections.forEach(search => {
      timeline.push({
        type: 'search',
        timestamp: search.created_at,
        timeAgo: search.timeAgo,
        data: search
      });
    });

    // Add final results displayed (what user actually saw, including fallback)
    finalResults.forEach(result => {
      timeline.push({
        type: 'final_results',
        timestamp: result.created_at,
        timeAgo: result.timeAgo,
        data: result
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

