/**
 * Runtime API: Read File
 * 
 * Server-side endpoint for reading project files.
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const filePath = searchParams.get('path')

    if (!projectId || !filePath) {
      return NextResponse.json(
        { error: 'Project ID and file path are required' },
        { status: 400 }
      )
    }

    const projectPath = join(process.cwd(), 'runtime-projects', projectId)
    const fullPath = join(projectPath, filePath)

    // Security: Ensure path is within project directory
    if (!fullPath.startsWith(projectPath)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      )
    }

    const content = await fs.readFile(fullPath, 'utf-8')

    return NextResponse.json({
      success: true,
      content,
      filePath,
    })
  } catch (error: any) {
    console.error('Read file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to read file' },
      { status: 500 }
    )
  }
}

