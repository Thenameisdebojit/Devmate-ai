/**
 * Runtime API: Create Checkpoint
 * 
 * Creates a checkpoint before AI write operations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkpointEngine } from '@/lib/runtime/checkpointEngine'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId, description, type } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const projectPath = join(process.cwd(), 'runtime-projects', projectId)

    const checkpoint = await checkpointEngine.createCheckpoint(
      projectId,
      projectPath,
      description || 'Manual checkpoint',
      type || 'manual'
    )

    return NextResponse.json({
      success: true,
      checkpoint,
    })
  } catch (error: any) {
    console.error('Create checkpoint error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkpoint' },
      { status: 500 }
    )
  }
}

