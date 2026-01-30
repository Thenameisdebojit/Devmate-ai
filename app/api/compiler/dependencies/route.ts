/**
 * Compiler Dependencies API Route
 * 
 * Manages project dependencies.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDependencyManager } from '@/lib/compiler/DependencyManager'

export const runtime = 'nodejs'
export const maxDuration = 600

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

    // List dependencies
    const depManager = getDependencyManager()
    const dependencies = await depManager.listDependencies(projectPath)

    return NextResponse.json({
      projectId,
      dependencies,
    })
  } catch (error: any) {
    console.error('[Compiler Dependencies API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list dependencies' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, action } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!action || !['install', 'update'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "install" or "update"' },
        { status: 400 }
      )
    }

    // Get project root
    const { getProjectRootManager } = await import('@/lib/workspace/ProjectRootManager')
    const rootManager = getProjectRootManager()
    const projectPath = await rootManager.getProjectRoot(projectId)

    // Execute dependency action
    const depManager = getDependencyManager()
    
    if (action === 'install') {
      await depManager.installDependencies(projectPath)
    } else {
      await depManager.updateDependencies(projectPath)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Compiler Dependencies API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to manage dependencies' },
      { status: 500 }
    )
  }
}
