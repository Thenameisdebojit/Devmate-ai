/**
 * Git API: Get Status
 * 
 * Server-side endpoint for getting Git status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const maxDuration = 30

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

    const workspace = WorkspaceRegistry.get(projectId)
    const projectRoot = workspace.getRootPath()

    try {
      // Check if git is initialized
      await execAsync('git status', { cwd: projectRoot })
    } catch {
      return NextResponse.json({
        initialized: false,
        hasChanges: false,
        branch: null,
        remotes: [],
      })
    }

    // Get branch name
    const { stdout: branchOutput } = await execAsync('git branch --show-current', {
      cwd: projectRoot,
    })
    const branch = branchOutput.trim()

    // Get status
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: projectRoot,
    })
    const hasChanges = statusOutput.trim().length > 0

    // Get remotes
    let remotes: string[] = []
    try {
      const { stdout: remoteOutput } = await execAsync('git remote', { cwd: projectRoot })
      remotes = remoteOutput.trim().split('\n').filter(Boolean)
    } catch {
      remotes = []
    }

    return NextResponse.json({
      initialized: true,
      hasChanges,
      branch,
      remotes,
    })
  } catch (error: any) {
    console.error('Git status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get Git status' },
      { status: 500 }
    )
  }
}

