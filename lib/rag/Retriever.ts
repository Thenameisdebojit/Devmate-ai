import { getVectorStore } from './VectorStore'
import { EmbeddingService } from './EmbeddingService'
import { QueryType } from './QueryRouter'
import { AccessControl } from './AccessControl'

export interface RetrievalResult {
  assetId: string
  score: number
  content: {
    extracted_text: string
    caption: string
    metadata: any
  }
  modality: string
}

/**
 * Modality-aware retriever with access control
 */
export class Retriever {
  private vectorStore: ReturnType<typeof getVectorStore>
  private embeddingService: EmbeddingService
  private accessControl: AccessControl

  constructor() {
    this.vectorStore = getVectorStore()
    this.embeddingService = new EmbeddingService()
    this.accessControl = new AccessControl()
  }

  /**
   * Retrieve text-based results
   */
  async retrieveText(
    query: string,
    userId: string,
    groupIds: string[] | undefined,
    limit: number = 5
  ): Promise<RetrievalResult[]> {
    try {
      // Get user groups if not provided
      const userGroupIds = groupIds || await this.accessControl.getUserGroups(userId)

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.embedText(query)

      // Search vector store
      const results = await this.vectorStore.search(queryEmbedding, {
        limit,
        userId,
        groupIds: userGroupIds,
        modality: 'text',
        minScore: 0.6,
      })

      return results
    } catch (error: any) {
      console.error('[Retriever] Error retrieving text:', error)
      return []
    }
  }

  /**
   * Retrieve image-based results
   */
  async retrieveImage(
    queryImage: string, // base64 image
    userId: string,
    groupIds: string[] | undefined,
    limit: number = 5
  ): Promise<RetrievalResult[]> {
    try {
      // Get user groups if not provided
      const userGroupIds = groupIds || await this.accessControl.getUserGroups(userId)

      // Generate image embedding
      const queryEmbedding = await this.embeddingService.embedImage(queryImage)

      // Search vector store
      const results = await this.vectorStore.search(queryEmbedding, {
        limit,
        userId,
        groupIds: userGroupIds,
        modality: 'image',
        minScore: 0.6,
      })

      return results
    } catch (error: any) {
      console.error('[Retriever] Error retrieving image:', error)
      return []
    }
  }

  /**
   * Retrieve mixed (text + image) results
   */
  async retrieveMixed(
    query: string,
    queryImage: string | undefined,
    userId: string,
    groupIds: string[] | undefined,
    limit: number = 5
  ): Promise<RetrievalResult[]> {
    try {
      // Get user groups if not provided
      const userGroupIds = groupIds || await this.accessControl.getUserGroups(userId)

      let queryEmbedding: number[]

      if (queryImage) {
        // Generate multimodal embedding
        queryEmbedding = await this.embeddingService.embedMultimodal(query, queryImage)
      } else {
        // Text-only embedding
        queryEmbedding = await this.embeddingService.embedText(query)
      }

      // Search across all modalities
      const results = await this.vectorStore.search(queryEmbedding, {
        limit,
        userId,
        groupIds: userGroupIds,
        minScore: 0.6,
      })

      return results
    } catch (error: any) {
      console.error('[Retriever] Error retrieving mixed:', error)
      return []
    }
  }

  /**
   * Retrieve based on query type
   */
  async retrieve(
    queryType: QueryType,
    query: string,
    queryImage: string | undefined,
    userId: string,
    groupIds: string[] | undefined,
    limit: number = 5
  ): Promise<RetrievalResult[]> {
    switch (queryType) {
      case 'text_lookup':
      case 'document_search':
        return this.retrieveText(query, userId, groupIds, limit)
      
      case 'visual_explanation':
        if (queryImage) {
          return this.retrieveImage(queryImage, userId, groupIds, limit)
        }
        // Fallback to text search if no image provided
        return this.retrieveText(query, userId, groupIds, limit)
      
      case 'diagram_reasoning':
        // Search for images/diagrams using text query
        return this.retrieveText(query, userId, groupIds, limit)
      
      case 'mixed':
        return this.retrieveMixed(query, queryImage, userId, groupIds, limit)
      
      default:
        return this.retrieveText(query, userId, groupIds, limit)
    }
  }
}
