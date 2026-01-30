/**
 * Git API: Commit Changes
 * 
 * Server-side endpoint for committing changes to Git.
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { projectId, message } = await req.json()

    if (!projectId || !message) {
      return NextResponse.json(
        { error: 'Project ID and commit message are required' },
        { status: 400 }
      )
    }

    const workspace = await WorkspaceRegistry.get(projectId)
    const projectRoot = await WorkspaceRegistry.getRootPath(projectId)

    // Initialize git if not already initialized
    try {
      await execAsync('git status', { cwd: projectRoot })
    } catch {
      // Git not initialized, initialize it
      await execAsync('git init', { cwd: projectRoot })
    }

    // Add all changes
    await execAsync('git add .', { cwd: projectRoot })

    // Commit
    const { stdout, stderr } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: projectRoot,
    })

    if (stderr && !stderr.includes('nothing to commit')) {
      return NextResponse.json(
        { error: stderr },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: stdout || 'Changes committed successfully',
    })
  } catch (error: any) {
    console.error('Git commit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to commit changes' },
      { status: 500 }
    )
  }
}

