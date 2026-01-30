/**
 * PHASE F′-5: Goal Update API
 * 
 * Updates an existing goal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGoalMemoryStore } from '@/lib/os/goals/GoalMemoryStore'

export const runtime = 'nodejs'

export async function PUT(req: NextRequest) {
  try {
    const { projectId, goalId, description, priority, status } = await req.json()

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

    const patch: any = {}
    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return NextResponse.json(
          { error: 'Goal description must be a non-empty string' },
          { status: 400 }
        )
      }
      patch.description = description.trim()
    }

    if (priority !== undefined) {
      if (typeof priority !== 'number') {
        return NextResponse.json(
          { error: 'Priority must be a number' },
          { status: 400 }
        )
      }
      patch.priority = priority
    }

    if (status !== undefined) {
      if (!['active', 'completed', 'abandoned'].includes(status)) {
        return NextResponse.json(
          { error: 'Status must be one of: active, completed, abandoned' },
          { status: 400 }
        )
      }
      patch.status = status
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const store = getGoalMemoryStore()
    const goal = await store.updateGoal(projectId, goalId, patch)

    return NextResponse.json({ goal })
  } catch (error: any) {
    console.error('[goals/update] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update goal' },
      { status: 500 }
    )
  }
}
