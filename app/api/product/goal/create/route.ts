/**
 * PHASE F′-10: Create Product Goal API
 * 
 * Creates a product-level goal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProductMemoryStore } from '@/lib/os/product/ProductMemoryStore'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { productId, description, relatedProjects, priority = 100 } = await req.json()

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Goal description is required' },
        { status: 400 }
      )
    }

    if (!relatedProjects || !Array.isArray(relatedProjects) || relatedProjects.length === 0) {
      return NextResponse.json(
        { error: 'At least one related project is required' },
        { status: 400 }
      )
    }

    const store = getProductMemoryStore()
    const goal = await store.addProductGoal(productId, {
      description: description.trim(),
      relatedProjects,
      priority: typeof priority === 'number' ? priority : 100,
      status: 'active',
    })

    return NextResponse.json({ goal })
  } catch (error: any) {
    console.error('[product/goal/create] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create product goal' },
      { status: 500 }
    )
  }
}
