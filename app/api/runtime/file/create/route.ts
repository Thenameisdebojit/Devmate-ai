/**
 * Create New File API
 * 
 * Creates a new file in the project workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { join, dirname } from 'path'
import { promises as fs } from 'fs'
import { getFileMutationKernel } from '@/lib/workspace/FileMutationKernel'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { projectId, filePath, content } = await req.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }

    // Ensure workspace is initialized
    const projectPath = join(process.cwd(), 'runtime-projects', projectId)
    
    try {
      WorkspaceRegistry.get(projectId)
    } catch {
      // Workspace not registered - initialize it
      await fs.mkdir(projectPath, { recursive: true })
      WorkspaceRegistry.register(projectId, projectPath)
    }
    
    // Ensure parent directory exists
    const fullPath = join(projectPath, filePath)
    const parentDir = dirname(fullPath)
    await fs.mkdir(parentDir, { recursive: true })

    // Use FileMutationKernel for authoritative writes
    const mutationKernel = getFileMutationKernel(projectId, projectPath)

    const result = await mutationKernel.apply({
      changes: [
        {
          path: filePath,
          type: 'create',
          fullContent: content || '',
          reason: 'User created new file',
        },
      ],
      reason: `Create new file: ${filePath}`,
    }, {
      createCheckpoint: false, // User file creation doesn't need checkpoint
      requireHighConfidence: false,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create file', failedChanges: result.failedChanges },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      filePath,
    })
  } catch (error: any) {
    console.error('Create file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create file' },
      { status: 500 }
    )
  }
}
