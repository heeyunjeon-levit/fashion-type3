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
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Method 1: Direct query with user_id filter
    const { data: directQuery } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId);

    // Method 2: Fetch ALL events and filter in JS
    const { data: allEvents, count: totalCount } = await supabase
      .from('events')
      .select('*', { count: 'exact' });
    
    const jsFiltered = allEvents?.filter(e => e.user_id === userId);

    return NextResponse.json({
      userId,
      method1_directQuery: {
        count: directQuery?.length || 0,
        events: directQuery?.map(e => ({ id: e.id, type: e.event_type }))
      },
      method2_jsFiltered: {
        totalEventsFetched: allEvents?.length || 0,
        totalEventsInDB: totalCount,
        matchedCount: jsFiltered?.length || 0,
        matched: jsFiltered?.map(e => ({ id: e.id, type: e.event_type }))
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

