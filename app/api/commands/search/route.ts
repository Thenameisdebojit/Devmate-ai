/**
 * PHASE 2: Search Commands API
 * 
 * Searches commands by query string.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCommandRegistry } from '@/lib/ide/commands/CommandRegistry'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    const registry = getCommandRegistry()
    const commands = registry.searchCommands(query)

    return NextResponse.json({ commands })
  } catch (error: any) {
    console.error('[commands/search] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search commands' },
      { status: 500 }
    )
  }
}
