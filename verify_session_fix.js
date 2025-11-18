#!/usr/bin/env node
/**
 * Verification script for session tracking fix
 * Run this after a test user completes a journey
 */

const phone = process.argv[2];

if (!phone) {
  console.log('Usage: node verify_session_fix.js PHONE_NUMBER');
  console.log('Example: node verify_session_fix.js 01012345678');
  process.exit(1);
}

console.log('🔍 Verifying session tracking for:', phone);
console.log('');

async function verify() {
  try {
    // Check user journey
    const response = await fetch(`http://localhost:3000/api/analytics/user-journey?phone=${phone}`);
    const data = await response.json();

    console.log('📊 User Stats:');
    console.log('  Total uploads:', data.stats.total_uploads);
    console.log('  Total searches:', data.stats.total_searches);
    console.log('  Total clicks:', data.stats.total_clicks);
    console.log('  Total feedback:', data.stats.total_feedback);
    console.log('');

    console.log('📝 Timeline Events:', data.timeline.length);
    data.timeline.forEach((event, idx) => {
      console.log(`  ${idx + 1}. ${event.type} - ${event.timeAgo}`);
    });
    console.log('');

    // Verification
    const hasUploads = data.stats.total_uploads > 0;
    const hasSearches = data.stats.total_searches > 0;
    const hasTimeline = data.timeline.length > 0;

    console.log('✅ Verification Results:');
    console.log(`  ${hasUploads ? '✅' : '❌'} Has uploads (${data.stats.total_uploads})`);
    console.log(`  ${hasSearches ? '✅' : '❌'} Has searches (${data.stats.total_searches})`);
    console.log(`  ${hasTimeline ? '✅' : '❌'} Has timeline events (${data.timeline.length})`);
    console.log('');

    if (hasUploads && hasSearches && hasTimeline) {
      console.log('🎉 SUCCESS! Session tracking is working correctly!');
    } else {
      console.log('⚠️  ISSUE DETECTED! Session tracking may not be working.');
      console.log('');
      console.log('💡 Possible causes:');
      if (!hasUploads) console.log('  - Session not created before image upload');
      if (!hasSearches) console.log('  - Events not linked to session');
      if (!hasTimeline) console.log('  - No events logged at all');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verify();

