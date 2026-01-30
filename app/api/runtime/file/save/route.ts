import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { promises as fs } from 'fs'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

export const runtime = 'nodejs'

// Dynamic import to ensure FileMutationKernel is only loaded server-side
async function getFileMutationKernel(projectId: string, projectRoot: string) {
  const { getFileMutationKernel: getKernel } = await import('@/lib/workspace/FileMutationKernel')
  return getKernel(projectId, projectRoot)
}

export async function POST(req: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file/save/route.ts:14',message:'POST request received',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
  // #endregion
  console.log('[FILE-SAVE] POST request received')
  
  try {
    const body = await req.json().catch(async () => {
      // Try to read as text if JSON parsing fails
      const text = await req.text()
      return JSON.parse(text)
    })
    const { projectId, filePath, content } = body
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file/save/route.ts:22',message:'Request body parsed',data:{hasProjectId:!!projectId,hasFilePath:!!filePath,hasContent:content!==undefined,contentLength:content?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
    // #endregion
    console.log('[FILE-SAVE] Request body parsed:', { hasProjectId: !!projectId, hasFilePath: !!filePath, hasContent: content !== undefined, contentLength: content?.length || 0 })

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }

    if (content === undefined) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // PHASE F: Use ProjectRootManager for consistent project root paths
    const { getProjectRootManager } = await import('@/lib/workspace/ProjectRootManager')
    const rootManager = getProjectRootManager()
    const projectPath = await rootManager.getProjectRoot(projectId)
    
    // Normalize path for Windows (handle case sensitivity)
    const { normalize } = await import('path')
    const normalizedProjectPath = normalize(projectPath)
    
    // Ensure workspace is registered with normalized path
    try {
      const workspace = await WorkspaceRegistry.get(projectId)
      // Verify root path matches
      const registeredPath = await WorkspaceRegistry.getRootPath(projectId)
      const normalizedRegisteredPath = normalize(registeredPath)
      if (normalizedRegisteredPath !== normalizedProjectPath) {
        // Re-register with correct path
        await WorkspaceRegistry.register(projectId, normalizedProjectPath)
      }
    } catch {
      // Workspace not registered - initialize it
      await WorkspaceRegistry.register(projectId, normalizedProjectPath)
    }

    // Check if file exists to determine if we should create or modify
    const fullPath = join(normalizedProjectPath, filePath)
    let fileExists = false
    try {
      await fs.access(fullPath)
      fileExists = true
    } catch {
      // File doesn't exist, will create it
      fileExists = false
    }

    // Ensure parent directory exists
    const { dirname } = await import('path')
    const parentDir = dirname(fullPath)
    await fs.mkdir(parentDir, { recursive: true })

    const mutationKernel = await getFileMutationKernel(projectId, normalizedProjectPath)

    const result = await mutationKernel.apply({
      changes: [
        {
          path: filePath,
          type: fileExists ? 'modify' : 'create',
          fullContent: content,
          reason: fileExists ? 'User edit' : 'User created new file',
        },
      ],
      reason: `Save file: ${filePath}`,
    }, {
      createCheckpoint: false, // User edits don't need checkpoints
      requireHighConfidence: false,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to save file', failedChanges: result.failedChanges },
        { status: 500 }
      )
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file/save/route.ts:94',message:'File save successful',data:{filePath,checkpointId:result.checkpointId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
    // #endregion
    console.log('[FILE-SAVE] File save successful:', { filePath, checkpointId: result.checkpointId })
    
    return NextResponse.json({
      success: true,
      filePath,
      checkpointId: result.checkpointId,
    })
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file/save/route.ts:103',message:'Save file error',data:{error:error.message||'unknown',stack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
    // #endregion
    console.error('[FILE-SAVE] Save file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save file' },
      { status: 500 }
    )
  }
}

