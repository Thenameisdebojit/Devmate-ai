/**
 * PHASE 4: Rollback Project API
 * 
 * Rolls back entire project to checkpoint.
 * Must emit FILE_CHANGED events for all rolled back files.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCheckpointManager } from '@/lib/agent/CheckpointManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { projectId, checkpointId } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // PHASE 4: Verify workspace exists
    let workspace
    let projectPath
    try {
      workspace = await WorkspaceRegistry.get(projectId)
      projectPath = await WorkspaceRegistry.getRootPath(projectId)
    } catch (error: any) {
      return NextResponse.json(
        { error: `Workspace not found for projectId: ${projectId}` },
        { status: 400 }
      )
    }

    // PHASE 4: Rollback project
    const checkpointManager = getCheckpointManager()
    const rolledBackFiles = await checkpointManager.rollbackProject(projectId, checkpointId)

    // PHASE 4: Emit FILE_CHANGED events for all rolled back files
    const { promises: fs } = await import('fs')

    for (const filePath of rolledBackFiles) {
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
    }

    return NextResponse.json({
      success: true,
      filesRolledBack: rolledBackFiles,
      checkpointId: checkpointId || checkpointManager.getLatestCheckpoint(projectId)?.id,
    })
  } catch (error: any) {
    console.error('Rollback project error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to rollback project' },
      { status: 500 }
    )
  }
}

