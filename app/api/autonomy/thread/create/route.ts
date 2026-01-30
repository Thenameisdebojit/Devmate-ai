/**
 * PHASE F′-9: Create Execution Thread API
 * 
 * Creates a new execution thread for long-horizon autonomy.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getExecutionThreadStore } from '@/lib/os/autonomy/ExecutionThreadStore'
import { getProjectEvolutionEngineManager } from '@/lib/os/ProjectEvolutionEngineManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { projectId, goalId, currentGoalNodeId } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!goalId) {
      return NextResponse.json(
        { error: 'Goal ID is required' },
        { status: 400 }
      )
    }

    // Verify autonomy mode is set to long-horizon
    const rootPath = await WorkspaceRegistry.getRootPath(projectId)
    if (!rootPath) {
      return NextResponse.json(
        { error: 'Project root path not found' },
        { status: 500 }
      )
    }

    const peeManager = getProjectEvolutionEngineManager()
    const pee = await peeManager.getEngine(projectId, rootPath)
    const autonomyMode = pee.getAutonomyMode()

    if (autonomyMode !== 'long-horizon') {
      return NextResponse.json(
        { error: `Autonomy mode must be 'long-horizon' to create execution thread. Current mode: ${autonomyMode}` },
        { status: 400 }
      )
    }

    // Create thread
    const threadStore = getExecutionThreadStore()
    const thread = await threadStore.createThread(projectId, goalId, currentGoalNodeId || null)

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('[autonomy/thread/create] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create execution thread' },
      { status: 500 }
    )
  }
}
