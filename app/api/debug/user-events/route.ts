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

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get ALL event data (not just types)
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');

    return NextResponse.json({
      phone,
      user: {
        id: user.id,
        phone_number: user.phone_number,
        total_searches: user.total_searches,
        created_at: user.created_at
      },
      events: events || []
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to get events' },
      { status: 500 }
    );
  }
}

