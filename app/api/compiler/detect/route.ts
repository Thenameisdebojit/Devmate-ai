/**
 * Compiler Detection API Route
 * 
 * Detects build system for a project.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBuildSystemDetector } from '@/lib/compiler/BuildSystemDetector'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Get project root
    const { getProjectRootManager } = await import('@/lib/workspace/ProjectRootManager')
    const rootManager = getProjectRootManager()
    const projectPath = await rootManager.getProjectRoot(projectId)

    // Detect build system
    const detector = getBuildSystemDetector()
    const detected = await detector.detect(projectPath)

    return NextResponse.json({
      projectId,
      buildSystem: detected.buildSystem,
      language: detected.language,
      framework: detected.framework,
      rootPath: detected.rootPath,
    })
  } catch (error: any) {
    console.error('[Compiler Detect API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to detect build system' },
      { status: 500 }
    )
  }
}
