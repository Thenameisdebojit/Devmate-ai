/**
 * PHASE 2: Commands List API
 * 
 * Returns all available commands.
 */

import { NextResponse } from 'next/server'
import { getCommandRegistry } from '@/lib/ide/commands/CommandRegistry'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const registry = getCommandRegistry()
    const commands = registry.getAllCommands()

    return NextResponse.json({ commands })
  } catch (error: any) {
    console.error('[commands/list] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list commands' },
      { status: 500 }
    )
  }
}
