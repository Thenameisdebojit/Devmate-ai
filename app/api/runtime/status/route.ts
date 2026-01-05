/**
 * Runtime API: Status
 * 
 * Returns authoritative runtime state from RuntimeKernel.
 * UI must fetch this on load to rehydrate state.
 */

import { NextRequest, NextResponse } from 'next/server'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 }
    )
  }

  try {
    // Get authoritative state from kernel
    const kernel = RuntimeKernel.get(projectId)
    const state = kernel.getState()

    return NextResponse.json({
      success: true,
      state,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get runtime status' },
      { status: 500 }
    )
  }
}
