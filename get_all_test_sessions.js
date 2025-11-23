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

async function getAllTestSessions() {
  // Get all visits to the test page in last 24h
  const testPhone = '821071953780';
  
  const { data: visits, error } = await supabase
    .from('result_page_visits')
    .select('session_id, visit_timestamp')
    .eq('phone_number', testPhone)
    .gte('visit_timestamp', new Date(Date.now() - 86400000).toISOString())
    .order('visit_timestamp', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const uniqueSessions = [...new Set(visits?.map(v => v.session_id) || [])];
  
  console.log(`Sessions that visited ${testPhone} (your test page):\n`);
  uniqueSessions.forEach(sid => {
    const count = visits.filter(v => v.session_id === sid).length;
    console.log(`  '${sid}', // ${count} visits`);
  });
  
  console.log(`\nTotal unique sessions: ${uniqueSessions.length}`);
}

getAllTestSessions();






