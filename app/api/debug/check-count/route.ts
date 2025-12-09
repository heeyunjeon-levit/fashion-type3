import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic'


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

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get sessions for this user
    const { data: sessionsByPhone } = await supabase
      .from('sessions')
      .select('*')
      .eq('phone_number', phone);

    const { data: sessionsByUserId } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id);
    
    const sessionsMap = new Map();
    [...(sessionsByPhone || []), ...(sessionsByUserId || [])].forEach(s => {
      sessionsMap.set(s.id, s);
    });
    const userSessions = Array.from(sessionsMap.values());

    const sessionUUIDs = userSessions.map(s => s.id);

    // Get all events (with high limit to match all-users endpoint)
    const { data: allEvents } = await supabase
      .from('events')
      .select('*')
      .limit(10000);

    // Filter events for this user
    const userUploadEvents = allEvents?.filter(e => 
      (e.event_type === 'image_upload' || 
       e.event_type === 'items_cropped' || 
       e.event_type === 'items_selected') && 
      (e.user_id === user.id || sessionUUIDs.includes(e.session_id))
    ) || [];

    // Count uploads
    let uploadsFromEvents = 0;
    const details: any[] = [];
    userUploadEvents.forEach(e => {
      if (e.event_type === 'image_upload') {
        uploadsFromEvents += 1;
        details.push({ type: 'image_upload', count: 1, event_id: e.id });
      } else if (e.event_type === 'items_cropped' || e.event_type === 'items_selected') {
        const items = e.event_data?.items || [];
        uploadsFromEvents += items.length;
        details.push({ 
          type: e.event_type, 
          count: items.length, 
          event_id: e.id,
          items: items.length 
        });
      }
    });

    const uploadsFromSessions = userSessions.filter(s => s.uploaded_image_url).length;

    return NextResponse.json({
      phone,
      user_id: user.id,
      sessions: {
        count: userSessions.length,
        sessionUUIDs,
        withUploads: uploadsFromSessions
      },
      events: {
        userUploadEvents: userUploadEvents.length,
        details,
        allEventsMatchedByUserId: allEvents?.filter(e => e.user_id === user.id).length,
        allEventsMatchedBySessionUUID: allEvents?.filter(e => sessionUUIDs.includes(e.session_id)).length
      },
      result: {
        uploadsFromEvents,
        uploadsFromSessions,
        final: Math.max(uploadsFromEvents, uploadsFromSessions)
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to check count' },
      { status: 500 }
    );
  }
}

