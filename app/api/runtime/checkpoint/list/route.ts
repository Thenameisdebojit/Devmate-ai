/**
 * Runtime API: List Checkpoints
 * 
 * Lists all checkpoints for a project.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkpointEngine } from '@/lib/runtime/checkpointEngine'

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

    const checkpoints = checkpointEngine.listCheckpoints(projectId)
    const latest = checkpointEngine.getLatestCheckpoint(projectId)

    return NextResponse.json({
      checkpoints,
      latest: latest?.id || null,
    })
  } catch (error: any) {
    console.error('List checkpoints error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list checkpoints' },
      { status: 500 }
    )
  }
}

