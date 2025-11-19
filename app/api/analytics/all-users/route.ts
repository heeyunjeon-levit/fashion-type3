import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize phone number (remove leading 0 for consistency)
function normalizePhone(phone: string): string {
  if (!phone) return phone;
  // Remove leading 0 if present (Korean numbers)
  return phone.startsWith('0') ? phone.substring(1) : phone;
}

export async function GET() {
  try {
    // Exclude owner's phone numbers
    const excludedPhones = ['01090848563', '821090848563', '1090848563'];

    // Get all users from users table
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .order('last_active_at', { ascending: false });

    // ALSO get batch users (from result_page_visits and user_feedback)
    const { data: resultVisits } = await supabase
      .from('result_page_visits')
      .select('phone_number, visit_timestamp')
      .order('visit_timestamp', { ascending: false });

    const { data: feedbacks } = await supabase
      .from('user_feedback')
      .select('phone_number, created_at')
      .order('created_at', { ascending: false });

    // Collect all unique phone numbers (users + batch users)
    // Use normalized phone numbers to prevent duplicates (01XXX vs 1XXX)
    const allPhoneNumbers = new Set<string>();
    const phoneToOriginal = new Map<string, string>(); // normalized -> first original seen
    
    // Add users from users table
    users?.forEach(u => {
      const normalized = normalizePhone(u.phone_number);
      if (!phoneToOriginal.has(normalized)) {
        phoneToOriginal.set(normalized, u.phone_number);
      }
      allPhoneNumbers.add(normalized);
    });
    
    // Add batch users from result_page_visits
    resultVisits?.forEach(v => {
      if (v.phone_number) {
        const normalized = normalizePhone(v.phone_number);
        if (!excludedPhones.includes(normalized) && !excludedPhones.includes(v.phone_number)) {
          if (!phoneToOriginal.has(normalized)) {
            phoneToOriginal.set(normalized, v.phone_number);
          }
          allPhoneNumbers.add(normalized);
        }
      }
    });
    
    // Add batch users from user_feedback
    feedbacks?.forEach(f => {
      if (f.phone_number) {
        const normalized = normalizePhone(f.phone_number);
        if (!excludedPhones.includes(normalized) && !excludedPhones.includes(f.phone_number)) {
          if (!phoneToOriginal.has(normalized)) {
            phoneToOriginal.set(normalized, f.phone_number);
          }
          allPhoneNumbers.add(normalized);
        }
      }
    });

    // Create user objects for all phone numbers (using normalized numbers)
    const allUsers = Array.from(allPhoneNumbers).map(normalizedPhone => {
      // Find existing user by normalized OR original phone number
      const existingUser = users?.find(u => 
        normalizePhone(u.phone_number) === normalizedPhone
      );
      
      if (existingUser) {
        // Return with normalized phone for consistency
        return {
          ...existingUser,
          phone_number: normalizedPhone
        };
      }
      
      // Synthetic batch user (hasn't used main app yet)
      // Check with both normalized and original versions
      const originalPhone = phoneToOriginal.get(normalizedPhone) || normalizedPhone;
      const firstVisit = resultVisits?.find(v => 
        normalizePhone(v.phone_number) === normalizedPhone
      );
      const firstFeedback = feedbacks?.find(f => 
        normalizePhone(f.phone_number) === normalizedPhone
      );
      const firstActivity = firstVisit?.visit_timestamp || firstFeedback?.created_at || new Date().toISOString();
      
      return {
        id: `batch_${normalizedPhone}`, // Synthetic ID
        phone_number: normalizedPhone, // Use normalized
        created_at: firstActivity,
        last_active_at: firstActivity,
        total_searches: 0,
        conversion_source: null,
        country_code: null
      };
    });

    // Filter out excluded users
    const filteredUsers = allUsers.filter(u => 
      !excludedPhones.includes(u.phone_number) &&
      u.id !== 'fc878118-43dd-4363-93cf-d31e453df81e'
    );

    // NOTE: Supabase has a 1000 row limit that cannot be bypassed with limit() or range()
    // So we fetch data PER USER instead of fetching all data and filtering

    // Build summary for each user by querying their specific data
    const usersSummary = await Promise.all(filteredUsers.map(async (user) => {
      // Get sessions for this specific user (check both normalized and with leading 0)
      const phoneVariants = [
        user.phone_number,
        user.phone_number.startsWith('0') ? user.phone_number : '0' + user.phone_number,
        user.phone_number.startsWith('0') ? user.phone_number.substring(1) : user.phone_number
      ];
      
      const { data: userSessions } = await supabase
        .from('sessions')
        .select('*')
        .or(`phone_number.in.(${phoneVariants.join(',')}),user_id.eq.${user.id}`);
      
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
      
      // Calculate ACTUAL last activity timestamp from all sources
      const activityTimestamps: number[] = [];
      
      // Add user's last_active_at
      if (user.last_active_at) {
        activityTimestamps.push(new Date(user.last_active_at).getTime());
      }
      
      // Add session uploads
      (userSessions || []).forEach(s => {
        if (s.uploaded_at) activityTimestamps.push(new Date(s.uploaded_at).getTime());
        if (s.created_at) activityTimestamps.push(new Date(s.created_at).getTime());
      });
      
      // Add events
      (userEvents || []).forEach(e => {
        if (e.created_at) activityTimestamps.push(new Date(e.created_at).getTime());
      });
      
      // Add clicks
      (userClicks || []).forEach(c => {
        if (c.clicked_at) activityTimestamps.push(new Date(c.clicked_at).getTime());
      });
      
      // Add visits
      (resultVisits || []).forEach(v => {
        if (v.visit_timestamp) activityTimestamps.push(new Date(v.visit_timestamp).getTime());
      });
      (appVisits || []).forEach(v => {
        if (v.visit_timestamp) activityTimestamps.push(new Date(v.visit_timestamp).getTime());
      });
      
      // Add feedback
      (userFeedback || []).forEach(f => {
        if (f.created_at) activityTimestamps.push(new Date(f.created_at).getTime());
      });
      
      // Get the most recent timestamp
      const mostRecentActivity = activityTimestamps.length > 0 
        ? new Date(Math.max(...activityTimestamps)).toISOString()
        : user.last_active_at || user.created_at;
      
      return {
        phone: user.phone_number,
        created_at: user.created_at,
        last_active_at: mostRecentActivity, // Now uses actual most recent activity!
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

