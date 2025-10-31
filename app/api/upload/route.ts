import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('📤 Uploading to Supabase storage...')
    console.log('📝 File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
    })

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    console.log('📦 Buffer size:', buffer.length)

    // Generate unique filename - ensure .jpg extension for converted HEIC files
    const timestamp = Date.now()
    let filename = `upload_${timestamp}_${file.name}`
    
    // If file type is JPEG but name doesn't end with jpg/jpeg, fix the extension
    if (file.type === 'image/jpeg' && !file.name.match(/\.(jpg|jpeg)$/i)) {
      filename = `upload_${timestamp}_${file.name.replace(/\.[^.]+$/, '')}.jpg`
    }

    console.log('📁 Filename:', filename)

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filename, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false
      })

    if (error) {
      console.error('❌ Supabase upload failed:', error)
      console.error('❌ Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: `Supabase error: ${error.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log('✅ Supabase upload successful')

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filename)

    return NextResponse.json({ imageUrl: publicUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}

