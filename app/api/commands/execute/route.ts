/**
 * PHASE 2: Execute Command API
 * 
 * Executes a command with provided context.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCommandRegistry } from '@/lib/ide/commands/CommandRegistry'
import type { CommandContext } from '@/lib/ide/commands/CommandRegistry'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { commandId, context = {} } = await req.json()

    if (!commandId || typeof commandId !== 'string') {
      return NextResponse.json(
        { error: 'Command ID is required' },
        { status: 400 }
      )
    }

    const registry = getCommandRegistry()
    await registry.execute(commandId, context as CommandContext)

    return NextResponse.json({ success: true, commandId })
  } catch (error: any) {
    console.error('[commands/execute] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute command' },
      { status: 500 }
    )
  }
}
