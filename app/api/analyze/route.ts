import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// ✅ Updated for Next.js 15 — use new export style
export const runtime = 'nodejs' // or 'edge' if needed
export const dynamic = 'force-dynamic' // ensures request parsing works

// Next.js now automatically handles the request stream, so you don't need bodyParser config.

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const files = formData.getAll('file')
    const prompt = formData.get('prompt') as string

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const fileData = []

    for (const file of files) {
      if (file instanceof File) {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        fileData.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: buffer.toString('base64'),
        })
      }
    }

    const analysisResult = {
      files: fileData.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
      })),
      prompt,
      analysis: 'Placeholder: Image analysis will be integrated with Gemini Vision API',
      suggestions: [
        'Upload functionality is working correctly',
        'Files are being processed and converted to base64',
        'Ready for AI model integration',
      ],
    }

    return NextResponse.json({
      success: true,
      result: analysisResult,
    })
  } catch (error: any) {
    console.error('File analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze file' },
      { status: 500 }
    )
  }
}
