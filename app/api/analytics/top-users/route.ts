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
    const excludedUserId = 'fc878118-43dd-4363-93cf-d31e453df81e';
    
    // Get all users with their clicks and page visits
    const { data: users } = await supabase
      .from('users')
      .select(`
        id,
        phone_number,
        conversion_source
      `)
      .not('phone_number', 'in', `(${excludedPhones.join(',')})`)
      .neq('id', excludedUserId);

    if (!users) {
      return NextResponse.json([]);
    }

    // Get clicks for each user
    const { data: clicks } = await supabase
      .from('link_clicks')
      .select('user_id, id');

    // Get app page visits for each user
    const { data: pageVisits } = await supabase
      .from('app_page_visits')
      .select('user_id, time_on_page_seconds');

    // Get batch result page time
    const { data: batchVisits } = await supabase
      .from('result_page_visits')
      .select('phone_number, time_on_page_seconds');

    // Aggregate data
    const userMetrics = users.map(user => {
      // Count clicks
      const userClicks = clicks?.filter(c => c.user_id === user.id).length || 0;

      // Sum app time
      const appTime = pageVisits
        ?.filter(pv => pv.user_id === user.id)
        .reduce((sum, pv) => sum + (pv.time_on_page_seconds || 0), 0) || 0;

      // Get batch time (normalize phone for comparison)
      const normalizePhone = (phone: string) => {
        if (phone.startsWith('82')) return '0' + phone.substring(2);
        return phone;
      };

      const normalizedUserPhone = normalizePhone(user.phone_number);
      const batchTime = batchVisits
        ?.filter(bv => normalizePhone(bv.phone_number) === normalizedUserPhone)
        .reduce((max, bv) => Math.max(max, bv.time_on_page_seconds || 0), 0) || 0;

      // Get source icon
      const sourceMap: Record<string, string> = {
        'colleague': '💼 Colleague',
        'batch_interview': '🎤 Interview',
        'batch_button_click': '🔘 Button',
        'organic': '🌱 Organic'
      };

      return {
        phone: user.phone_number,
        source: sourceMap[user.conversion_source || 'organic'] || user.conversion_source,
        productClicks: userClicks,
        appTime: Math.round(appTime / 60), // Convert to minutes
        batchTime,
        score: userClicks // Score is now just clicks for backwards compatibility
      };
    });

    // Sort by product clicks and return top 10
    const topUsers = userMetrics
      .sort((a, b) => b.productClicks - a.productClicks)
      .slice(0, 10);

    return NextResponse.json(topUsers);
  } catch (error) {
    console.error('Top users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top users' },
      { status: 500 }
    );
  }
}

