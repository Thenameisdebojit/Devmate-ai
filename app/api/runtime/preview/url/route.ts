/**
 * Runtime API: Preview URL
 * 
 * Returns preview URL from RuntimeKernel state (authoritative).
 * Preview is a child of runtime - only exists when runtime running.
 */

import { NextRequest, NextResponse } from 'next/server'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'

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

    // Get authoritative state from kernel
    const kernel = RuntimeKernel.get(projectId)
    const state = kernel.getState()

    // Preview only exists when runtime is running
    if (state.status !== 'running') {
      return NextResponse.json(
        { error: 'Runtime is not running' },
        { status: 400 }
      )
    }

    if (!state.previewUrl) {
      return NextResponse.json(
        { error: 'Preview not available yet' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      url: state.previewUrl,
      port: state.previewPort,
      status: state.previewStatus,
    })
  } catch (error: any) {
    console.error('Preview URL error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get preview URL' },
      { status: 500 }
    )
  }
}

