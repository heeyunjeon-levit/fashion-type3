const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssfiahbvlzepvddglawo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzZmlhaGJ2bHplcHZkZGdsYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Mzc1OTIsImV4cCI6MjA3NzIxMzU5Mn0.obUNhgNmYIMlzQBT-_gaNdza52kCaFazqe6F8AF8Gh4';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key starts with:', supabaseKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  try {
    console.log('Testing Supabase connection...');

    // Try to list buckets - this might fail in some Supabase setups
    console.log('Trying to list buckets...');
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('❌ listBuckets failed:', error.message);
      console.log('This might be normal - some Supabase projects restrict bucket listing.');
      console.log('Let\'s try to access the images bucket directly...');
    } else {
      console.log('✅ Buckets found:', data.map(b => b.name));
    }

    // Try to upload directly to images bucket (assuming it exists)
    console.log('\n🧪 Testing upload to images bucket...');
    const testContent = Buffer.from('test image content');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload('test.txt', testContent, {
        contentType: 'text/plain',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      console.log('Status code:', uploadError.statusCode);

      if (uploadError.message.includes('violates row-level security policy')) {
        console.log('\n🔒 RLS POLICY ISSUE DETECTED!');
        console.log('You need to create RLS policies in Supabase SQL editor.');
        console.log('\n📋 Copy and run these SQL commands in your Supabase SQL Editor:');
        console.log(`
-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to upload to images bucket
CREATE POLICY "Allow anonymous uploads to images bucket" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'images'
  AND auth.role() = 'anon'
);

-- Allow anonymous users to view images bucket
CREATE POLICY "Allow anonymous access to images bucket" ON storage.objects
FOR SELECT USING (
  bucket_id = 'images'
);

-- Allow anonymous users to delete from images bucket (optional)
CREATE POLICY "Allow anonymous deletes from images bucket" ON storage.objects
FOR DELETE USING (
  bucket_id = 'images'
  AND auth.role() = 'anon'
);
        `);
      } else if (uploadError.message.includes('Bucket not found')) {
        console.log('\n📦 BUCKET DOES NOT EXIST!');
        console.log('You need to create the "images" bucket in Supabase Storage.');
      } else {
        console.log('\n❓ Unknown error - check Supabase logs for more details.');
      }
    } else {
      console.log('✅ Upload successful!');
      console.log('Upload data:', uploadData);

      // Try to get the public URL
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl('test.txt');

      console.log('📎 Public URL:', urlData.publicUrl);
    }

  } catch (err) {
    console.error('❌ Test failed with exception:', err.message);
  }
}

testSupabase();
