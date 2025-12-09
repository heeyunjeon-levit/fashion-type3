import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const maxDuration = 30 // Allow up to 30 seconds for large uploads

export async function POST(request: NextRequest) {
  try {
    const { dataUrl, category } = await request.json()
    
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return NextResponse.json(
        { error: 'Invalid data URL' },
        { status: 400 }
      )
    }
    
    // Extract base64 data
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      return NextResponse.json(
        { error: 'Invalid data URL format' },
        { status: 400 }
      )
    }
    
    const [, ext, base64Data] = matches
    const imageBuffer = Buffer.from(base64Data, 'base64')
    
    // Upload to Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const timestamp = Date.now()
    const filename = `cropped_${category}_${timestamp}.${ext}`
    
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filename, imageBuffer, {
        contentType: `image/${ext}`,
        upsert: false
      })
    
    if (error) {
      console.error('Supabase upload error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filename)
    
    return NextResponse.json({ url: publicUrl })
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


