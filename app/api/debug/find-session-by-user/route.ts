import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

    // Find ALL sessions for this user_id (including ones with null phone_number)
    const { data: sessionsByUserId } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId);

    // Find sessions created around this user's creation time
    const { data: user } = await supabase
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .single();

    const userCreated = new Date(user?.created_at || 0);
    const fiveMinBefore = new Date(userCreated.getTime() - 5 * 60 * 1000);
    const fiveMinAfter = new Date(userCreated.getTime() + 5 * 60 * 1000);

    const { data: sessionsNearCreation } = await supabase
      .from('sessions')
      .select('*')
      .gte('created_at', fiveMinBefore.toISOString())
      .lte('created_at', fiveMinAfter.toISOString())
      .order('created_at');

    return NextResponse.json({
      userId,
      userCreatedAt: user?.created_at,
      sessionsByUserId: {
        count: sessionsByUserId?.length || 0,
        data: sessionsByUserId
      },
      sessionsNearCreation: {
        count: sessionsNearCreation?.length || 0,
        data: sessionsNearCreation?.map(s => ({
          id: s.id,
          session_id: s.session_id,
          user_id: s.user_id,
          phone_number: s.phone_number,
          created_at: s.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to find sessions' },
      { status: 500 }
    );
  }
}

