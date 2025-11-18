import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Get all unique event types
    const { data: events } = await supabase
      .from('events')
      .select('event_type, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    // Count event types
    const typeCounts: Record<string, number> = {};
    const typeExamples: Record<string, any> = {};
    
    for (const event of events || []) {
      const type = event.event_type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      
      // Store one example of each type
      if (!typeExamples[type]) {
        const { data: fullEvent } = await supabase
          .from('events')
          .select('*')
          .eq('event_type', type)
          .limit(1)
          .single();
        typeExamples[type] = fullEvent;
      }
    }

    return NextResponse.json({
      eventTypes: Object.keys(typeCounts).sort(),
      counts: typeCounts,
      examples: typeExamples
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to get event types' },
      { status: 500 }
    );
  }
}

