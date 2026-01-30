/**
 * PHASE F′-5: Goals List API
 * 
 * Lists all goals for a project.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGoalMemoryStore } from '@/lib/os/goals/GoalMemoryStore'

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

    const store = getGoalMemoryStore()
    const goals = await store.getGoals(projectId)

    return NextResponse.json({ goals })
  } catch (error: any) {
    console.error('[goals/list] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list goals' },
      { status: 500 }
    )
  }
}
