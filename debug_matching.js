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

async function debugMatching() {
  // Get storage uploads
  const { data: storageFiles } = await supabase.storage
    .from('images')
    .list('', {
      limit: 50,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' }
    });
  
  const oneDayAgo = Date.now() - 86400000;
  const recentUploads = storageFiles?.filter(f => {
    const created = new Date(f.created_at).getTime();
    return created > oneDayAgo && f.name.startsWith('upload_');
  }) || [];
  
  // Get recent users
  const { data: recentUsers } = await supabase
    .from('users')
    .select('id, phone_number, created_at')
    .gte('created_at', new Date(oneDayAgo).toISOString())
    .order('created_at', { ascending: false });
  
  console.log(`Recent uploads: ${recentUploads.length}`);
  console.log(`Recent users: ${recentUsers?.length || 0}`);
  
  const excludedPhones = ['01090848563', '821090848563'];
  const excludedUserIds = ['fc878118-43dd-4363-93cf-d31e453df81e'];
  
  console.log('\nMatching uploads with users:');
  recentUploads.forEach(file => {
    const uploadTime = new Date(file.created_at);
    console.log(`\nUpload: ${file.name}`);
    console.log(`  Time: ${uploadTime.toLocaleTimeString()}`);
    
    // Find user within 5 minutes (expanded window)
    const matchedUser = recentUsers?.find(user => {
      const userTime = new Date(user.created_at).getTime();
      const uploadTimestamp = uploadTime.getTime();
      return Math.abs(uploadTimestamp - userTime) < 300000; // 5 minutes
    });
    
    if (matchedUser) {
      const isExcluded = excludedPhones.includes(matchedUser.phone_number) || excludedUserIds.includes(matchedUser.id);
      console.log(`  ✅ Matched: ${matchedUser.phone_number} ${isExcluded ? '(EXCLUDED)' : ''}`);
    } else {
      console.log(`  ❌ No matching user found`);
    }
  });
}

debugMatching();

