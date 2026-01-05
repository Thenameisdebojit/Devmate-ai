/**
 * Runtime API: Run
 * 
 * Starts a container for a project and runs it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { containerManager } from '@/lib/runtime/containerManager'
import { GenerationController } from '@/lib/runtime/GenerationController'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'
import { join } from 'path'
import { promises as fs } from 'fs'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const { projectId, files } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Write files to project directory
    const projectPath = join(process.cwd(), 'runtime-projects', projectId)
    await fs.mkdir(projectPath, { recursive: true })

    if (files && Array.isArray(files)) {
      for (const file of files) {
        const filePath = join(projectPath, file.path)
        await fs.mkdir(join(filePath, '..'), { recursive: true })
        await fs.writeFile(filePath, file.content, 'utf-8')
      }
    }

    // PRE-BUILD VALIDATION: Block Docker build on incomplete projects
    const generationController = new GenerationController(projectId, projectPath)
    const validationStatus = await generationController.validateProject()

    if (!validationStatus.complete) {
      return NextResponse.json(
        { 
          error: 'Project incomplete — generation not finished',
          missingArtifacts: validationStatus.missingArtifacts,
          issues: validationStatus.issues,
          fileCount: validationStatus.fileCount,
          requiredMinimum: validationStatus.requiredMinimum,
        },
        { status: 400 }
      )
    }

    // Get RuntimeKernel instance
    const kernel = RuntimeKernel.get(projectId)
    const kernelState = kernel.getState()

    // Check if runtime is already running
    if (kernelState.status === 'running' || kernelState.status === 'starting') {
      return NextResponse.json(
        { error: 'Runtime is already running', state: kernelState },
        { status: 400 }
      )
    }

    // Create and start container
    const containerStatus = await containerManager.createContainer({
      projectId,
      cpuLimit: '1.0',
      memoryLimit: '1g',
    })

    // Start runtime via kernel (kernel owns lifecycle)
    await kernel.startRuntime()

    // Return kernel state (authoritative)
    const finalState = kernel.getState()

    return NextResponse.json({
      success: true,
      container: containerStatus,
      runtimeState: finalState,
    })
  } catch (error: any) {
    console.error('Run error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run project' },
      { status: 500 }
    )
  }
}

