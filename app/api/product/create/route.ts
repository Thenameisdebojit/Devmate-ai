/**
 * PHASE F′-10: Create Product API
 * 
 * Creates a new product descriptor.
 * Products are created explicitly by user - never auto-created.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProductMemoryStore } from '@/lib/os/product/ProductMemoryStore'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { name, description, projectIds } = await req.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      )
    }

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one project ID is required' },
        { status: 400 }
      )
    }

    const store = getProductMemoryStore()
    const product = await store.createProduct({
      name: name.trim(),
      description: description?.trim(),
      projectIds,
    })

    return NextResponse.json({ product })
  } catch (error: any) {
    console.error('[product/create] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    )
  }
}
