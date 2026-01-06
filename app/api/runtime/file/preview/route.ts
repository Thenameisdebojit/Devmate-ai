/**
 * Runtime API: Preview File (HTML)
 * 
 * Server-side endpoint for previewing HTML files in browser.
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

    // Return HTML content with proper headers
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: any) {
    console.error('Preview file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview file' },
      { status: 500 }
    )
  }
}

