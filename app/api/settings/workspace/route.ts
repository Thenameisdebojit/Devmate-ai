/**
 * PHASE 2: Workspace Settings API
 * 
 * GET: Returns workspace settings for a project
 * POST: Updates workspace settings for a project
 * 
 * Requires projectId query parameter.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsRegistry } from '@/lib/ide/settings/SettingsRegistry'
import { validateSetting } from '@/lib/ide/settings/SettingsSchema'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const registry = getSettingsRegistry()
    await registry.initialize()

    // Load workspace settings if not already loaded
    const workspaceSettings = registry.getWorkspaceSettings(projectId)

    return NextResponse.json({ settings: workspaceSettings })
  } catch (error: any) {
    console.error('[settings/workspace] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get workspace settings' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { key, value, projectId } = await req.json()

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      )
    }

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'Project ID is required' },
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

    // Set workspace-scoped setting
    await registry.set(key, value, 'workspace', projectId)

    return NextResponse.json({ success: true, key, value })
  } catch (error: any) {
    console.error('[settings/workspace] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to set workspace setting' },
      { status: 500 }
    )
  }
}
