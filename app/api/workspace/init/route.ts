/**
 * Workspace Initialization API Route
 * 
 * TASK 1: Workspace Initialization API (MANDATORY)
 * 
 * Creates and initializes workspace for App Generator IDE.
 * 
 * ARCHITECTURE:
 * - Creates directory: runtime-projects/{projectId} if missing
 * - Binds WorkspaceDaemon to that root
 * - Initializes workspace metadata
 * - Marks workspace as initialized but empty
 * 
 * ❌ Never allow agent execution without initialized workspace
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { promises as fs } from 'fs'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId, mode } = await req.json()

    // ❌ If projectId is missing → return 400
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Create directory: runtime-projects/{projectId} if missing
    const rootPath = join(process.cwd(), 'runtime-projects', projectId)
    
    try {
      await fs.mkdir(rootPath, { recursive: true })
    } catch (error: any) {
      console.error('[workspace/init] Failed to create directory:', error)
      // ❌ If binding fails → throw hard error
      return NextResponse.json(
        { error: `Failed to create workspace directory: ${error.message}` },
        { status: 500 }
      )
    }

    // Register workspace in registry (reuses existing if already registered)
    // This is the ONLY place that should create WorkspaceDaemon instances
    const daemon = WorkspaceRegistry.register(projectId, rootPath)

    // Count existing files
    let fileCount = 0
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true })
      // Filter out hidden files and directories
      fileCount = entries.filter(
        (entry) => entry.isFile() && !entry.name.startsWith('.')
      ).length
    } catch (error) {
      // Directory is empty or can't be read - that's okay for initialization
      fileCount = 0
    }

    // Initialize workspace metadata
    // Note: WorkspaceDaemon doesn't have a direct metadata store,
    // but the workspace is considered initialized once the directory exists
    // and the daemon is bound

    console.log('[workspace/init] Workspace initialized:', {
      projectId,
      rootPath,
      fileCount,
      mode,
    })

    // Return initialized workspace info
    return NextResponse.json({
      initialized: true,
      rootPath,
      fileCount,
      projectId,
    })
  } catch (error: any) {
    console.error('[workspace/init] Error:', error)
    // ❌ Fail loudly
    return NextResponse.json(
      { error: error.message || 'Failed to initialize workspace' },
      { status: 500 }
    )
  }
}

