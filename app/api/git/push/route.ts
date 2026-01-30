/**
 * Git API: Push to Remote
 * 
 * Server-side endpoint for pushing commits to GitHub.
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId, remote = 'origin', branch = 'main' } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const workspace = await WorkspaceRegistry.get(projectId)
    const projectRoot = await WorkspaceRegistry.getRootPath(projectId)

    // Check if remote exists
    try {
      await execAsync(`git remote get-url ${remote}`, { cwd: projectRoot })
    } catch {
      return NextResponse.json(
        { error: `Remote "${remote}" not configured. Please add a remote repository first.` },
        { status: 400 }
      )
    }

    // Push to remote
    const { stdout, stderr } = await execAsync(`git push ${remote} ${branch}`, {
      cwd: projectRoot,
    })

    if (stderr && !stderr.includes('Everything up-to-date')) {
      // Check if it's an authentication error
      if (stderr.includes('Authentication failed') || stderr.includes('Permission denied')) {
        return NextResponse.json(
          { error: 'Authentication failed. Please configure your Git credentials.' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: stderr },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: stdout || 'Pushed to remote successfully',
    })
  } catch (error: any) {
    console.error('Git push error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to push to remote' },
      { status: 500 }
    )
  }
}

