import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

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

    // Generate unique filename - sanitize to remove non-ASCII characters (Korean, etc.)
    const timestamp = Date.now()
    
    // Sanitize filename: remove all non-ASCII characters, keep only alphanumeric, dots, hyphens, underscores
    const sanitizedName = file.name
      .normalize('NFD') // Normalize Unicode
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII (Korean, Chinese, etc.)
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace remaining invalid chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .trim()
    
    // Fallback if sanitization removed everything
    const baseName = sanitizedName || 'image'
    
    let filename = `upload_${timestamp}_${baseName}`
    
    // If file type is JPEG but name doesn't end with jpg/jpeg, fix the extension
    if (file.type === 'image/jpeg' && !filename.match(/\.(jpg|jpeg)$/i)) {
      filename = `upload_${timestamp}_${baseName.replace(/\.[^.]+$/, '')}.jpg`
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

