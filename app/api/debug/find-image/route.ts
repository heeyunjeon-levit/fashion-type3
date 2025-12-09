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
    const imageUrl = searchParams.get('imageUrl');

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL required' }, { status: 400 });
    }

    // Find sessions with this image
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('uploaded_image_url', imageUrl);

    // Find events with this image in event_data
    const { data: allEvents } = await supabase
      .from('events')
      .select('*')
      .limit(10000);

    const eventsWithImage = allEvents?.filter(e => {
      const eventData = JSON.stringify(e.event_data || {});
      return eventData.includes(imageUrl);
    }) || [];

    return NextResponse.json({
      imageUrl,
      sessions: sessions?.map(s => ({
        id: s.id,
        phone_number: s.phone_number,
        user_id: s.user_id,
        created_at: s.created_at
      })),
      events: eventsWithImage.map(e => ({
        id: e.id,
        event_type: e.event_type,
        user_id: e.user_id,
        session_id: e.session_id,
        created_at: e.created_at
      }))
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to find image' },
      { status: 500 }
    );
  }
}

