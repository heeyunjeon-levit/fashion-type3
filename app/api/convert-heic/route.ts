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
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('🔄 Converting HEIC file:', file.name, file.size)

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Convert HEIC to JPEG
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.9,
    })

    console.log('✅ Conversion successful, output size:', outputBuffer.length)

    // Return the JPEG file directly as a blob
    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': outputBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${file.name.replace(/\.heic$/i, '')}.jpg"`,
      },
    })
  } catch (error) {
    console.error('❌ HEIC conversion error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed' 
      },
      { status: 500 }
    )
  }
}

