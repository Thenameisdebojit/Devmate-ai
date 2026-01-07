/**
 * Runtime API: Delete File
 * 
 * Server-side endpoint for deleting files.
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { FileMutationKernel } from '@/lib/workspace/FileMutationKernel'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { projectId, filePath } = await req.json()

    if (!projectId || !filePath) {
      return NextResponse.json(
        { error: 'Project ID and file path are required' },
        { status: 400 }
      )
    }

    const workspace = WorkspaceRegistry.get(projectId)
    const projectRoot = workspace.getRootPath()

    const fullPath = join(projectRoot, filePath)

    // Security: Ensure path is within project directory
    if (!fullPath.startsWith(projectRoot)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      )
    }

    // Use FileMutationKernel to delete
    const mutationKernel = new FileMutationKernel(projectId, projectRoot)
    
    const result = await mutationKernel.apply({
      changes: [
        {
          path: filePath,
          type: 'delete',
          reason: 'User deletion',
        },
      ],
      reason: `Delete file: ${filePath}`,
    }, {
      createCheckpoint: false,
      requireHighConfidence: false,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete file', failedChanges: result.failedChanges },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      filePath,
    })
  } catch (error: any) {
    console.error('Delete file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete file' },
      { status: 500 }
    )
  }
}

