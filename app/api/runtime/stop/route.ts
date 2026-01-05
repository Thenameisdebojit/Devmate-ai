/**
 * Runtime API: Stop
 * 
 * Delegates to RuntimeKernel to stop runtime.
 * Kernel owns lifecycle - stops all processes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { containerManager } from '@/lib/runtime/containerManager'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'

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

    // Get RuntimeKernel and stop runtime (kernel owns lifecycle)
    const kernel = RuntimeKernel.get(projectId)
    await kernel.stopRuntime()

    // Stop container
    await containerManager.stopContainer(projectId)

    // Return final state
    const finalState = kernel.getState()

    return NextResponse.json({
      success: true,
      message: 'Runtime stopped',
      state: finalState,
    })
  } catch (error: any) {
    console.error('Stop error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to stop runtime' },
      { status: 500 }
    )
  }
}

