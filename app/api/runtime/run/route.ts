/**
 * Runtime API: Run
 * 
 * Starts a container for a project and runs it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { containerManager } from '@/lib/runtime/containerManager'
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

    // Create and start container
    const containerStatus = await containerManager.createContainer({
      projectId,
      cpuLimit: '1.0',
      memoryLimit: '1g',
    })

    return NextResponse.json({
      success: true,
      container: containerStatus,
    })
  } catch (error: any) {
    console.error('Run error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run project' },
      { status: 500 }
    )
  }
}

