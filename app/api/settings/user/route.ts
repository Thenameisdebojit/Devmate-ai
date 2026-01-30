/**
 * PHASE 2: User Settings API
 * 
 * GET: Returns user settings
 * POST: Updates user settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsRegistry } from '@/lib/ide/settings/SettingsRegistry'
import { validateSetting, type SettingScope } from '@/lib/ide/settings/SettingsSchema'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const registry = getSettingsRegistry()
    await registry.initialize()
    
    const userSettings = registry.getUserSettings()
    return NextResponse.json({ settings: userSettings })
  } catch (error: any) {
    console.error('[settings/user] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get user settings' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json()

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      )
    }

    const registry = getSettingsRegistry()
    await registry.initialize()

    // Validate setting
    const validation = validateSetting(key, value)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Set user-scoped setting
    await registry.set(key, value, 'user')

    return NextResponse.json({ success: true, key, value })
  } catch (error: any) {
    console.error('[settings/user] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to set user setting' },
      { status: 500 }
    )
  }
}
