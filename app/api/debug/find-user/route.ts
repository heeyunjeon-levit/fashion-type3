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

    // Try different phone formats
    const phoneVariations = [
      phone,                                    // 01066809800
      phone.substring(1),                       // 1066809800
      '82' + phone.substring(1),               // 821066809800
      '+82' + phone.substring(1),              // +821066809800
      '0' + phone,                             // 001066809800 (unlikely)
    ];

    console.log('Searching for phone variations:', phoneVariations);

    // Search in users table
    const { data: users } = await supabase
      .from('users')
      .select('*');
    
    const matchingUsers = users?.filter(u => 
      phoneVariations.some(v => u.phone_number.includes(v) || v.includes(u.phone_number))
    );

    // Search in sessions table
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*');
    
    const matchingSessions = sessions?.filter(s => 
      s.phone_number && phoneVariations.some(v => s.phone_number.includes(v) || v.includes(s.phone_number))
    );

    // Search in result_page_visits
    const { data: visits } = await supabase
      .from('result_page_visits')
      .select('*');
    
    const matchingVisits = visits?.filter(v => 
      v.phone_number && phoneVariations.some(vv => v.phone_number.includes(vv) || vv.includes(v.phone_number))
    );

    // Search in feedback
    const { data: feedback } = await supabase
      .from('user_feedback')
      .select('*');
    
    const matchingFeedback = feedback?.filter(f => 
      f.phone_number && phoneVariations.some(v => f.phone_number.includes(v) || v.includes(f.phone_number))
    );

    return NextResponse.json({
      searchedFor: phone,
      variations: phoneVariations,
      found: {
        users: matchingUsers?.map(u => ({
          phone_number: u.phone_number,
          id: u.id,
          total_searches: u.total_searches,
          created_at: u.created_at
        })),
        sessions: matchingSessions?.map(s => ({
          phone_number: s.phone_number,
          session_id: s.session_id,
          id: s.id,
          user_id: s.user_id,
          uploaded_image_url: s.uploaded_image_url ? 'YES' : 'NO',
          created_at: s.created_at
        })),
        result_visits: matchingVisits?.map(v => ({
          phone_number: v.phone_number,
          result_page_url: v.result_page_url,
          created_at: v.visit_timestamp
        })),
        feedback: matchingFeedback?.map(f => ({
          phone_number: f.phone_number,
          satisfaction: f.satisfaction,
          comment: f.comment,
          created_at: f.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to find user' },
      { status: 500 }
    );
  }
}

