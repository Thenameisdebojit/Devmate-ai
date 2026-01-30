/**
 * PHASE F′-4: Evolution Abort API
 * 
 * Aborts a pending evolution plan.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPendingEvolutionStore } from '@/lib/os/evolution/PendingEvolutionStore'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { evolutionId, projectId, reason } = await req.json()

    if (!evolutionId) {
      return NextResponse.json(
        { error: 'Evolution ID is required' },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const store = getPendingEvolutionStore()
    const evolution = store.getById(evolutionId)

    if (!evolution) {
      return NextResponse.json(
        { error: `Evolution ${evolutionId} not found` },
        { status: 404 }
      )
    }

    if (evolution.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Evolution does not belong to this project' },
        { status: 403 }
      )
    }

    if (evolution.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot abort a completed evolution' },
        { status: 400 }
      )
    }

    if (evolution.status === 'executing') {
      return NextResponse.json(
        { error: 'Cannot abort an evolution that is currently executing. Wait for it to complete or fail.' },
        { status: 400 }
      )
    }

    // Abort evolution
    const aborted = store.abort(evolutionId, reason || 'Aborted by user')

    return NextResponse.json({
      success: true,
      evolutionId: aborted.id,
      message: 'Evolution aborted successfully',
    })
  } catch (error: any) {
    console.error('[evolution/abort] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to abort evolution' },
      { status: 500 }
    )
  }
}
