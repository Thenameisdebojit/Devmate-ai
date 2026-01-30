/**
 * PHASE 2: Get Merged Settings API
 * 
 * Returns merged settings for a project (default → user → workspace).
 * This is what the IDE should actually use.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsRegistry } from '@/lib/ide/settings/SettingsRegistry'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    const registry = getSettingsRegistry()
    await registry.initialize()

    // Get merged settings (default → user → workspace)
    const allSettings = registry.getAll(projectId || undefined)

    return NextResponse.json({ settings: allSettings })
  } catch (error: any) {
    console.error('[settings/get] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get settings' },
      { status: 500 }
    )
  }
}
