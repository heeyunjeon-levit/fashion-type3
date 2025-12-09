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

    // Fetch all events with high limit
    const { data: allEvents, count } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .limit(10000);

    // Find events that match in JS
    const matchedInJS = allEvents?.filter(e => e.user_id === userId);

    // Direct query
    const { data: directMatched } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId);

    // Check a sample of event user_ids
    const sampleUserIds = allEvents?.slice(0, 10).map(e => ({
      user_id: e.user_id,
      type: typeof e.user_id,
      isNull: e.user_id === null,
      matchesTarget: e.user_id === userId,
      event_type: e.event_type
    }));

    // Check if target userId is in the fetched events by iterating
    const foundInArray = allEvents?.find(e => e.user_id === userId);

    return NextResponse.json({
      targetUserId: userId,
      targetType: typeof userId,
      totalEventsFetched: allEvents?.length,
      totalEventsInDB: count,
      directQueryMatches: directMatched?.length || 0,
      jsFilterMatches: matchedInJS?.length || 0,
      foundInArray: foundInArray ? { id: foundInArray.id, user_id: foundInArray.user_id } : null,
      sampleUserIds,
      // Check if our target user's events exist in the fetched array
      targetEventsIds: directMatched?.map(e => e.id),
      areTargetEventsInFetchedArray: directMatched?.map(e => ({
        id: e.id,
        existsInArray: allEvents?.some(ae => ae.id === e.id)
      }))
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to compare IDs' },
      { status: 500 }
    );
  }
}

