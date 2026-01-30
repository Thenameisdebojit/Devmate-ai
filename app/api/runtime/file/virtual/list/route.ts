import { NextRequest, NextResponse } from 'next/server'
import { VirtualDocumentManager } from '@/lib/ide/VirtualDocumentManager'

export const runtime = 'nodejs'

/**
 * GET /api/runtime/file/virtual/list?projectId=...
 * List all virtual documents for a project
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const documents = await VirtualDocumentManager.getAllVirtualDocuments(projectId)

    return NextResponse.json({ documents })
  } catch (error: any) {
    console.error('[virtual/file/list] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list virtual documents' },
      { status: 500 }
    )
  }
}
