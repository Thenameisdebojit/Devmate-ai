/**
 * Runtime API: Fix Build Error
 * 
 * Server-side endpoint for fixing build errors.
 * Creates checkpoint, reads file, applies fix, writes file.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkpointEngine } from '@/lib/runtime/checkpointEngine'
import { promises as fs } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId, errors } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!errors || errors.length === 0) {
      return NextResponse.json(
        { error: 'No errors provided' },
        { status: 400 }
      )
    }

    const projectPath = join(process.cwd(), 'runtime-projects', projectId)

    // Create checkpoint before any action
    const checkpoint = await checkpointEngine.createCheckpoint(
      projectId,
      projectPath,
      'Before AI fix',
      'pre-write'
    )

    if (!checkpoint) {
      return NextResponse.json(
        { error: 'Failed to create checkpoint' },
        { status: 500 }
      )
    }

    // Get first error
    const firstError = errors[0]
    const filePath = firstError.file || 'src/index.ts'

    // Read file
    const fullPath = join(projectPath, filePath)
    let fileContent: string
    
    try {
      fileContent = await fs.readFile(fullPath, 'utf-8')
    } catch (error: any) {
      return NextResponse.json(
        { error: `Could not read file ${filePath}: ${error.message}` },
        { status: 404 }
      )
    }

    // Simple fix: Comment out problematic line
    const lines = fileContent.split('\n')
    const errorLine = firstError.line ? firstError.line - 1 : 0

    // Basic fix: Comment out problematic line if it exists
    if (errorLine >= 0 && errorLine < lines.length) {
      const originalLine = lines[errorLine]
      // Only comment if not already commented
      if (!originalLine.trim().startsWith('//')) {
        lines[errorLine] = `// ${originalLine} // FIXED: ${firstError.message}`
      }
    }

    const fixedContent = lines.join('\n')

    // Write fixed file
    try {
      await fs.writeFile(fullPath, fixedContent, 'utf-8')
    } catch (error: any) {
      return NextResponse.json(
        { error: `Failed to write file ${filePath}: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      checkpointId: checkpoint.id,
      filePath,
      fixedContent,
    })
  } catch (error: any) {
    console.error('Fix build error error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fix build error' },
      { status: 500 }
    )
  }
}

