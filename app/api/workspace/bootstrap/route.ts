/**
 * PHASE C: Workspace Bootstrap API
 * 
 * UI-level project creation endpoint.
 * Called directly from frontend for empty workspace generate actions.
 * Does NOT invoke the agent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { BootstrapGenerator } from '@/lib/bootstrap/BootstrapGenerator'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { projectId, platform } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Ensure workspace is registered
    let rootPath: string
    try {
      rootPath = await WorkspaceRegistry.getRootPath(projectId)
    } catch (error: any) {
      // Auto-initialize if not registered
      const { default: fs } = await import('fs/promises')
      const { join } = await import('path')
      
      // PHASE F: Use ProjectRootManager for persistent roots
      const { getProjectRootManager } = await import('@/lib/workspace/ProjectRootManager')
      const rootManager = getProjectRootManager()
      rootPath = await rootManager.getProjectRoot(projectId)
      
      await WorkspaceRegistry.register(projectId, rootPath)
    }

    // Check if workspace is empty
    const isEmpty = await BootstrapGenerator.isWorkspaceEmpty(rootPath)
    if (!isEmpty) {
      return NextResponse.json(
        { error: 'Workspace is not empty. Bootstrap only works for empty workspaces.' },
        { status: 400 }
      )
    }

    // Run bootstrap generator
    const bootstrapPlatform = (platform === 'web' || !platform) ? 'web' : 
                             platform === 'backend' ? 'node' : 'web'
    
    const result = await BootstrapGenerator.run({
      projectId,
      rootPath,
      platform: bootstrapPlatform,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Bootstrap failed' },
        { status: 500 }
      )
    }

    // PHASE E: Invariant check after bootstrap
    const { assertExecutionInvariant } = await import('@/lib/invariants/assertExecutionInvariant')
    assertExecutionInvariant({
      projectId,
      intent: { type: 'generate', description: 'Bootstrap project', isEmptyIntent: true } as any,
      workspaceStage: 'bootstrapped',
      fileCount: result.filesCreated.length,
      rootPath,
      filesWritten: result.filesCreated.length,
    })

    return NextResponse.json({
      success: true,
      filesCreated: result.filesCreated,
      fileCount: result.filesCreated.length,
      platform: bootstrapPlatform,
    })
  } catch (error: any) {
    console.error('[workspace/bootstrap] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to bootstrap workspace' },
      { status: 500 }
    )
  }
}
