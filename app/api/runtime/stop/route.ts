/**
 * Runtime API: Stop
 * 
 * Stop and remove a running container.
 */

import { NextRequest, NextResponse } from 'next/server'
import { containerManager } from '@/lib/runtime/containerManager'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    await containerManager.stopContainer(projectId)

    return NextResponse.json({
      success: true,
      message: 'Container stopped',
    })
  } catch (error: any) {
    console.error('Stop error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to stop container' },
      { status: 500 }
    )
  }
}

