/**
 * Workspace Upload Folder API Route
 * 
 * Handles folder upload from local disk and loads all files into workspace.
 * 
 * ARCHITECTURE:
 * - Accepts folder upload via FormData
 * - Preserves directory structure
 * - Writes all files to workspace
 * - Registers workspace in WorkspaceRegistry
 * - Emits WORKSPACE_CHANGED event
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { promises as fs } from 'fs'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { getFileMutationKernel } from '@/lib/workspace/FileMutationKernel'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large folders
export const dynamic = 'force-dynamic' // Ensure route is not cached

export async function POST(req: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-folder/route.ts:23',message:'POST request received',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  console.log('[UPLOAD-FOLDER] POST request received')

  try {
    // Get projectId from query params or header first (before reading formData)
    const searchParams = req.nextUrl.searchParams
    let projectId = searchParams.get('projectId') || req.headers.get('X-Project-Id')
    
    // Read formData ONCE - can only be read once in Next.js
    const formData = await req.formData()
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-folder/route.ts:35',message:'FormData read',data:{hasProjectIdInQuery:!!searchParams.get('projectId'),hasProjectIdInHeader:!!req.headers.get('X-Project-Id'),formDataKeys:Array.from(formData.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('[UPLOAD-FOLDER] FormData read, keys:', Array.from(formData.keys()))
    
    // If not in query or header, try to get from formData
    if (!projectId) {
      projectId = formData.get('projectId') as string || null
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-folder/route.ts:42',message:'ProjectId resolved',data:{projectId:projectId||'null',hasProjectId:!!projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('[UPLOAD-FOLDER] ProjectId resolved:', projectId)
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required. Provide it as query parameter ?projectId=... or in X-Project-Id header' },
        { status: 400 }
      )
    }

    const files = formData.getAll('files') as File[]
    const paths = formData.getAll('paths') as string[]
    const folderName = formData.get('folderName') as string // Get folder name if provided

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-folder/route.ts:59',message:'Files extracted from FormData',data:{fileCount:files.length,pathCount:paths.length,hasFolderName:!!folderName,folderName:folderName||'null',fileNames:files.slice(0,5).map(f=>f.name),firstFewPaths:paths.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('[UPLOAD-FOLDER] Files extracted:', { 
      fileCount: files.length, 
      pathCount: paths.length, 
      hasFolderName: !!folderName,
      firstFewPaths: paths.slice(0, 5),
      firstFewFiles: files.slice(0, 3).map(f => ({ name: f.name, size: f.size }))
    })

    // PHASE F: Get or create workspace using ProjectRootManager
    const { getProjectRootManager } = await import('@/lib/workspace/ProjectRootManager')
    const rootManager = getProjectRootManager()
    let rootPath: string
    let workspace

    try {
      rootPath = await rootManager.getProjectRoot(projectId)
      workspace = await WorkspaceRegistry.get(projectId)
    } catch {
      // Workspace not registered - initialize it
      rootPath = await rootManager.getProjectRoot(projectId)
      workspace = await WorkspaceRegistry.register(projectId, rootPath)
    }

    // Handle empty folder case - if no files but folderName is provided, create empty folder
    if ((!files || files.length === 0) && folderName) {
      const emptyFolderPath = join(rootPath, folderName)
      await fs.mkdir(emptyFolderPath, { recursive: true })
      
      // Emit WORKSPACE_CHANGED event
      workspace.getEventBus().emit({
        type: 'WORKSPACE_CHANGED',
        payload: {
          projectId,
          path: rootPath,
          timestamp: Date.now(),
        },
      })

      return NextResponse.json({
        success: true,
        projectId,
        filesUploaded: 0,
        foldersCreated: [folderName],
        rootPath,
      })
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided and no folder name specified' },
        { status: 400 }
      )
    }
    const mutationKernel = getFileMutationKernel(projectId, rootPath)

    // Process files in batches to handle large folders
    const BATCH_SIZE = 50
    const fileChanges: Array<{ type: 'create'; path: string; fullContent: string }> = []
    const directoriesToCreate = new Set<string>() // Track directories to create (including empty ones)
    let totalUploaded = 0 // Track total files uploaded
    
    for (let batchStart = 0; batchStart < files.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, files.length)
      const batch = files.slice(batchStart, batchEnd)
      const batchPaths = paths.slice(batchStart, batchEnd)

      for (let i = 0; i < batch.length; i++) {
        const file = batch[i]
        let relativePath = batchPaths[i] || file.name

        // Normalize path separators for Windows (convert backslashes to forward slashes)
        // webkitRelativePath uses forward slashes, but we need to ensure consistency
        relativePath = relativePath.replace(/\\/g, '/')

        // Track all parent directories (even if empty)
        const pathParts = relativePath.split('/').filter(Boolean)
        if (pathParts.length > 1) {
          // Build parent directory paths
          for (let j = 1; j < pathParts.length; j++) {
            const parentPath = pathParts.slice(0, j).join('/')
            directoriesToCreate.add(parentPath)
          }
        }

        // Skip directories (they'll be created separately)
        if (relativePath.endsWith('/')) {
          // This is a directory entry - track it
          const dirPath = relativePath.replace(/\/$/, '')
          if (dirPath) {
            directoriesToCreate.add(dirPath)
          }
          continue
        }

        try {
          // Read file content - always try to read as text first
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          
          // Default to UTF-8, but handle encoding issues gracefully
          let content: string = ''
          
          if (buffer.length === 0) {
            // Empty file - this is valid
            content = ''
          } else {
            // Check if file is likely binary (has null bytes in first 512 bytes)
            // This is a conservative check - only skip obviously binary files
            const previewBytes = buffer.slice(0, Math.min(512, buffer.length))
            const hasNullBytes = previewBytes.includes(0)
            
            if (hasNullBytes) {
              // File has null bytes - might be binary, but still try to read as text
              // Many text files can have embedded nulls (like some Windows text files)
              // Only skip if it's a known binary extension
              const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.obj', '.lib', '.a', '.jar', '.class', '.pyc', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.zip', '.tar', '.gz', '.7z', '.rar', '.pdf']
              const isBinaryExtension = binaryExtensions.some(ext => relativePath.toLowerCase().endsWith(ext))
              
              if (isBinaryExtension) {
                console.warn(`Skipping binary file (has null bytes + binary extension): ${relativePath}`)
                continue
              }
              
              // Try to read anyway, replacing null bytes
              content = buffer.toString('utf-8').replace(/\0/g, '')
            } else {
              // No null bytes - safe to read as UTF-8 text
              try {
                content = buffer.toString('utf-8')
              } catch (decodeError) {
                // UTF-8 decode failed - try latin1 as fallback (preserves all bytes)
                console.warn(`UTF-8 decode failed for ${relativePath}, using latin1 fallback:`, decodeError)
                content = buffer.toString('latin1')
              }
            }
          }

          // Validate that we got content (should always be true, but defensive check)
          if (content === undefined || content === null) {
            console.warn(`Content is undefined/null for ${relativePath}, using empty string`)
            content = ''
          }

          // Log file creation for debugging (only for first few files to avoid spam)
          if (totalUploaded < 5) {
            console.log(`[upload-folder] Creating file: ${relativePath}, size: ${buffer.length} bytes, content length: ${content.length} chars`)
            if (content.length === 0 && buffer.length > 0) {
              console.warn(`[upload-folder] WARNING: File ${relativePath} has ${buffer.length} bytes but content is empty!`)
            }
          }

          // Ensure we're pushing content even if it's empty (valid for empty files)
          // But log a warning if we expected content
          if (buffer.length > 100 && content.length === 0) {
            console.error(`[upload-folder] ERROR: File ${relativePath} has ${buffer.length} bytes but decoded to empty string!`)
          }

          fileChanges.push({
            type: 'create' as const,
            path: relativePath,
            fullContent: content, // This should always have content if file has data
          })
        } catch (error) {
          console.error(`Failed to process file ${relativePath}:`, error)
          // Continue with other files instead of failing entire upload
        }
      }

      // Apply batch to avoid memory issues with large folders
      if (fileChanges.length >= BATCH_SIZE) {
        const batchChanges = fileChanges.splice(0, BATCH_SIZE)
        console.log(`[upload-folder] Applying batch of ${batchChanges.length} files to kernel...`, { rootPath, firstFile: batchChanges[0]?.path })
        const result = await mutationKernel.apply({
          changes: batchChanges,
          reason: `Uploaded batch of ${batchChanges.length} files`,
          mode: 'generation', // Use generation mode for file uploads (bypasses some checks)
        }, {
          createCheckpoint: false, // User uploads don't need checkpoints
          requireHighConfidence: false,
        })

        console.log(`[upload-folder] Kernel apply result:`, { 
          success: result.success, 
          appliedCount: result.appliedChanges.length, 
          failedCount: result.failedChanges.length,
          errors: result.failedChanges.map(f => f.error)
        })

        if (result.success) {
          totalUploaded += batchChanges.length
          console.log(`[upload-folder] Successfully uploaded batch of ${batchChanges.length} files. Total uploaded so far: ${totalUploaded}`)
          // Verify files were written (first file in batch as sample)
          if (batchChanges.length > 0) {
            const sampleFile = batchChanges[0]
            const sampleFullPath = join(rootPath, sampleFile.path)
            try {
              const fs = await import('fs/promises')
              const writtenContent = await fs.readFile(sampleFullPath, 'utf-8')
              console.log(`[upload-folder] Verification: Sample file ${sampleFile.path} has ${writtenContent.length} chars after write`)
            } catch (verifyError) {
              console.error(`[upload-folder] ERROR: Could not verify file ${sampleFile.path} was written:`, verifyError)
            }
          }
        } else {
          console.error(`[upload-folder] Failed to write some files in batch:`, result.failedChanges)
          console.error(`[upload-folder] Error details:`, result.error)
          // Don't fail entire upload - continue with other batches
        }
      }
    }

    // Apply remaining file changes
    if (fileChanges.length > 0) {
      console.log(`[upload-folder] Applying final batch of ${fileChanges.length} files to kernel...`, { rootPath })
      const result = await mutationKernel.apply({
        changes: fileChanges,
        reason: `Uploaded final batch of ${fileChanges.length} files`,
        mode: 'generation', // Use generation mode for file uploads
      }, {
        createCheckpoint: false, // User uploads don't need checkpoints
        requireHighConfidence: false,
      })

      console.log(`[upload-folder] Final batch kernel apply result:`, { 
        success: result.success, 
        appliedCount: result.appliedChanges.length, 
        failedCount: result.failedChanges.length 
      })

      if (result.success) {
        totalUploaded += fileChanges.length
        console.log(`[upload-folder] Final batch successful: ${fileChanges.length} files. Total: ${totalUploaded}`)
      } else {
        // In generation mode, partial success is acceptable
        if (result.appliedChanges.length > 0) {
          totalUploaded += result.appliedChanges.length
          console.warn(`[upload-folder] Final batch partial success: ${result.appliedChanges.length} succeeded, ${result.failedChanges.length} failed`)
        } else {
          console.error(`[upload-folder] Final batch completely failed:`, result.failedChanges)
          return NextResponse.json(
            { 
              error: 'Failed to write files',
              details: result.failedChanges,
            },
            { status: 500 }
          )
        }
      }
    }

    // Create all directories (including empty ones)
    // This ensures empty folders are also created
    for (const dirPath of directoriesToCreate) {
      try {
        const fullDirPath = join(rootPath, dirPath)
        await fs.mkdir(fullDirPath, { recursive: true })
      } catch (error: any) {
        // Directory might already exist, which is fine
        if (error.code !== 'EEXIST') {
          console.warn(`Failed to create directory ${dirPath}:`, error)
        }
      }
    }

    // Emit WORKSPACE_CHANGED event
    workspace.getEventBus().emit({
      type: 'WORKSPACE_CHANGED',
      payload: {
        projectId,
        path: rootPath,
        timestamp: Date.now(),
      },
    })

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-folder/route.ts:302',message:'Upload complete, verifying files on disk',data:{totalUploaded,projectId,rootPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.log('[UPLOAD-FOLDER] Upload complete:', { totalUploaded, projectId, rootPath })

    // Verify files were actually written to disk by listing the directory
    try {
      const actualFiles = await fs.readdir(rootPath, { recursive: true, withFileTypes: true })
      const fileCount = actualFiles.filter(f => f.isFile()).length
      console.log('[UPLOAD-FOLDER] Verification: Files on disk:', { fileCount, rootPath })
      
      // List first few files as verification
      const sampleFiles = actualFiles.filter(f => f.isFile()).slice(0, 5).map(f => {
        const fullPath = join(rootPath, f.name)
        return f.name
      })
      console.log('[UPLOAD-FOLDER] Sample files on disk:', sampleFiles)
    } catch (verifyError) {
      console.error('[UPLOAD-FOLDER] ERROR: Could not verify files on disk:', verifyError)
    }

    return NextResponse.json({
      success: true,
      projectId,
      filesUploaded: totalUploaded,
      rootPath,
    })
  } catch (error: any) {
    console.error('Folder upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload folder' },
      { status: 500 }
    )
  }
}
