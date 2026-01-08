/**
 * PHASE 4: Rollback File API
 * 
 * Rolls back a single file to checkpoint.
 * Must emit FILE_CHANGED events.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCheckpointManager } from '@/lib/agent/CheckpointManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId, filePath, checkpointId } = await req.json()

    if (!projectId || !filePath) {
      return NextResponse.json(
        { error: 'Project ID and file path are required' },
        { status: 400 }
      )
    }

    // PHASE 4: Verify workspace exists
    try {
      WorkspaceRegistry.get(projectId)
    } catch (error: any) {
      return NextResponse.json(
        { error: `Workspace not found for projectId: ${projectId}` },
        { status: 400 }
      )
    }

    // PHASE 4: Rollback file
    const checkpointManager = getCheckpointManager()
    await checkpointManager.rollbackFile(projectId, filePath, checkpointId)

    // PHASE 4: Emit FILE_CHANGED event via workspace
    const workspace = WorkspaceRegistry.get(projectId)
    const projectPath = join(process.cwd(), 'runtime-projects', projectId)
    const { promises: fs } = await import('fs')
    
    try {
      const content = await fs.readFile(join(projectPath, filePath), 'utf-8')
      workspace.getEventBus().emit({
        type: 'FILE_CHANGED',
        payload: {
          path: filePath,
          content,
          rolledBack: true,
        },
      } as any)
    } catch (error) {
      // File might not exist after rollback (if it was deleted)
      workspace.getEventBus().emit({
        type: 'FILE_CHANGED',
        payload: {
          path: filePath,
          content: '',
          rolledBack: true,
          deleted: true,
        },
      } as any)
    }

    return NextResponse.json({
      success: true,
      filePath,
      checkpointId: checkpointId || checkpointManager.getLatestCheckpoint(projectId)?.id,
    })
  } catch (error: any) {
    console.error('Rollback file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to rollback file' },
      { status: 500 }
    )
  }
}

