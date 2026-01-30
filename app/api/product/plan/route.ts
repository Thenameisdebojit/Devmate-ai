/**
 * PHASE F′-10: Product Plan API
 * 
 * Generates product-level plan with recommendations.
 * Advisory only - no execution.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ProductPlanningEngine } from '@/lib/os/product/ProductPlanningEngine'

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

    const plan = await ProductPlanningEngine.generateProductPlan(productId)

    if (!plan) {
      return NextResponse.json(
        { error: `Product ${productId} not found` },
        { status: 404 }
      )
    }

    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('[product/plan] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate product plan' },
      { status: 500 }
    )
  }
}
