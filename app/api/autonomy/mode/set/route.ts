/**
 * PHASE F′-9: Set Autonomy Mode API
 * 
 * Sets the autonomy mode for a project.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProjectEvolutionEngineManager } from '@/lib/os/ProjectEvolutionEngineManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import type { AutonomyMode } from '@/lib/os/ProjectEvolutionEngine'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { projectId, mode } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!mode || !['manual', 'guided', 'long-horizon'].includes(mode)) {
      return NextResponse.json(
        { error: 'Mode must be one of: manual, guided, long-horizon' },
        { status: 400 }
      )
    }

    const rootPath = await WorkspaceRegistry.getRootPath(projectId)
    if (!rootPath) {
      return NextResponse.json(
        { error: 'Project root path not found' },
        { status: 500 }
      )
    }

    const peeManager = getProjectEvolutionEngineManager()
    const pee = await peeManager.getEngine(projectId, rootPath)
    pee.setAutonomyMode(mode as AutonomyMode)

    return NextResponse.json({
      success: true,
      mode,
      message: `Autonomy mode set to ${mode}`,
    })
  } catch (error: any) {
    console.error('[autonomy/mode/set] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to set autonomy mode' },
      { status: 500 }
    )
  }
}
