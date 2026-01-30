/**
 * PHASE F′-5: Goal Creation API
 * 
 * Creates a new goal for a project.
 * Goals must be explicitly created by users - AI cannot invent goals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGoalMemoryStore, type ProjectGoal } from '@/lib/os/goals/GoalMemoryStore'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { projectId, description, priority = 100 } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Goal description is required' },
        { status: 400 }
      )
    }

    const store = getGoalMemoryStore()
    const goal = await store.addGoal(projectId, {
      description: description.trim(),
      priority: typeof priority === 'number' ? priority : 100,
      status: 'active',
    })

    return NextResponse.json({ goal })
  } catch (error: any) {
    console.error('[goals/create] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create goal' },
      { status: 500 }
    )
  }
}
