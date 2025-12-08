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

async function findGPTColumn() {
  console.log('🔍 Searching for gpt_product_selection column in database schema...\n');
  
  // Query information_schema to find which table has this column
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE column_name LIKE '%gpt%' OR column_name LIKE '%product%'
      ORDER BY table_name, column_name;
    `
  });
  
  if (error) {
    console.log('❌ RPC not available, trying direct query...\n');
    
    // Alternative: Just list all columns in users table
    const { data: usersColumns } = await supabase
      .rpc('get_table_columns', { table_name: 'users' })
      .catch(() => null);
    
    // Try raw SQL through a different method
    console.log('Let me check the users table directly...\n');
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (users && users.length > 0) {
      console.log('✅ Users table columns:', Object.keys(users[0]).join(', '));
      
      // Check each column for gpt_product_selection
      if ('gpt_product_selection' in users[0]) {
        console.log('\n🎯 FOUND: gpt_product_selection is in the USERS table!');
      }
    }
  } else {
    console.log('Columns found:', data);
  }
}

findGPTColumn();







