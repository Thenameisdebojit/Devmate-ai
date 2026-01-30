/**
 * PHASE C: Provider Health Check Endpoint
 * 
 * Returns provider readiness status for debugging and diagnostics.
 */

import { NextResponse } from 'next/server'
import { getProviderHealth } from '@/lib/ai/ProviderRouter'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const health = getProviderHealth()
    
    return NextResponse.json({
      providers: health,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to check provider health', message: error.message },
      { status: 500 }
    )
  }
}
