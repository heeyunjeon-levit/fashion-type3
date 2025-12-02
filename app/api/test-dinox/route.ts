import { NextRequest, NextResponse } from 'next/server'

const DINOX_API_BASE = 'https://api.deepdataspace.com'
const DINOX_API_TOKEN = process.env.DINOX_API_TOKEN || 'bdf2ed490ebe69a28be81ea9d9b0b0e3'

export async function GET(request: NextRequest) {
  try {
    // Test with a simple public image
    const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg'
    
    console.log('🧪 Testing DINO-X with known image:', testImageUrl)
    
    // Fetch and convert to base64
    const imageResponse = await fetch(testImageUrl)
    const arrayBuffer = await imageResponse.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const base64Image = `data:image/jpeg;base64,${base64}`
    
    console.log('   Base64 length:', base64Image.length)
    console.log('   First 100 chars:', base64Image.substring(0, 100))
    
    // Create DINO-X task
    const payload = {
      model: "DINO-X-1.0",
      image: base64Image,
      prompt: { type: "text", text: "cat. dog. person. chair. table" },
      targets: ["bbox"],
      bbox_threshold: 0.3
    }
    
    console.log('   Creating DINO-X task...')
    const createResponse = await fetch(`${DINOX_API_BASE}/v2/task/dinox/detection`, {
      method: 'POST',
      headers: {
        'Token': DINOX_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    const createData = await createResponse.json()
    console.log('   Create response:', createData)
    
    if (!createData.data?.task_uuid) {
      return NextResponse.json({
        error: 'No task UUID returned',
        response: createData
      })
    }
    
    const taskUuid = createData.data.task_uuid
    console.log('   Task UUID:', taskUuid)
    
    // Poll for results
    let attempts = 0
    while (attempts < 30) {
      attempts++
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const statusResponse = await fetch(`${DINOX_API_BASE}/v2/task_status/${taskUuid}`, {
        headers: { 'Token': DINOX_API_TOKEN }
      })
      
      const statusData = await statusResponse.json()
      console.log(`   Attempt ${attempts}: status = ${statusData.data?.status}`)
      
      if (statusData.data?.status === 'success') {
        console.log('   ✅ Task completed!')
        const result = statusData.data.result
        console.log('   Objects detected:', result?.objects?.length || 0)
        
        return NextResponse.json({
          success: true,
          objects_count: result?.objects?.length || 0,
          objects: result?.objects || [],
          full_result: result
        })
      } else if (statusData.data?.status === 'failed') {
        return NextResponse.json({
          error: 'Task failed',
          details: statusData
        })
      }
    }
    
    return NextResponse.json({
      error: 'Timeout after 30 attempts'
    })
    
  } catch (error: any) {
    console.error('❌ Test error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

