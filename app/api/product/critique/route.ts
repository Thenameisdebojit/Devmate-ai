/**
 * PHASE F′-10: Product Critique API
 * 
 * Generates product-level critique report.
 * Advisory only - no fixes, no execution.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ProductCritiqueEngine } from '@/lib/os/product/ProductCritiqueEngine'

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

    const report = await ProductCritiqueEngine.generateProductCritique(productId)

    if (!report) {
      return NextResponse.json(
        { error: `Product ${productId} not found` },
        { status: 404 }
      )
    }

    return NextResponse.json({ report })
  } catch (error: any) {
    console.error('[product/critique] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate product critique' },
      { status: 500 }
    )
  }
}
