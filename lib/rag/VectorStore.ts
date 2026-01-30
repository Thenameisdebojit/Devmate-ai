import mongoose from 'mongoose'

/**
 * MongoDB Atlas Vector Store wrapper
 * Manages embeddings in MongoDB with vector search capabilities
 */
export class VectorStore {
  private collection: mongoose.Collection

  constructor() {
    // Collection will be initialized when connected
    this.collection = {} as mongoose.Collection
  }

  /**
   * Initialize the vector store (ensure collection exists)
   */
  async initialize() {
    const { connectDB } = await import('@/lib/mongodb')
    await connectDB()

    // Get MongoDB connection
    const mongoose = await import('mongoose')
    const db = mongoose.default.connection.db
    if (!db) {
      throw new Error('MongoDB connection not available')
    }

    this.collection = db.collection('rag_embeddings')

    // Create indexes if they don't exist
    await this.collection.createIndex({ assetId: 1 }, { unique: true })
    await this.collection.createIndex({ userId: 1 })
    await this.collection.createIndex({ groupIds: 1 })
    await this.collection.createIndex({ modality: 1 })
    await this.collection.createIndex({ createdAt: -1 })

    // Note: Vector search index must be created in MongoDB Atlas UI
    // Index name: rag_embeddings_index
    // Fields: embedding (vector, dimension: 768, similarity: cosine)
  }

  /**
   * Store an embedding
   */
  async storeEmbedding(data: {
    assetId: string
    embedding: number[]
    modality: 'text' | 'image' | 'pdf'
    source: string
    userId: string
    groupIds: string[]
    content: {
      extracted_text: string
      caption: string
      metadata: any
    }
  }): Promise<void> {
    await this.initialize()

    const document = {
      assetId: data.assetId,
      embedding: data.embedding,
      modality: data.modality,
      source: data.source,
      userId: data.userId,
      groupIds: data.groupIds,
      content: data.content,
      createdAt: new Date(),
    }

    // Upsert (update if exists, insert if not)
    await this.collection.updateOne(
      { assetId: data.assetId },
      { $set: document },
      { upsert: true }
    )
  }

  /**
   * Search for similar embeddings using MongoDB Atlas Vector Search
   */
  async search(
    queryEmbedding: number[],
    options: {
      limit?: number
      userId?: string
      groupIds?: string[]
      modality?: 'text' | 'image' | 'pdf'
      minScore?: number
    } = {}
  ): Promise<Array<{
    assetId: string
    score: number
    content: any
    modality: string
  }>> {
    await this.initialize()

    const limit = options.limit || 10
    const minScore = options.minScore || 0.7

    // Build filter for access control
    const filter: any = {}
    if (options.userId) {
      filter.$or = [
        { userId: options.userId },
        { groupIds: { $in: options.groupIds || [] } },
        { groupIds: { $size: 0 } }, // Public assets
      ]
    }
    if (options.modality) {
      filter.modality = options.modality
    }

    // MongoDB Atlas Vector Search aggregation pipeline
    const pipeline = [
      {
        $vectorSearch: {
          index: process.env.VECTOR_SEARCH_INDEX_NAME || 'rag_embeddings_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: limit * 10, // Search more candidates for better results
          limit: limit,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
        },
      },
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: {
          score: { $gte: minScore },
        },
      },
      {
        $project: {
          assetId: 1,
          score: 1,
          content: 1,
          modality: 1,
          source: 1,
        },
      },
    ]

    try {
      const results = await this.collection.aggregate(pipeline).toArray()
      return results.map((doc: any) => ({
        assetId: doc.assetId,
        score: doc.score || 0,
        content: doc.content,
        modality: doc.modality,
      }))
    } catch (error: any) {
      // If vector search is not available, fall back to simple text search
      console.warn('[VectorStore] Vector search not available, using fallback:', error.message)
      return this.fallbackSearch(queryEmbedding, options)
    }
  }

  /**
   * Fallback search when vector search is not available
   */
  private async fallbackSearch(
    queryEmbedding: number[],
    options: {
      limit?: number
      userId?: string
      groupIds?: string[]
      modality?: 'text' | 'image' | 'pdf'
    } = {}
  ): Promise<Array<{
    assetId: string
    score: number
    content: any
    modality: string
  }>> {
    const limit = options.limit || 10

    const filter: any = {}
    if (options.userId) {
      filter.$or = [
        { userId: options.userId },
        { groupIds: { $in: options.groupIds || [] } },
        { groupIds: { $size: 0 } },
      ]
    }
    if (options.modality) {
      filter.modality = options.modality
    }

    // Simple cosine similarity calculation
    const allDocs = await this.collection.find(filter).limit(100).toArray()
    
    const results = allDocs
      .map((doc: any) => {
        if (!doc.embedding || doc.embedding.length !== queryEmbedding.length) {
          return null
        }
        
        // Calculate cosine similarity
        let dotProduct = 0
        let normA = 0
        let normB = 0
        
        for (let i = 0; i < queryEmbedding.length; i++) {
          dotProduct += queryEmbedding[i] * doc.embedding[i]
          normA += queryEmbedding[i] * queryEmbedding[i]
          normB += doc.embedding[i] * doc.embedding[i]
        }
        
        const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
        
        return {
          assetId: doc.assetId,
          score: similarity,
          content: doc.content,
          modality: doc.modality,
        }
      })
      .filter((result: any) => result !== null && result.score > 0.5)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit)

    return results as Array<{
      assetId: string
      score: number
      content: any
      modality: string
    }>
  }

  /**
   * Delete embedding by asset ID
   */
  async deleteEmbedding(assetId: string): Promise<void> {
    await this.initialize()
    await this.collection.deleteOne({ assetId })
  }

  /**
   * Delete all embeddings for a user
   */
  async deleteUserEmbeddings(userId: string): Promise<void> {
    await this.initialize()
    await this.collection.deleteMany({ userId })
  }
}

// Singleton instance
let vectorStoreInstance: VectorStore | null = null

export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore()
  }
  return vectorStoreInstance
}
