import { NextRequest, NextResponse } from 'next/server'

// Type declaration for heic-convert
interface HeicConvertOptions {
  buffer: Buffer
  format: 'JPEG' | 'PNG'
  quality?: number
}

// @ts-ignore - heic-convert doesn't have TypeScript definitions
import heicConvert from 'heic-convert'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.error('❌ No file provided in request')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('🔄 Converting HEIC file:', {
      name: file.name,
      size: file.size,
      type: file.type,
    })

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    console.log('📦 Input buffer size:', inputBuffer.length)

    // Convert HEIC to JPEG
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.9,
    }) as Buffer

    console.log('✅ Conversion successful, output size:', outputBuffer.length)

    // Return the JPEG file directly as a blob
    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(outputBuffer)
    
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': outputBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${file.name.replace(/\.heic$/i, '').replace(/\.heif$/i, '')}.jpg"`,
      },
    })
  } catch (error) {
    console.error('❌ HEIC conversion error:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'N/A')
    
    // Always return JSON for errors
    return new NextResponse(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed',
        details: error instanceof Error ? error.stack : String(error),
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

