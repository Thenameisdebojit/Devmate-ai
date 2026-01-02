/**
 * Runtime API: Get Checkpoint Diff
 * 
 * Generates diff between checkpoint and current state.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkpointEngine } from '@/lib/runtime/checkpointEngine'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const checkpointId = searchParams.get('checkpointId')

    if (!projectId || !checkpointId) {
      return NextResponse.json(
        { error: 'Project ID and checkpoint ID are required' },
        { status: 400 }
      )
    }

    const projectPath = join(process.cwd(), 'runtime-projects', projectId)

    const diff = await checkpointEngine.generateDiff(projectId, checkpointId, projectPath)

    return NextResponse.json({
      success: true,
      diff,
    })
  } catch (error: any) {
    console.error('Get diff error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate diff' },
      { status: 500 }
    )
  }
}

