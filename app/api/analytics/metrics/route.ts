import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize phone numbers
function normalizePhone(phone: string): string {
  if (phone.startsWith('82')) {
    return '0' + phone.substring(2);
  }
  return phone;
}

export async function GET() {
  try {
    // Get batch SMS metrics
    const { data: batchVisits } = await supabase
      .from('result_page_visits')
      .select('phone_number, time_on_page_seconds');

    // Get users
    const { data: users } = await supabase
      .from('users')
      .select('phone_number, conversion_source');

    // Get feedback
    const { data: feedback } = await supabase
      .from('user_feedback')
      .select('phone_number');

    // Get activity in the last 24 hours (instead of "today" to avoid timezone issues)
    const last24Hours = new Date(Date.now() - 86400000).toISOString();
    
    // Get batch result page visits in last 24h
    const { data: todayBatchVisits } = await supabase
      .from('result_page_visits')
      .select('phone_number')
      .gte('visit_timestamp', last24Hours);
    
    // Get app page visits in last 24h
    const { data: todayAppVisits } = await supabase
      .from('app_page_visits')
      .select('user_id')
      .gte('visit_timestamp', last24Hours);
    
    // Get product clicks in last 24h
    const { data: todayClicks } = await supabase
      .from('link_clicks')
      .select('user_id')
      .gte('clicked_at', last24Hours);

    // Calculate metrics
    const batchSMSSent = 116; // Your total
    const linksVisited = batchVisits?.length || 0;
    
    // Count converts (batch_interview + batch_button_click)
    const converts = users?.filter(
      u => u.conversion_source === 'batch_interview' || 
           u.conversion_source === 'batch_button_click'
    ).length || 0;

    const conversionRate = ((converts / linksVisited) * 100).toFixed(1);
    
    // Normalize phone numbers for comparison
    const normalizedBatchPhones = new Set(
      batchVisits?.map(v => normalizePhone(v.phone_number)) || []
    );
    
    const feedbackCount = feedback?.filter(f => 
      normalizedBatchPhones.has(normalizePhone(f.phone_number))
    ).length || 0;
    
    const feedbackRate = ((feedbackCount / linksVisited) * 100).toFixed(1);

    // Count unique active users in last 24h (from all sources)
    const activeUserIds = new Set<string>();
    todayAppVisits?.forEach(v => v.user_id && activeUserIds.add(v.user_id));
    todayClicks?.forEach(c => c.user_id && activeUserIds.add(c.user_id));
    
    // Also count batch visitors by phone
    const activeBatchPhones = new Set(todayBatchVisits?.map(v => v.phone_number) || []);
    
    const activeUsersNow = activeUserIds.size + activeBatchPhones.size;
    const todayVisitsCount = (todayBatchVisits?.length || 0) + (todayAppVisits?.length || 0);

    return NextResponse.json({
      batchSMSSent,
      linksVisited,
      converts,
      conversionRate: parseFloat(conversionRate),
      feedbackRate: parseFloat(feedbackRate),
      activeUsersNow,
      todayVisits: todayVisitsCount
    });
  } catch (error) {
    console.error('Analytics metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

