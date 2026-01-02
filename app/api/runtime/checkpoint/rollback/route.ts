/**
 * Runtime API: Rollback
 * 
 * Rolls back to a checkpoint (full app or per-file).
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkpointEngine } from '@/lib/runtime/checkpointEngine'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId, checkpointId, filePath } = await req.json()

    if (!projectId || !checkpointId) {
      return NextResponse.json(
        { error: 'Project ID and checkpoint ID are required' },
        { status: 400 }
      )
    }

    const projectPath = join(process.cwd(), 'runtime-projects', projectId)

    await checkpointEngine.rollback(projectId, checkpointId, projectPath, filePath)

    return NextResponse.json({
      success: true,
      message: filePath ? `File ${filePath} rolled back` : 'Project rolled back',
    })
  } catch (error: any) {
    console.error('Rollback error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to rollback' },
      { status: 500 }
    )
  }
}

