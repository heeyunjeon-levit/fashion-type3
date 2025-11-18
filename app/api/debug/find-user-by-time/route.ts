import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp'); // e.g., "2025-11-18T07:47:02.513Z"

    if (!timestamp) {
      return NextResponse.json({ error: 'Timestamp required' }, { status: 400 });
    }

    const targetTime = new Date(timestamp);
    const fiveMinBefore = new Date(targetTime.getTime() - 5 * 60 * 1000);
    const fiveMinAfter = new Date(targetTime.getTime() + 5 * 60 * 1000);

    // Find users created around this time
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .gte('created_at', fiveMinBefore.toISOString())
      .lte('created_at', fiveMinAfter.toISOString())
      .order('created_at');

    // Find events around this time
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .gte('created_at', fiveMinBefore.toISOString())
      .lte('created_at', fiveMinAfter.toISOString())
      .order('created_at');

    // Find sessions around this time
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .gte('created_at', fiveMinBefore.toISOString())
      .lte('created_at', fiveMinAfter.toISOString())
      .order('created_at');

    return NextResponse.json({
      targetTime: timestamp,
      searchWindow: {
        from: fiveMinBefore.toISOString(),
        to: fiveMinAfter.toISOString()
      },
      users: users?.map(u => ({
        phone_number: u.phone_number,
        id: u.id,
        created_at: u.created_at,
        total_searches: u.total_searches
      })),
      events: events?.map(e => ({
        id: e.id,
        event_type: e.event_type,
        user_id: e.user_id,
        session_id: e.session_id,
        created_at: e.created_at
      })),
      sessions: sessions?.map(s => ({
        id: s.id,
        phone_number: s.phone_number,
        user_id: s.user_id,
        uploaded_image_url: s.uploaded_image_url ? 'YES' : 'NO',
        created_at: s.created_at
      }))
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to find users by time' },
      { status: 500 }
    );
  }
}

