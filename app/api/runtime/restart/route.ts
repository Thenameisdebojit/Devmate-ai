/**
 * PHASE 5: Runtime Restart API
 * 
 * Debounced restart on file changes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId, filePath } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // PHASE 5: Schedule restart via RuntimeKernel
    const kernel = RuntimeKernel.get(projectId)
    kernel.scheduleRestart(filePath || '')

    return NextResponse.json({
      success: true,
      message: 'Runtime restart scheduled',
    })
  } catch (error: any) {
    console.error('Schedule restart error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to schedule restart' },
      { status: 500 }
    )
  }
}

