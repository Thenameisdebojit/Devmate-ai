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
    // 1. Update extension enabled status in database
    // 2. Deactivate extension hooks
    // 3. Unload extension from memory

    console.log(`[extensions/disable] Disabling extension: ${extensionId}`)

    return NextResponse.json({
      success: true,
      message: `Extension ${extensionId} disabled successfully`,
    })
  } catch (error: any) {
    console.error('[extensions/disable] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to disable extension' },
      { status: 500 }
    )
  }
}
