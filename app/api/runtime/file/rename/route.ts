/**
 * Runtime API: Rename File
 * 
 * Server-side endpoint for renaming files.
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { FileMutationKernel } from '@/lib/workspace/FileMutationKernel'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { projectId, oldPath, newPath } = await req.json()

    if (!projectId || !oldPath || !newPath) {
      return NextResponse.json(
        { error: 'Project ID, old path, and new path are required' },
        { status: 400 }
      )
    }

    const workspace = WorkspaceRegistry.get(projectId)
    const projectRoot = workspace.getRootPath()

    const oldFullPath = join(projectRoot, oldPath)
    const newFullPath = join(projectRoot, newPath)

    // Security: Ensure paths are within project directory
    if (!oldFullPath.startsWith(projectRoot) || !newFullPath.startsWith(projectRoot)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      )
    }

    // Check if old file exists
    try {
      await fs.access(oldFullPath)
    } catch {
      return NextResponse.json(
        { error: 'Source file does not exist' },
        { status: 404 }
      )
    }

    // Check if new file already exists
    try {
      await fs.access(newFullPath)
      return NextResponse.json(
        { error: 'Target file already exists' },
        { status: 409 }
      )
    } catch {
      // File doesn't exist, which is good
    }

    // Read old file content
    const content = await fs.readFile(oldFullPath, 'utf-8')

    // Ensure new directory exists
    await fs.mkdir(dirname(newFullPath), { recursive: true })

    // Use FileMutationKernel to rename (create new + delete old)
    const mutationKernel = new FileMutationKernel(projectId, projectRoot)
    
    const result = await mutationKernel.apply({
      changes: [
        {
          path: newPath,
          type: 'create',
          fullContent: content,
          reason: `Rename from ${oldPath}`,
        },
        {
          path: oldPath,
          type: 'delete',
          reason: `Renamed to ${newPath}`,
        },
      ],
      reason: `Rename file: ${oldPath} -> ${newPath}`,
    }, {
      createCheckpoint: false,
      requireHighConfidence: false,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to rename file', failedChanges: result.failedChanges },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      oldPath,
      newPath,
    })
  } catch (error: any) {
    console.error('Rename file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to rename file' },
      { status: 500 }
    )
  }
}

