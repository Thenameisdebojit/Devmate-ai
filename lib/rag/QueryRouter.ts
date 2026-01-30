import { GoogleGenerativeAI } from '@google/generative-ai'

export type QueryType = 'text_lookup' | 'visual_explanation' | 'diagram_reasoning' | 'document_search' | 'mixed'

/**
 * Routes queries to appropriate retrieval strategy based on intent
 */
export class QueryRouter {
  private genAI: GoogleGenerativeAI

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  /**
   * Classify query intent and determine retrieval strategy
   */
  async classify(
    query: string,
    hasImage: boolean = false
  ): Promise<{
    queryType: QueryType
    modality: 'text' | 'image' | 'mixed'
    confidence: number
  }> {
    try {
      // If query includes image, it's definitely mixed or visual
      if (hasImage) {
        // Determine if it's visual explanation or mixed
        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
        
        const prompt = `Classify this query type. The user has provided both text and an image.

Query: "${query}"

Is this query:
1. "visual_explanation" - Asking about what's shown in the image (e.g., "What does this diagram show?", "Explain this image")
2. "mixed" - Combining text context with image (e.g., "How do I fix the error shown in this photo?", "Compare this diagram with the manual")

Respond with ONLY the type: visual_explanation or mixed`

        const result = await model.generateContent(prompt)
        const response = await result.response
        const classification = response.text().trim().toLowerCase()

        if (classification.includes('visual_explanation') || classification.includes('visual')) {
          return {
            queryType: 'visual_explanation',
            modality: 'image',
            confidence: 0.9,
          }
        } else {
          return {
            queryType: 'mixed',
            modality: 'mixed',
            confidence: 0.85,
          }
        }
      }

      // Text-only query classification
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
      
      const prompt = `Classify this query type:

Query: "${query}"

Classify as one of:
1. "text_lookup" - General text search, information lookup
2. "document_search" - Searching for specific documents or PDFs
3. "diagram_reasoning" - Questions about technical diagrams or visual content (but no image provided)

Respond with ONLY the type: text_lookup, document_search, or diagram_reasoning`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const classification = response.text().trim().toLowerCase()

      if (classification.includes('document') || classification.includes('pdf')) {
        return {
          queryType: 'document_search',
          modality: 'text',
          confidence: 0.8,
        }
      } else if (classification.includes('diagram') || classification.includes('visual')) {
        return {
          queryType: 'diagram_reasoning',
          modality: 'text',
          confidence: 0.75,
        }
      } else {
        return {
          queryType: 'text_lookup',
          modality: 'text',
          confidence: 0.9,
        }
      }
    } catch (error: any) {
      console.error('[QueryRouter] Error classifying query:', error)
      // Default fallback
      return {
        queryType: hasImage ? 'mixed' : 'text_lookup',
        modality: hasImage ? 'mixed' : 'text',
        confidence: 0.5,
      }
    }
  }

  /**
   * Quick classification without LLM (heuristic-based)
   */
  quickClassify(query: string, hasImage: boolean): QueryType {
    if (hasImage) {
      const lowerQuery = query.toLowerCase()
      if (lowerQuery.includes('explain') || lowerQuery.includes('what') || lowerQuery.includes('show')) {
        return 'visual_explanation'
      }
      return 'mixed'
    }

    const lowerQuery = query.toLowerCase()
    if (lowerQuery.includes('document') || lowerQuery.includes('pdf') || lowerQuery.includes('file')) {
      return 'document_search'
    }
    if (lowerQuery.includes('diagram') || lowerQuery.includes('chart') || lowerQuery.includes('graph')) {
      return 'diagram_reasoning'
    }
    return 'text_lookup'
  }
}
