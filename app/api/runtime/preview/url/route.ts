/**
 * Runtime API: Preview URL
 * 
 * Returns the preview URL for a running container.
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
      return NextResponse.json(
        { error: 'Container not found' },
        { status: 404 }
      )
    }

    if (status.status !== 'running') {
      return NextResponse.json(
        { error: 'Container is not running' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      url: status.previewUrl,
      port: status.port,
    })
  } catch (error: any) {
    console.error('Preview URL error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get preview URL' },
      { status: 500 }
    )
  }
}

