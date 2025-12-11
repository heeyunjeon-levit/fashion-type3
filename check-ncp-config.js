// Quick script to check NCP configuration
// Run with: node check-ncp-config.js

require('dotenv').config({ path: '.env.local' });

console.log('🔍 Checking NCP SMS Configuration...\n');

const checks = {
  'NCP_ACCESS_KEY': process.env.NCP_ACCESS_KEY,
  'NCP_SECRET_KEY': process.env.NCP_SECRET_KEY,
  'NCP_SMS_SERVICE_ID': process.env.NCP_SMS_SERVICE_ID,
  'NCP_FROM_NUMBER': process.env.NCP_FROM_NUMBER,
};

let allGood = true;

Object.entries(checks).forEach(([key, value]) => {
  if (!value) {
    console.log(`❌ ${key}: NOT SET`);
    allGood = false;
  } else {
    // Show first/last few characters only for security
    const masked = key.includes('KEY') 
      ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
      : value;
    console.log(`✅ ${key}: ${masked}`);
  }
});

console.log('\n---\n');

if (allGood) {
  console.log('✅ All environment variables are set!');
  console.log('\nConstructed API URL would be:');
  const serviceId = process.env.NCP_SMS_SERVICE_ID;
  console.log(`https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`);
} else {
  console.log('❌ Some environment variables are missing');
}

