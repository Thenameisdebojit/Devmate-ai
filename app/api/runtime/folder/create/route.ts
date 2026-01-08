/**
 * Create New Folder API
 * 
 * Creates a new folder/directory in the project workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { promises as fs } from 'fs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { projectId, folderPath } = await req.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!folderPath) {
      return NextResponse.json({ error: 'Folder path is required' }, { status: 400 })
    }

    const projectPath = join(process.cwd(), 'runtime-projects', projectId)
    const fullPath = join(projectPath, folderPath)

    // Check if folder already exists
    try {
      const stats = await fs.stat(fullPath)
      if (stats.isDirectory()) {
        return NextResponse.json(
          { error: 'Folder already exists' },
          { status: 409 }
        )
      }
    } catch {
      // Folder doesn't exist, which is what we want
    }

    // Create folder
    await fs.mkdir(fullPath, { recursive: true })

    return NextResponse.json({
      success: true,
      folderPath,
    })
  } catch (error: any) {
    console.error('Create folder error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create folder' },
      { status: 500 }
    )
  }
}
