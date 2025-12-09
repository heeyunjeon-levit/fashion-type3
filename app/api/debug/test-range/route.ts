import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Test 1: No limit/range
    const { data: noLimit, count: count1 } = await supabase
      .from('events')
      .select('*', { count: 'exact' });

    // Test 2: With limit(10000)
    const { data: withLimit, count: count2 } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .limit(10000);

    // Test 3: With range(0, 9999)
    const { data: withRange, count: count3 } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .range(0, 9999);

    // Test 4: With range(0, 5000)
    const { data: withRangeSmaller, count: count4 } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .range(0, 5000);

    return NextResponse.json({
      totalInDB: count1,
      test1_noLimit: {
        fetched: noLimit?.length || 0,
        count: count1
      },
      test2_limit10000: {
        fetched: withLimit?.length || 0,
        count: count2
      },
      test3_range9999: {
        fetched: withRange?.length || 0,
        count: count3
      },
      test4_range5000: {
        fetched: withRangeSmaller?.length || 0,
        count: count4
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to test range' },
      { status: 500 }
    );
  }
}

