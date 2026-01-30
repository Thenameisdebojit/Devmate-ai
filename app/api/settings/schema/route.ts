/**
 * PHASE 2: Settings Schema API
 * 
 * Returns the complete settings schema.
 * No authentication required (schema is public).
 */

import { NextResponse } from 'next/server'
import { SETTINGS_SCHEMA } from '@/lib/ide/settings/SettingsSchema'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json({ schema: SETTINGS_SCHEMA })
  } catch (error: any) {
    console.error('[settings/schema] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get settings schema' },
      { status: 500 }
    )
  }
}
