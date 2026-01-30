import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { isDevmateFile, shouldHideFile } from '@/lib/ide/explorer/ExplorerVisibility'
import { getSettingsRegistry } from '@/lib/ide/settings/SettingsRegistry'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // PHASE E: Use ProjectRootManager for consistent path resolution (same as upload-folder)
    let projectPath: string
    try {
      // Use ProjectRootManager to get the same path as upload-folder route
      const { getProjectRootManager } = await import('@/lib/workspace/ProjectRootManager')
      const rootManager = getProjectRootManager()
      projectPath = await rootManager.getProjectRoot(projectId)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file/list/route.ts:25',message:'ProjectRootManager path resolved',data:{projectId,projectPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      console.log('[FILE-LIST] ProjectRootManager path resolved:', { projectId, projectPath })
    } catch (error: any) {
      // Fallback to WorkspaceRegistry if ProjectRootManager fails
      try {
        projectPath = await WorkspaceRegistry.getRootPath(projectId)
        if (!projectPath) {
          throw new Error(`WorkspaceRegistry returned empty rootPath`)
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file/list/route.ts:33',message:'Using WorkspaceRegistry fallback',data:{projectId,projectPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
      } catch (regError: any) {
        // Final fallback to old path computation
        projectPath = join(process.cwd(), 'runtime-projects', projectId)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file/list/route.ts:38',message:'Using final fallback path',data:{projectId,projectPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        console.warn(`[FILE_LIST] Using fallback path for projectId: ${projectId}, path: ${projectPath}`)
      }
    }

    try {
      await fs.access(projectPath)
    } catch {
      return NextResponse.json({ files: [] })
    }

    const files: Array<{ path: string; type: string }> = []

    async function walkDir(dir: string, basePath: string = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name

        // PHASE 2: Always exclude .devmate files (they must NEVER appear as editable source)
        if (isDevmateFile(relativePath) || entry.name === '.devmate') {
          continue
        }

        // Get showSystemFiles setting from registry (server-side only)
        let showSystemFiles = false
        try {
          const registry = getSettingsRegistry()
          await registry.initialize()
          showSystemFiles = registry.get('devmate.showSystemFiles', projectId) || false
        } catch (error) {
          // If settings can't be loaded, default to hiding system files
          showSystemFiles = false
        }

        // Check visibility rules
        const shouldHide = shouldHideFile(relativePath, showSystemFiles)
        if (shouldHide) {
          continue
        }

        if (entry.isDirectory()) {
          await walkDir(fullPath, relativePath)
        } else {
          files.push({
            path: relativePath,
            type: 'file',
          })
        }
      }
    }

    await walkDir(projectPath)

    // Files are already filtered during walkDir, but apply final safety check
    const finalFiles = files.filter(file => !isDevmateFile(file.path))

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file/list/route.ts:103',message:'File list complete',data:{totalFiles:files.length,finalFiles:finalFiles.length,projectPath,firstFewFiles:finalFiles.slice(0,5).map(f=>f.path)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    console.log('[FILE-LIST] File list complete:', { totalFiles: files.length, finalFiles: finalFiles.length, projectPath, sampleFiles: finalFiles.slice(0, 5).map(f => f.path) })

    return NextResponse.json({ files: finalFiles })
  } catch (error: any) {
    console.error('List files error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list files' },
      { status: 500 }
    )
  }
}

