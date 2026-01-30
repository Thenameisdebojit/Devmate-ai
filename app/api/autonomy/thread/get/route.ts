/**
 * PHASE F′-9: Get Execution Thread API
 * 
 * Retrieves the execution thread for a project.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getExecutionThreadStore } from '@/lib/os/autonomy/ExecutionThreadStore'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const threadStore = getExecutionThreadStore()
    const thread = await threadStore.getThread(projectId)

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('[autonomy/thread/get] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get execution thread' },
      { status: 500 }
    )
  }
}
