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

async function checkUsersTable() {
  console.log('🔍 Checking users table for gpt_product_selection...\n');
  
  // Get a user with the most data
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('total_searches', { ascending: false })
    .limit(3);
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  if (users && users.length > 0) {
    console.log(`✅ Found ${users.length} users\n`);
    
    // Show all columns
    console.log('📋 All columns in users table:');
    console.log(Object.keys(users[0]).join(', '));
    console.log();
    
    // Check for gpt_product_selection
    users.forEach((user, i) => {
      console.log(`\nUser ${i + 1}: ${user.phone_number}`);
      console.log(`  Total searches: ${user.total_searches}`);
      console.log(`  Has gpt_product_selection: ${'gpt_product_selection' in user}`);
      
      if (user.gpt_product_selection) {
        const gptData = typeof user.gpt_product_selection === 'string' 
          ? JSON.parse(user.gpt_product_selection) 
          : user.gpt_product_selection;
        
        console.log(`  🎯 GPT Data structure:`, Object.keys(gptData));
        if (gptData.reasoning) {
          const items = Object.keys(gptData.reasoning);
          console.log(`  📦 Items: ${items.join(', ')}`);
          
          // Show first item detail
          const firstItem = gptData.reasoning[items[0]];
          if (firstItem) {
            console.log(`\n  📝 ${items[0]} details:`);
            console.log(`     Description: ${firstItem.itemDescription}`);
            console.log(`     Candidates: ${firstItem.candidateCount}`);
            console.log(`     Selected: ${firstItem.selectionCount || firstItem.selectedLinks?.length || 0}`);
            if (firstItem.selectedLinks && firstItem.selectedLinks.length > 0) {
              console.log(`     Products:`);
              firstItem.selectedLinks.slice(0, 2).forEach(link => {
                console.log(`       - ${link.title}`);
              });
            }
          }
        }
      }
    });
  }
}

checkUsersTable();


