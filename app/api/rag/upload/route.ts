import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { promises as fs } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large files

/**
 * POST /api/rag/upload
 * Upload multimodal files for RAG knowledge base
 * Auth: Super users only
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check user role (super_user or admin only)
    const { connectDB } = await import('@/lib/mongodb')
    await connectDB()
    const User = (await import('@/models/User')).default
    const user = await User.findById(currentUser.userId)
    
    if (!user || (user.role !== 'super_user' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only super users can upload to knowledge base' },
        { status: 403 }
      )
    }

    // Read form data
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const groupIdsJson = formData.get('groupIds') as string | null
    const groupIds = groupIdsJson ? JSON.parse(groupIdsJson) : []

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Create assets directory
    const assetsPath = process.env.RAG_ASSETS_PATH || '.devmate/rag/assets'
    const assetsDir = join(process.cwd(), assetsPath)
    await fs.mkdir(assetsDir, { recursive: true })

    const uploadedAssets = []

    // Process each file
    for (const file of files) {
      try {
        // Validate file type
        const isImage = file.type.startsWith('image/')
        const isPDF = file.type === 'application/pdf'

        if (!isImage && !isPDF) {
          console.warn(`[RAG-Upload] Skipping unsupported file type: ${file.type}`)
          continue
        }

        // Generate unique asset ID
        const assetId = `asset_${nanoid()}`
        const fileExtension = file.name.split('.').pop() || ''
        const filename = `${assetId}.${fileExtension}`
        const filePath = join(assetsDir, filename)

        // Save file to disk
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        await fs.writeFile(filePath, buffer)

        // Create asset metadata
        const asset = {
          id: assetId,
          filename: file.name,
          filePath: filename, // Relative path
          modality: isImage ? 'image' : 'pdf',
          mimeType: file.type,
          size: file.size,
          userId: String(user._id),
          groupIds: groupIds,
          uploadedAt: new Date().toISOString(),
        }

        uploadedAssets.push(asset)

        // Store asset metadata in MongoDB (temporary storage before processing)
        const { connectDB: connectDBForAsset } = await import('@/lib/mongodb')
        await connectDBForAsset()
        const RAGAsset = (await import('@/models/RAGAsset')).default
        
        await RAGAsset.create({
          assetId,
          filename: file.name,
          filePath: filename,
          modality: asset.modality,
          mimeType: file.type,
          size: file.size,
          userId: String(user._id),
          groupIds: groupIds,
          status: 'pending', // Will be updated to 'processed' after processing
          uploadedAt: new Date(),
        })
      } catch (fileError: any) {
        console.error(`[RAG-Upload] Error processing file ${file.name}:`, fileError)
        // Continue with other files
      }
    }

    return NextResponse.json({
      success: true,
      assets: uploadedAssets,
      count: uploadedAssets.length,
    })
  } catch (error: any) {
    console.error('[RAG-Upload] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload files' },
      { status: 500 }
    )
  }
}
