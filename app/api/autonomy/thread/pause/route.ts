/**
 * PHASE F′-9: Pause Execution Thread API
 * 
 * Pauses an active execution thread.
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
    const thread = await threadStore.pauseThread(projectId)

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('[autonomy/thread/pause] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to pause execution thread' },
      { status: 500 }
    )
  }
}
