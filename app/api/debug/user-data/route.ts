import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get sessions by phone_number
    const { data: sessionsByPhone } = await supabase
      .from('sessions')
      .select('*')
      .eq('phone_number', phone);

    // ALSO get sessions by user_id (might not have phone_number set!)
    const { data: sessionsByUserId } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id);
    
    // Combine and deduplicate
    const sessionsMap = new Map();
    [...(sessionsByPhone || []), ...(sessionsByUserId || [])].forEach(s => {
      sessionsMap.set(s.id, s);
    });
    const sessions = Array.from(sessionsMap.values());

    // Get events by user_id
    const { data: eventsByUserId } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id);

    // Get events by session UUIDs
    const sessionUUIDs = sessions?.map(s => s.id) || [];
    const { data: allEvents } = await supabase
      .from('events')
      .select('*');
    
    const eventsBySessionUUID = allEvents?.filter(e => 
      sessionUUIDs.includes(e.session_id)
    ) || [];

    // Get clicks by user_id
    const { data: clicksByUserId } = await supabase
      .from('link_clicks')
      .select('*')
      .eq('user_id', user.id);

    // Get clicks by session UUID
    const { data: allClicks } = await supabase
      .from('link_clicks')
      .select('*');
    
    const clicksBySessionUUID = allClicks?.filter(c => 
      sessionUUIDs.includes(c.session_id)
    ) || [];

    return NextResponse.json({
      phone,
      user: {
        id: user.id,
        phone_number: user.phone_number,
        created_at: user.created_at,
        total_searches: user.total_searches
      },
      sessions: {
        count: sessions?.length || 0,
        data: sessions?.map(s => ({
          id: s.id,
          session_id: s.session_id,
          user_id: s.user_id,
          phone_number: s.phone_number,
          uploaded_image_url: s.uploaded_image_url,
          created_at: s.created_at
        }))
      },
      events: {
        byUserId: {
          count: eventsByUserId?.length || 0,
          types: eventsByUserId?.map(e => e.event_type) || []
        },
        bySessionUUID: {
          count: eventsBySessionUUID.length,
          types: eventsBySessionUUID.map(e => e.event_type)
        }
      },
      clicks: {
        byUserId: {
          count: clicksByUserId?.length || 0
        },
        bySessionUUID: {
          count: clicksBySessionUUID.length
        }
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug data' },
      { status: 500 }
    );
  }
}

