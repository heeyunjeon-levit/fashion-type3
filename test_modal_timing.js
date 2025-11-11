// Test Modal backend timing response directly
const BACKEND_URL = "https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run";

async function testTiming() {
  const testImageUrl = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800";
  
  console.log("🧪 Testing Modal backend timing...\n");
  
  try {
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl: testImageUrl })
    });
    
    const data = await response.json();
    
    console.log("✅ Response received:");
    console.log(JSON.stringify(data, null, 2));
    
    if (data.timing) {
      console.log("\n⏱️  Timing breakdown:");
      console.log(`  GPT-4o: ${data.timing.gpt4o_seconds}s`);
      console.log(`  GroundingDINO: ${data.timing.groundingdino_seconds}s`);
      console.log(`  Download: ${data.timing.download_seconds}s`);
      console.log(`  Processing: ${data.timing.processing_seconds}s`);
      console.log(`  Upload: ${data.timing.upload_seconds}s`);
      console.log(`  Overhead: ${data.timing.overhead_seconds}s`);
      console.log(`  Total: ${data.timing.total_seconds}s`);
    } else {
      console.log("\n⚠️  No timing data in response");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testTiming();

