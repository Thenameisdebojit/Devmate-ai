import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { promises as fs } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

/**
 * GET /api/rag/assets
 * List assets (filtered by access control)
 * Auth: All authenticated users
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { connectDB } = await import('@/lib/mongodb')
    await connectDB()
    const User = (await import('@/models/User')).default
    const user = await User.findById(currentUser.userId)
    const userRole = user?.role || 'base_user'

    const RAGAsset = (await import('@/models/RAGAsset')).default

    // Build query based on access control
    let query: any = {}

    if (userRole === 'base_user') {
      // Base users can only see assets from:
      // 1. Public groups (isPublic: true)
      // 2. Groups they belong to (need to check group membership)
      // For now, we'll implement basic filtering - full group membership check in Phase 5
      query = {
        $or: [
          { groupIds: { $size: 0 } }, // No groups = public
          // TODO: Add group membership check in Phase 5
        ],
      }
    } else if (userRole === 'super_user' || userRole === 'admin') {
      // Super users can see their own assets + all public assets
      query = {
        $or: [
          { userId: String(user._id) },
          { groupIds: { $size: 0 } }, // Public assets
        ],
      }
    }

    const assets = await RAGAsset.find(query)
      .sort({ uploadedAt: -1 })
      .limit(100) // Limit to 100 most recent

    return NextResponse.json({
      success: true,
      assets: assets.map(asset => ({
        id: asset.assetId,
        modality: asset.modality,
        filename: asset.filename,
        caption: asset.caption,
        extracted_text: asset.extractedText,
        tags: asset.tags || [],
        groupIds: asset.groupIds || [],
        uploadedAt: asset.uploadedAt.toISOString(),
        size: asset.size,
      })),
      count: assets.length,
    })
  } catch (error: any) {
    console.error('[RAG-Assets] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list assets' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rag/assets?id=assetId
 * Delete an asset
 * Auth: Super users only (and only their own assets)
 */
export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { connectDB } = await import('@/lib/mongodb')
    await connectDB()
    const User = (await import('@/models/User')).default
    const user = await User.findById(currentUser.userId)
    
    if (!user || (user.role !== 'super_user' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only super users can delete assets' },
        { status: 403 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const assetId = searchParams.get('id')

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      )
    }

    const RAGAsset = (await import('@/models/RAGAsset')).default
    const asset = await RAGAsset.findOne({ assetId })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Check ownership (super users can only delete their own assets, admins can delete any)
    if (user.role !== 'admin' && asset.userId !== String(user._id)) {
      return NextResponse.json(
        { error: 'You can only delete your own assets' },
        { status: 403 }
      )
    }

    // Delete file from disk
    const assetsPath = process.env.RAG_ASSETS_PATH || '.devmate/rag/assets'
    const filePath = join(process.cwd(), assetsPath, asset.filePath)
    try {
      await fs.unlink(filePath)
    } catch (fileError: any) {
      console.warn(`[RAG-Assets] Failed to delete file ${filePath}:`, fileError.message)
      // Continue with DB deletion even if file deletion fails
    }

    // Delete from database
    await RAGAsset.deleteOne({ assetId })

    // TODO: Delete from vector store (Phase 2.3)

    return NextResponse.json({
      success: true,
      message: 'Asset deleted successfully',
    })
  } catch (error: any) {
    console.error('[RAG-Assets] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete asset' },
      { status: 500 }
    )
  }
}
