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
    // 2. Load extension if not already loaded
    // 3. Activate extension hooks

    console.log(`[extensions/enable] Enabling extension: ${extensionId}`)

    return NextResponse.json({
      success: true,
      message: `Extension ${extensionId} enabled successfully`,
    })
  } catch (error: any) {
    console.error('[extensions/enable] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to enable extension' },
      { status: 500 }
    )
  }
}
