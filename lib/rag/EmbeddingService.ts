import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Multimodal embedding service using Gemini
 */
export class EmbeddingService {
  private genAI: GoogleGenerativeAI

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  /**
   * Generate embedding for text
   */
  async embedText(text: string): Promise<number[]> {
    try {
      // Use Gemini text embedding model
      // Note: Gemini doesn't have a dedicated embedding API like OpenAI
      // We'll use text-embedding-004 or generate a description and embed that
      
      // For now, we'll use a workaround: generate a concise description and use that
      // In production, you might want to use a dedicated embedding service
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
      
      // Generate a concise representation of the text
      const prompt = `Create a concise, searchable representation of this content in 2-3 sentences:

${text.substring(0, 2000)}

Representation:`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const representation = response.text().trim()

      // For now, return a simple hash-based embedding
      // TODO: Use proper embedding model when available
      // This is a placeholder - in production, use a proper embedding service
      return this.textToEmbedding(representation)
    } catch (error: any) {
      console.error('[EmbeddingService] Error embedding text:', error)
      throw new Error(`Failed to embed text: ${error.message}`)
    }
  }

  /**
   * Generate embedding for image
   * Since Gemini doesn't have direct image embeddings, we'll:
   * 1. Generate a text description using Vision API
   * 2. Embed that description
   */
  async embedImage(imageBase64: string, mimeType: string = 'image/png'): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

      const prompt = `Describe this image in detail for search purposes. Include:
- Main subjects and objects
- Text content if visible
- Colors, layout, composition
- Context and purpose

Description:`

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      }

      const result = await model.generateContent([prompt, imagePart])
      const response = await result.response
      const description = response.text().trim()

      // Embed the description
      return this.embedText(description)
    } catch (error: any) {
      console.error('[EmbeddingService] Error embedding image:', error)
      throw new Error(`Failed to embed image: ${error.message}`)
    }
  }

  /**
   * Generate multimodal embedding (text + optional image)
   */
  async embedMultimodal(text: string, imageBase64?: string, mimeType?: string): Promise<number[]> {
    if (imageBase64) {
      // Combine text with image description
      const imageEmbedding = await this.embedImage(imageBase64, mimeType)
      const textEmbedding = await this.embedText(text)
      
      // Combine embeddings (simple average for now)
      // In production, use proper multimodal embedding model
      return this.combineEmbeddings([textEmbedding, imageEmbedding])
    } else {
      return this.embedText(text)
    }
  }

  /**
   * Convert text to embedding vector (placeholder implementation)
   * TODO: Replace with actual embedding model
   */
  private textToEmbedding(text: string): number[] {
    // This is a placeholder - in production, use a proper embedding model
    // For now, create a simple hash-based vector
    const dimension = 768 // Standard embedding dimension
    const vector: number[] = new Array(dimension).fill(0)
    
    // Simple hash-based embedding (not production-ready)
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      const index = charCode % dimension
      vector[index] += charCode / 1000
    }
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    if (magnitude > 0) {
      return vector.map(val => val / magnitude)
    }
    
    return vector
  }

  /**
   * Combine multiple embeddings (simple average)
   */
  private combineEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return []
    if (embeddings.length === 1) return embeddings[0]

    const dimension = embeddings[0].length
    const combined = new Array(dimension).fill(0)

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        combined[i] += embedding[i]
      }
    }

    // Average
    for (let i = 0; i < dimension; i++) {
      combined[i] /= embeddings.length
    }

    // Normalize
    const magnitude = Math.sqrt(combined.reduce((sum, val) => sum + val * val, 0))
    if (magnitude > 0) {
      return combined.map(val => val / magnitude)
    }

    return combined
  }
}
