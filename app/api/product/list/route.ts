/**
 * PHASE F′-10: List Products API
 * 
 * Lists all products or products for a specific project.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProductMemoryStore } from '@/lib/os/product/ProductMemoryStore'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    const store = getProductMemoryStore()

    if (projectId) {
      // Get products for a specific project
      const products = await store.getProductsForProject(projectId)
      return NextResponse.json({ products })
    } else {
      // Get all products
      const products = await store.getAllProducts()
      return NextResponse.json({ products })
    }
  } catch (error: any) {
    console.error('[product/list] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list products' },
      { status: 500 }
    )
  }
}
