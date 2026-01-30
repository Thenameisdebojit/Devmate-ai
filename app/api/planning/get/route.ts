/**
 * PHASE F′-6: Get Planning Cycle API
 * 
 * Retrieves the latest planning cycle for a project.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPlanningStore } from '@/lib/os/planning/PlanningStore'
import { PlanningEngine } from '@/lib/os/planning/PlanningEngine'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const regenerate = searchParams.get('regenerate') === 'true'

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const store = getPlanningStore()

    // Regenerate if requested or if no plan exists
    if (regenerate || !store.has(projectId)) {
      const cycle = await PlanningEngine.generatePlan(projectId)
      if (!cycle) {
        return NextResponse.json({
          planningCycle: null,
          message: 'No active goal found. Set a project goal to enable planning.',
        })
      }
      return NextResponse.json({ planningCycle: cycle })
    }

    // Return existing plan
    const cycle = store.get(projectId)
    return NextResponse.json({ planningCycle: cycle })
  } catch (error: any) {
    console.error('[planning/get] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get planning cycle' },
      { status: 500 }
    )
  }
}
