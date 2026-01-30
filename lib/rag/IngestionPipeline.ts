import { EmbeddingService } from './EmbeddingService'
import { getVectorStore } from './VectorStore'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Complete ingestion pipeline: process → embed → store
 */
export class IngestionPipeline {
  private embeddingService: EmbeddingService
  private vectorStore: ReturnType<typeof getVectorStore>

  constructor() {
    this.embeddingService = new EmbeddingService()
    this.vectorStore = getVectorStore()
  }

  /**
   * Process and ingest an asset
   */
  async ingestAsset(assetId: string): Promise<{
    success: boolean
    assetId: string
    embeddingStored: boolean
    error?: string
  }> {
    try {
      // Get asset from database
      const { connectDB } = await import('@/lib/mongodb')
      await connectDB()
      const RAGAsset = (await import('@/models/RAGAsset')).default
      const asset = await RAGAsset.findOne({ assetId })

      if (!asset) {
        throw new Error(`Asset not found: ${assetId}`)
      }

      if (asset.status !== 'completed') {
        throw new Error(`Asset not processed yet: ${asset.status}`)
      }

      // Read file from disk
      const assetsPath = process.env.RAG_ASSETS_PATH || '.devmate/rag/assets'
      const filePath = join(process.cwd(), assetsPath, asset.filePath)
      const fileBuffer = await fs.readFile(filePath)

      // Generate embedding based on modality
      let embedding: number[]

      if (asset.modality === 'image') {
        const imageBase64 = fileBuffer.toString('base64')
        embedding = await this.embeddingService.embedImage(imageBase64, asset.mimeType)
      } else if (asset.modality === 'pdf') {
        // For PDFs, embed the extracted text
        const textToEmbed = asset.extractedText || asset.caption || ''
        embedding = await this.embeddingService.embedText(textToEmbed)
      } else {
        // For text, embed directly
        const textToEmbed = asset.extractedText || asset.caption || ''
        embedding = await this.embeddingService.embedText(textToEmbed)
      }

      // Store in vector database
      await this.vectorStore.storeEmbedding({
        assetId: asset.assetId,
        embedding,
        modality: asset.modality,
        source: 'user_upload',
        userId: asset.userId,
        groupIds: asset.groupIds || [],
        content: {
          extracted_text: asset.extractedText || '',
          caption: asset.caption || '',
          metadata: {
            filename: asset.filename,
            mimeType: asset.mimeType,
            size: asset.size,
            tags: asset.tags || [],
          },
        },
      })

      return {
        success: true,
        assetId,
        embeddingStored: true,
      }
    } catch (error: any) {
      console.error(`[IngestionPipeline] Error ingesting asset ${assetId}:`, error)
      return {
        success: false,
        assetId,
        embeddingStored: false,
        error: error.message,
      }
    }
  }

  /**
   * Batch ingest multiple assets
   */
  async ingestAssets(assetIds: string[]): Promise<Array<{
    assetId: string
    success: boolean
    error?: string
  }>> {
    const results = []

    for (const assetId of assetIds) {
      const result = await this.ingestAsset(assetId)
      results.push({
        assetId: result.assetId,
        success: result.success,
        error: result.error,
      })
    }

    return results
  }
}
