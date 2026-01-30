/**
 * PHASE F′-9: Abort Execution Thread API
 * 
 * Aborts an execution thread.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getExecutionThreadStore } from '@/lib/os/autonomy/ExecutionThreadStore'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { projectId, reason } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const threadStore = getExecutionThreadStore()
    const thread = await threadStore.abortThread(projectId, reason)

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('[autonomy/thread/abort] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to abort execution thread' },
      { status: 500 }
    )
  }
}
