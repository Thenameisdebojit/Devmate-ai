/**
 * PHASE F′-9: Resume Execution Thread API
 * 
 * Resumes a paused execution thread.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getExecutionThreadStore } from '@/lib/os/autonomy/ExecutionThreadStore'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const threadStore = getExecutionThreadStore()
    const thread = await threadStore.resumeThread(projectId)

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('[autonomy/thread/resume] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resume execution thread' },
      { status: 500 }
    )
  }
}
