// Check if the image, events, and feedback all belong to the same user

const phone = '01066809800';
const imageUrl = 'https://ssfiahbvlzepvddglawo.supabase.co/storage/v1/object/public/images/accessories_item1_black_bag_1763452022513.jpg';

console.log('🔍 Checking data consistency for phone:', phone);
console.log('📸 Image URL:', imageUrl);
console.log('');

// Extract timestamp from image filename
const timestamp = imageUrl.match(/(\d+)\.jpg/)?.[1];
if (timestamp) {
  const imageDate = new Date(parseInt(timestamp));
  console.log('📅 Image upload timestamp (from filename):', imageDate.toISOString());
  console.log('   Human readable:', imageDate.toLocaleString());
}

console.log('');
console.log('Expected timeline:');
console.log('1. User uploads image');
console.log('2. Items are selected (GPT analysis)');
console.log('3. Results page shown');
console.log('4. User gives feedback');
console.log('');
console.log('Actual logged timeline from our debug:');
console.log('- 07:49:02 - User created');
console.log('- 07:49:03 - Phone provided');
console.log('- 07:49:33 - Feedback submitted');
console.log('- 07:49:36 - items_selected event (with image)');
console.log('');
console.log('⚠️  Problem: items_selected event is logged AFTER feedback!');
console.log('⚠️  This suggests async logging delay or event queue processing.');
