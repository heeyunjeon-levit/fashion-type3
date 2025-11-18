import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const userId = 'dfc74b08-d911-41de-b06f-825093eb7c37';

    // Method 1: Simple .eq()
    const { data: method1 } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId);

    // Method 2: .or() with user_id only
    const { data: method2 } = await supabase
      .from('events')
      .select('*')
      .or(`user_id.eq.${userId}`);

    // Method 3: .or() with user_id and empty session list
    const { data: method3 } = await supabase
      .from('events')
      .select('*')
      .or(`user_id.eq.${userId},session_id.in.(null)`);

    return NextResponse.json({
      userId,
      method1_simpleEq: {
        count: method1?.length || 0,
        events: method1?.map(e => ({ id: e.id, type: e.event_type }))
      },
      method2_orUserId: {
        count: method2?.length || 0,
        events: method2?.map(e => ({ id: e.id, type: e.event_type }))
      },
      method3_orWithNull: {
        count: method3?.length || 0,
        events: method3?.map(e => ({ id: e.id, type: e.event_type }))
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to test OR query', details: String(error) },
      { status: 500 }
    );
  }
}

