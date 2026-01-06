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

export async function POST(req: NextRequest) {
  try {
    // Get projectId from query params or body
    const searchParams = req.nextUrl.searchParams
    let projectId = searchParams.get('projectId') || req.headers.get('X-Project-Id')
    
    // If not in query or header, try to get from formData
    if (!projectId) {
      const formData = await req.formData()
      projectId = formData.get('projectId') as string || null
    }
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required. Provide it as query parameter ?projectId=... or in X-Project-Id header' },
        { status: 400 }
      )
    }

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const paths = formData.getAll('paths') as string[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Get or create workspace
    const rootPath = join(process.cwd(), 'runtime-projects', projectId)
    await fs.mkdir(rootPath, { recursive: true })

    // Register workspace if not already registered
    if (!WorkspaceRegistry.has(projectId)) {
      WorkspaceRegistry.register(projectId, rootPath)
    }

    const workspace = WorkspaceRegistry.get(projectId)
    const mutationKernel = getFileMutationKernel(projectId, rootPath)

    // Process files in batches to handle large folders
    const BATCH_SIZE = 50
    const fileChanges: Array<{ type: 'create'; path: string; fullContent: string }> = []
    
    for (let batchStart = 0; batchStart < files.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, files.length)
      const batch = files.slice(batchStart, batchEnd)
      const batchPaths = paths.slice(batchStart, batchEnd)

      for (let i = 0; i < batch.length; i++) {
        const file = batch[i]
        const relativePath = batchPaths[i] || file.name

        // Skip directories (they'll be created automatically)
        if (relativePath.endsWith('/')) {
          continue
        }

        try {
          // Read file content - handle both text and binary files
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          
          // Try to decode as text
          let content: string
          try {
            content = buffer.toString('utf-8')
            // Validate UTF-8 by checking if re-encoding matches
            const reencoded = Buffer.from(content, 'utf-8')
            if (reencoded.length !== buffer.length) {
              throw new Error('Invalid UTF-8')
            }
          } catch {
            // Binary file - skip for now (can be enhanced later to handle binary)
            console.warn(`Skipping binary file: ${relativePath}`)
            continue
          }

          fileChanges.push({
            type: 'create' as const,
            path: relativePath,
            fullContent: content,
          })
        } catch (error) {
          console.error(`Failed to process file ${relativePath}:`, error)
          // Continue with other files
        }
      }

      // Apply batch to avoid memory issues with large folders
      if (fileChanges.length >= BATCH_SIZE) {
        const batchChanges = fileChanges.splice(0, BATCH_SIZE)
        const result = await mutationKernel.apply({
          changes: batchChanges,
          description: `Uploaded batch of ${batchChanges.length} files`,
        })

        if (!result.success) {
          console.warn(`Failed to write some files in batch:`, result.failedChanges)
        }
      }
    }

    // Apply remaining file changes
    if (fileChanges.length > 0) {
      const result = await mutationKernel.apply({
        changes: fileChanges,
        description: `Uploaded final batch of ${fileChanges.length} files`,
      })

      if (!result.success) {
        return NextResponse.json(
          { 
            error: 'Failed to write some files',
            details: result.failedChanges,
          },
          { status: 500 }
        )
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
