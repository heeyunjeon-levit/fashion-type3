import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const htmlPath = path.join(process.cwd(), 'app', 'batch-results.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load results' },
      { status: 500 }
    )
  }
}

