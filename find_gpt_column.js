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
  const tables = ['users', 'sessions', 'link_clicks', 'result_page_visits', 'app_page_visits'];
  
  for (const table of tables) {
    console.log(`\n🔍 Checking ${table} table...`);
    
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .not('gpt_product_selection', 'is', null)
      .limit(1);
    
    if (error) {
      console.log(`   ❌ Error or column doesn't exist: ${error.message.split('\n')[0]}`);
    } else if (data && data.length > 0) {
      console.log(`   ✅ FOUND IT! ${table} has gpt_product_selection column`);
      console.log(`   Sample data keys:`, Object.keys(data[0]));
      
      if (data[0].gpt_product_selection) {
        const gptData = typeof data[0].gpt_product_selection === 'string' 
          ? JSON.parse(data[0].gpt_product_selection) 
          : data[0].gpt_product_selection;
        
        console.log(`\n   📦 Structure:`, Object.keys(gptData));
        if (gptData.reasoning) {
          console.log(`   📦 Items found:`, Object.keys(gptData.reasoning));
        }
      }
      
      // Get more records
      const { data: moreData } = await supabase
        .from(table)
        .select('*')
        .not('gpt_product_selection', 'is', null)
        .limit(5);
      
      console.log(`\n   Total records with gpt_product_selection: ${moreData?.length || 0}`);
      break;
    } else {
      console.log(`   ℹ️  Column exists but no data`);
    }
  }
}

findGPTColumn();


