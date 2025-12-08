const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env file
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

async function debug() {
  const excludedPhones = ['01090848563', '821090848563'];
  const excludedSessions = [
    'session_1763379288045_ymn5qkcw9',
    'session_1763379158148_0hffdwny3',
    'session_1763379063071_al1men7al',
    'session_1763379090206_irwup98ir',
    'session_1763359911250_3kuzgauqo',
    'session_1763380393830_66kq8jdpw',
    'session_1763380388136_3jv92bpos',
    'session_1763380384685_xk587j0t6',
    'session_1763379130537_x071i25r2',
    'session_1763379146775_wg7xsarb4',
    'session_1763379141701_gchc7i99c'
  ];
  
  // Test exact same query as API
  const { data: visits, error } = await supabase
    .from('result_page_visits')
    .select('id, phone_number, visit_timestamp, result_page_url, clicked_products, session_id')
    .gte('visit_timestamp', new Date(Date.now() - 86400000).toISOString())
    .order('visit_timestamp', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Total visits fetched: ${visits?.length || 0}`);
  
  // Apply filters
  let activities = [];
  visits?.forEach(visit => {
    if (!excludedPhones.includes(visit.phone_number) && !excludedSessions.includes(visit.session_id)) {
      activities.push({
        type: 'visit',
        phone: visit.phone_number,
        timestamp: visit.visit_timestamp
      });
    }
  });
  
  console.log(`After filtering: ${activities.length}`);
  
  if (activities.length > 0) {
    console.log('\nSample visits:');
    activities.slice(0, 5).forEach(a => {
      const time = new Date(a.timestamp).toLocaleTimeString();
      console.log(`  ${a.phone} at ${time}`);
    });
  }
}

debug();







