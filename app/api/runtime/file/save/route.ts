import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'

export const runtime = 'nodejs'

// Dynamic import to ensure FileMutationKernel is only loaded server-side
async function getFileMutationKernel(projectId: string, projectRoot: string) {
  const { getFileMutationKernel: getKernel } = await import('@/lib/workspace/FileMutationKernel')
  return getKernel(projectId, projectRoot)
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, filePath, content } = await req.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }

    if (content === undefined) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const projectPath = join(process.cwd(), 'runtime-projects', projectId)
    const mutationKernel = await getFileMutationKernel(projectId, projectPath)

    const result = await mutationKernel.apply({
      changes: [
        {
          path: filePath,
          type: 'modify',
          fullContent: content,
          reason: 'User edit',
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

    return NextResponse.json({
      success: true,
      filePath,
      checkpointId: result.checkpointId,
    })
  } catch (error: any) {
    console.error('Save file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save file' },
      { status: 500 }
    )
  }
}

