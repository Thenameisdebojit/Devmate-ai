/**
 * Runtime API: Status
 * 
 * Get status of a running container.
 */

import { NextRequest, NextResponse } from 'next/server'
import { containerManager } from '@/lib/runtime/containerManager'

export const runtime = 'nodejs'

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

    const status = containerManager.getContainerStatus(projectId)

    if (!status) {
      return NextResponse.json({
        running: false,
        message: 'Container not found',
      })
    }

    return NextResponse.json({
      running: status.status === 'running',
      status: status.status,
      port: status.port,
      previewUrl: status.previewUrl,
      createdAt: status.createdAt,
    })
  } catch (error: any) {
    console.error('Status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    )
  }
}

