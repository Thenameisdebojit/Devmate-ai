/**
 * PHASE F′-10: Get Product API
 * 
 * Retrieves a product by ID.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProductMemoryStore } from '@/lib/os/product/ProductMemoryStore'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const store = getProductMemoryStore()
    const product = await store.getProduct(productId)

    if (!product) {
      return NextResponse.json(
        { error: `Product ${productId} not found` },
        { status: 404 }
      )
    }

    return NextResponse.json({ product })
  } catch (error: any) {
    console.error('[product/get] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get product' },
      { status: 500 }
    )
  }
}
