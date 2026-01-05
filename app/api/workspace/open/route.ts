/**
 * Workspace Open API Route
 * 
 * TASK E: Open Folder / Open Repo (Real Implementation)
 * 
 * Opens a local folder or Git repository and binds it to WorkspaceDaemon.
 * 
 * ARCHITECTURE:
 * - Accepts local path or Git repo URL
 * - Binds WorkspaceDaemon to the workspace
 * - Reattaches RuntimeKernel if runtime was running
 * - Emits WORKSPACE_CHANGED event
 * - Preserves runtime correctness
 */

import { NextRequest, NextResponse } from 'next/server'
import { join, resolve } from 'path'
import { promises as fs } from 'fs'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'
import { spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(require('child_process').exec)

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { path: workspacePath, projectId, isGitRepo = false } = await req.json()

    if (!workspacePath) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    let resolvedPath: string

    if (isGitRepo) {
      // TASK E: Clone Git repository
      const projectPath = join(process.cwd(), 'runtime-projects', projectId)
      await fs.mkdir(projectPath, { recursive: true })

      try {
        // Clone repository
        await execAsync(`git clone ${workspacePath} ${projectPath}`)
        resolvedPath = projectPath
      } catch (error: any) {
        return NextResponse.json(
          { error: `Failed to clone repository: ${error.message}` },
          { status: 500 }
        )
      }
    } else {
      // TASK E: Use local path
      resolvedPath = resolve(workspacePath)
      
      // Verify path exists
      try {
        const stats = await fs.stat(resolvedPath)
        if (!stats.isDirectory()) {
          return NextResponse.json(
            { error: 'Path must be a directory' },
            { status: 400 }
          )
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return NextResponse.json(
            { error: 'Path does not exist' },
            { status: 404 }
          )
        }
        throw error
      }
    }

    // TASK 7: Reset existing workspace in registry
    if (WorkspaceRegistry.has(projectId)) {
      WorkspaceRegistry.reset(projectId)
    }
    
    // TASK 7: Create and bind new WorkspaceDaemon, register it under the SAME projectId
    const daemon = WorkspaceRegistry.register(projectId, resolvedPath)
    
    // TASK 7: Rebind RuntimeKernel (kernel will verify workspace exists in startRuntime)
    const kernel = RuntimeKernel.get(projectId)
    const kernelState = kernel.getState()

    // TASK 7: Emit WORKSPACE_CHANGED event
    daemon.getEventBus().emit({
      type: 'WORKSPACE_CHANGED',
      payload: {
        projectId,
        path: resolvedPath,
        timestamp: Date.now(),
      },
    })

    return NextResponse.json({
      success: true,
      projectId,
      path: resolvedPath,
      runtimeState: kernelState.status === 'running' ? kernelState : null,
    })
  } catch (error: any) {
    console.error('Workspace open error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to open workspace' },
      { status: 500 }
    )
  }
}

