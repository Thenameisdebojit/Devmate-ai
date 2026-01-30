import { NextRequest, NextResponse } from 'next/server'
import { VirtualDocumentManager, type VirtualDocumentType } from '@/lib/ide/VirtualDocumentManager'

export const runtime = 'nodejs'

/**
 * GET /api/runtime/file/virtual?projectId=...&type=settings
 * Read a virtual document
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type') as VirtualDocumentType

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!type || !['settings', 'extensions', 'keybindings', 'preferences'].includes(type)) {
      return NextResponse.json({ error: 'Invalid virtual document type' }, { status: 400 })
    }

    const document = await VirtualDocumentManager.readVirtualDocument(projectId, type)

    return NextResponse.json(document)
  } catch (error: any) {
    console.error('[virtual/file] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to read virtual document' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/runtime/file/virtual?projectId=...&type=settings
 * Write a virtual document
 */
export async function PUT(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type') as VirtualDocumentType
    const { content } = await req.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!type || !['settings', 'extensions', 'keybindings', 'preferences'].includes(type)) {
      return NextResponse.json({ error: 'Invalid virtual document type' }, { status: 400 })
    }

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    await VirtualDocumentManager.writeVirtualDocument(projectId, type, content)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[virtual/file] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to write virtual document' },
      { status: 500 }
    )
  }
}
