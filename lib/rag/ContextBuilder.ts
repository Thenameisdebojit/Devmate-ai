import { RetrievalResult } from './Retriever'

export interface BuiltContext {
  textChunks: Array<{
    content: string
    source: string
    score: number
    assetId: string
  }>
  imageReferences: Array<{
    caption: string
    assetId: string
    score: number
  }>
  metadata: {
    totalResults: number
    modalities: string[]
  }
}

/**
 * Builds grounded context from retrieval results for LLM
 */
export class ContextBuilder {
  /**
   * Build structured context from retrieval results
   */
  build(retrievalResults: RetrievalResult[]): BuiltContext {
    const textChunks: BuiltContext['textChunks'] = []
    const imageReferences: BuiltContext['imageReferences'] = []
    const modalities = new Set<string>()

    for (const result of retrievalResults) {
      modalities.add(result.modality)

      if (result.modality === 'image') {
        // For images, use caption as the main content
        imageReferences.push({
          caption: result.content.caption || result.content.extracted_text || 'Image',
          assetId: result.assetId,
          score: result.score,
        })
      } else {
        // For text/PDF, use extracted text
        const content = result.content.extracted_text || result.content.caption || ''
        if (content.trim().length > 0) {
          textChunks.push({
            content: content.substring(0, 1000), // Limit chunk size
            source: result.content.metadata?.filename || result.assetId,
            score: result.score,
            assetId: result.assetId,
          })
        }
      }
    }

    return {
      textChunks,
      imageReferences,
      metadata: {
        totalResults: retrievalResults.length,
        modalities: Array.from(modalities),
      },
    }
  }

  /**
   * Format context as prompt for LLM
   */
  formatAsPrompt(context: BuiltContext, userQuery: string): string {
    let prompt = `You are answering a user's question using the following retrieved context from a knowledge base:\n\n`

    // Add text chunks
    if (context.textChunks.length > 0) {
      prompt += `## Text References:\n\n`
      context.textChunks.forEach((chunk, idx) => {
        prompt += `[${idx + 1}] Source: ${chunk.source}\n`
        prompt += `Content: ${chunk.content}\n`
        prompt += `(Relevance score: ${chunk.score.toFixed(2)})\n\n`
      })
    }

    // Add image references
    if (context.imageReferences.length > 0) {
      prompt += `## Image References:\n\n`
      context.imageReferences.forEach((img, idx) => {
        prompt += `[Image ${idx + 1}] ${img.caption}\n`
        prompt += `(Relevance score: ${img.score.toFixed(2)})\n\n`
      })
    }

    prompt += `## User Question:\n${userQuery}\n\n`
    prompt += `## Instructions:\n`
    prompt += `- Answer the user's question using the provided context\n`
    prompt += `- Cite sources using [1], [2], etc. for text references and [Image 1], [Image 2], etc. for images\n`
    prompt += `- If the context doesn't contain relevant information, say so clearly\n`
    prompt += `- Be specific and accurate based on the retrieved content\n`

    return prompt
  }

  /**
   * Format context for vision-capable LLM (includes image data)
   */
  formatAsVisionPrompt(
    context: BuiltContext,
    userQuery: string,
    userImage?: string
  ): {
    textPrompt: string
    imageData?: string
  } {
    let textPrompt = `You are answering a user's question using retrieved context from a knowledge base.\n\n`

    // Add text chunks
    if (context.textChunks.length > 0) {
      textPrompt += `## Retrieved Text Context:\n\n`
      context.textChunks.forEach((chunk, idx) => {
        textPrompt += `[${idx + 1}] ${chunk.content}\n`
        textPrompt += `(Source: ${chunk.source}, Relevance: ${chunk.score.toFixed(2)})\n\n`
      })
    }

    // Add image references
    if (context.imageReferences.length > 0) {
      textPrompt += `## Retrieved Image Descriptions:\n\n`
      context.imageReferences.forEach((img, idx) => {
        textPrompt += `[Image ${idx + 1}] ${img.caption}\n`
        textPrompt += `(Relevance: ${img.score.toFixed(2)})\n\n`
      })
    }

    textPrompt += `## User Question:\n${userQuery}\n\n`
    textPrompt += `Answer using the provided context. If the user provided an image, analyze it along with the retrieved context.`

    return {
      textPrompt,
      imageData: userImage,
    }
  }
}
