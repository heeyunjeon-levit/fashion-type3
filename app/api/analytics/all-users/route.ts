import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Exclude owner's phone numbers
    const excludedPhones = ['01090848563', '821090848563'];

    // Get all users
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .order('last_active_at', { ascending: false });

    if (!users) {
      return NextResponse.json([]);
    }

    // Filter out excluded users
    const filteredUsers = users.filter(u => 
      !excludedPhones.includes(u.phone_number) &&
      u.id !== 'fc878118-43dd-4363-93cf-d31e453df81e'
    );

    // NOTE: Supabase has a 1000 row limit that cannot be bypassed with limit() or range()
    // So we fetch data PER USER instead of fetching all data and filtering

    // Build summary for each user by querying their specific data
    const usersSummary = await Promise.all(filteredUsers.map(async (user) => {
      // Get sessions for this specific user
      const { data: userSessions } = await supabase
        .from('sessions')
        .select('*')
        .or(`phone_number.eq.${user.phone_number},user_id.eq.${user.id}`);
      
      // IMPORTANT: events.session_id references sessions.id (UUID), NOT sessions.session_id (TEXT)!
      const sessionUUIDs = (userSessions || []).map(s => s.id);

      // Count uploads from sessions table (most reliable)
      const uploadsFromSessions = (userSessions || []).filter(s => s.uploaded_image_url).length;

      // Get events for this user (by user_id OR by session UUID)
      let userEvents;
      if (sessionUUIDs.length > 0) {
        // Has sessions: match by user_id OR session UUID
        const { data } = await supabase
          .from('events')
          .select('*')
          .or(`user_id.eq.${user.id},session_id.in.(${sessionUUIDs.join(',')})`);
        userEvents = data;
      } else {
        // No sessions: only match by user_id
        const { data } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id);
        userEvents = data;
      }

      // Count uploads from events
      // Count ONLY original uploads (not cropped images)
      const uploadsFromEvents = (userEvents || []).filter(e => 
        e.event_type === 'image_upload'
      ).length;

      const uploads = Math.max(uploadsFromEvents, uploadsFromSessions);

      // Count searches from events
      const searches = (userEvents || []).filter(e => 
        e.event_type === 'gpt_product_selection' || 
        e.event_type === 'final_results_displayed' ||
        e.event_type === 'items_selected'
      ).length;

      // Get clicks for this user
      let userClicks;
      if (sessionUUIDs.length > 0) {
        const { data } = await supabase
          .from('link_clicks')
          .select('*')
          .or(`user_id.eq.${user.id},session_id.in.(${sessionUUIDs.join(',')})`);
        userClicks = data;
      } else {
        const { data } = await supabase
          .from('link_clicks')
          .select('*')
          .eq('user_id', user.id);
        userClicks = data;
      }
      
      const clicks = userClicks?.length || 0;

      // Get visits
      const { data: resultVisits } = await supabase
        .from('result_page_visits')
        .select('*')
        .eq('phone_number', user.phone_number);
      
      const { data: appVisits } = await supabase
        .from('app_page_visits')
        .select('*')
        .eq('user_phone', user.phone_number);

      // Get feedback
      const { data: userFeedback } = await supabase
        .from('user_feedback')
        .select('*')
        .eq('phone_number', user.phone_number);
      
      const hasPositiveFeedback = (userFeedback || []).some(f => f.satisfaction === '만족');
      const hasNegativeFeedback = (userFeedback || []).some(f => f.satisfaction === '불만족');
      const feedbackSatisfaction = hasPositiveFeedback ? '만족' : hasNegativeFeedback ? '불만족' : undefined;

      // Use users.total_searches as source of truth (handles legacy users before event logging)
      const totalSearches = Math.max(user.total_searches || 0, searches);
      
      return {
        phone: user.phone_number,
        created_at: user.created_at,
        last_active_at: user.last_active_at,
        conversion_source: user.conversion_source,
        total_searches: totalSearches,
        total_uploads: uploads,
        total_clicks: clicks,
        total_visits: (resultVisits?.length || 0) + (appVisits?.length || 0),
        total_feedback: userFeedback?.length || 0,
        feedback_satisfaction: feedbackSatisfaction,
        journey: {
          uploads,
          searches: totalSearches,
          clicks,
          feedback: userFeedback?.length || 0,
          hasPositiveFeedback,
          hasNegativeFeedback
        }
      };
    }));

    return NextResponse.json(usersSummary);
  } catch (error) {
    console.error('All users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

