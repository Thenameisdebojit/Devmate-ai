/**
 * PHASE F′-5: Goal Deletion API
 * 
 * Deletes a goal from a project.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGoalMemoryStore } from '@/lib/os/goals/GoalMemoryStore'

export const runtime = 'nodejs'

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const goalId = searchParams.get('goalId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!goalId) {
      return NextResponse.json(
        { error: 'Goal ID is required' },
        { status: 400 }
      )
    }

    const store = getGoalMemoryStore()
    await store.removeGoal(projectId, goalId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[goals/delete] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete goal' },
      { status: 500 }
    )
  }
}
