/**
 * Compiler Clean API Route
 * 
 * Cleans build artifacts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBuildSystemDetector } from '@/lib/compiler/BuildSystemDetector'
import { spawn } from 'child_process'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()

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

    if (!detected.buildSystem.cleanCommand) {
      return NextResponse.json(
        { error: 'No clean command available for this build system' },
        { status: 400 }
      )
    }

    // Execute clean command
    await new Promise<void>((resolve, reject) => {
      const [cmd, ...args] = detected.buildSystem.cleanCommand!.split(' ')
      const process = spawn(cmd, args, {
        cwd: projectPath,
        shell: true,
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Clean failed with exit code ${code}`))
        }
      })

      process.on('error', reject)
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Compiler Clean API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to clean build artifacts' },
      { status: 500 }
    )
  }
}
