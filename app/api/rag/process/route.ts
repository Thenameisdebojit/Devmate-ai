import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { promises as fs } from 'fs'
import { join } from 'path'
import { ImageProcessor } from '@/lib/rag/ImageProcessor'
import { PDFProcessor } from '@/lib/rag/PDFProcessor'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for processing

/**
 * POST /api/rag/process
 * Process uploaded files: OCR, captioning, embedding
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

    // Check user role
    const { connectDB } = await import('@/lib/mongodb')
    await connectDB()
    const User = (await import('@/models/User')).default
    const user = await User.findById(currentUser.userId)
    
    if (!user || (user.role !== 'super_user' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only super users can process assets' },
        { status: 403 }
      )
    }

    const { assetIds } = await req.json()

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: 'Asset IDs are required' },
        { status: 400 }
      )
    }

    // Get assets from database
    const RAGAsset = (await import('@/models/RAGAsset')).default
    const assets = await RAGAsset.find({ assetId: { $in: assetIds } })

    if (assets.length === 0) {
      return NextResponse.json(
        { error: 'No assets found' },
        { status: 404 }
      )
    }

    const assetsPath = process.env.RAG_ASSETS_PATH || '.devmate/rag/assets'
    const processedAssets = []

    // Process each asset
    for (const asset of assets) {
      try {
        // Update status to processing
        asset.status = 'processing'
        await asset.save()

        // Read file from disk
        const filePath = join(process.cwd(), assetsPath, asset.filePath)
        const fileBuffer = await fs.readFile(filePath)

        let processedData: {
          extractedText: string
          caption: string
          tags: string[]
        }

        // Process based on modality
        if (asset.modality === 'image') {
          const imageProcessor = new ImageProcessor()
          processedData = await imageProcessor.processImage(fileBuffer, asset.mimeType)
        } else if (asset.modality === 'pdf') {
          const pdfProcessor = new PDFProcessor()
          const pdfData = await pdfProcessor.processPDF(fileBuffer)
          processedData = {
            extractedText: pdfData.extractedText,
            caption: pdfData.caption,
            tags: pdfData.tags,
          }
        } else {
          throw new Error(`Unsupported modality: ${asset.modality}`)
        }

        // Update asset with processed data
        asset.extractedText = processedData.extractedText
        asset.caption = processedData.caption
        asset.tags = processedData.tags
        asset.status = 'completed'
        asset.processedAt = new Date()
        await asset.save()

        processedAssets.push({
          assetId: asset.assetId,
          status: 'completed',
          caption: asset.caption,
          tags: asset.tags,
        })

        // Generate embedding and store in vector DB
        try {
          const { IngestionPipeline } = await import('@/lib/rag/IngestionPipeline')
          const pipeline = new IngestionPipeline()
          const ingestResult = await pipeline.ingestAsset(asset.assetId)
          
          if (!ingestResult.success) {
            console.warn(`[RAG-Process] Failed to ingest asset ${asset.assetId}:`, ingestResult.error)
          }
        } catch (ingestError: any) {
          console.error(`[RAG-Process] Error ingesting asset ${asset.assetId}:`, ingestError)
          // Don't fail the entire process if ingestion fails
        }
      } catch (error: any) {
        console.error(`[RAG-Process] Error processing asset ${asset.assetId}:`, error)
        asset.status = 'error'
        asset.error = error.message
        await asset.save()

        processedAssets.push({
          assetId: asset.assetId,
          status: 'error',
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedAssets,
      count: processedAssets.length,
    })
  } catch (error: any) {
    console.error('[RAG-Process] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process assets' },
      { status: 500 }
    )
  }
}
