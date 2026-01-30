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
import { promises as fs } from 'fs'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { getProjectRootManager } from '@/lib/workspace/ProjectRootManager'

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

    // PHASE F: Use ProjectRootManager for persistent roots
    const rootManager = getProjectRootManager()
    let rootPath: string
    
    try {
      rootPath = await rootManager.getProjectRoot(projectId)
    } catch (error: any) {
      console.error('[workspace/init] Failed to get project root:', error)
      // ❌ If binding fails → throw hard error
      return NextResponse.json(
        { error: `Failed to create workspace directory: ${error.message}` },
        { status: 500 }
      )
    }

    // PHASE F′-2: Ensure .devmate structure exists (defensive restoration)
    // This ensures OS state persistence even if .devmate was deleted or missing
    try {
      const { ensureDevmateStructure } = await import('@/lib/os/ensureDevmateStructure')
      const devmateResult = await ensureDevmateStructure(rootPath)
      if (devmateResult.success && devmateResult.created.length > 0) {
        console.log(`[workspace/init] Restored .devmate structure: ${devmateResult.created.join(', ')}`)
      }
    } catch (error) {
      // Log but don't fail - .devmate restoration is best-effort
      console.warn('[workspace/init] Failed to ensure .devmate structure (non-fatal):', error)
    }

    // Register workspace in registry (reuses existing if already registered)
    // This is the ONLY place that should create WorkspaceDaemon instances
    const daemon = await WorkspaceRegistry.register(projectId, rootPath)
    
    // PHASE F: Initialize git repository (optional)
    try {
      await rootManager.initializeGit(projectId)
    } catch (error) {
      // Log but don't fail - git initialization is optional
      console.warn('[workspace/init] Failed to initialize git:', error)
    }

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

    // PHASE F′-2: Defensive promotion guard for reload/refresh
    // Ensures project stage doesn't regress after reload/reconnect/refresh
    try {
      const { getProjectEvolutionEngineManager } = await import('@/lib/os/ProjectEvolutionEngineManager')
      const peeManager = getProjectEvolutionEngineManager()
      
      // Get or create engine (PHASE A: Loads stage from disk)
      const pee = await peeManager.getEngine(projectId, rootPath)
      
      // PHASE B: Enforce bootstrap invariants on reload
      // If files exist + .devmate exists but stage < bootstrapped, this is an invariant violation
      const currentStage = pee.getStage()
      if (fileCount > 0) {
        // Check if .devmate exists
        const { promises: fs } = await import('fs')
        const { join } = await import('path')
        const devmatePath = join(rootPath, '.devmate')
        
        try {
          await fs.access(devmatePath)
          // .devmate exists - verify bootstrap invariants
          const validBootstrapStages: Array<'bootstrapped' | 'editable' | 'evolving'> = ['bootstrapped', 'editable', 'evolving']
          
          if (currentStage === 'empty' || !validBootstrapStages.includes(currentStage as any)) {
            // PHASE B: Stage invariant violation detected
            console.warn(`[workspace/init] StageInvariantViolation detected: ${projectId} has ${fileCount} files and .devmate but stage is "${currentStage}". Attempting recovery.`, {
              projectId,
              rootPath,
              fileCount,
              currentStage,
              timestamp: new Date().toISOString(),
            })
            
            // PHASE B: Explicit recovery via Manager (persists to disk)
            await peeManager.setStage(projectId, 'editable', 'recovery')
            
            // PHASE B: Structured logging - recovery event
            console.log(`[workspace/init] Stage recovery completed: ${projectId} → editable (source: recovery)`, {
              projectId,
              rootPath,
              previousStage: currentStage,
              newStage: 'editable',
              source: 'recovery',
              timestamp: new Date().toISOString(),
            })
          }
        } catch {
          // .devmate doesn't exist - this is normal for new projects, not an invariant violation
        }
      }
    } catch (error: any) {
      // Log but don't fail - stage promotion is defensive only
      console.warn('[workspace/init] Failed to check/promote project stage:', error)
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

