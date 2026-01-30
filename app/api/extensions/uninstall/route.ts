import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { extensionId } = await request.json()

    if (!extensionId) {
      return NextResponse.json(
        { error: 'Extension ID is required' },
        { status: 400 }
      )
    }

    // In production, this would:
    // 1. Unregister extension from database
    // 2. Remove it from extensions directory
    // 3. Clean up any extension-specific data

    console.log(`[extensions/uninstall] Uninstalling extension: ${extensionId}`)

    // Simulate uninstallation delay
    await new Promise(resolve => setTimeout(resolve, 300))

    return NextResponse.json({
      success: true,
      message: `Extension ${extensionId} uninstalled successfully`,
    })
  } catch (error: any) {
    console.error('[extensions/uninstall] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to uninstall extension' },
      { status: 500 }
    )
  }
}
