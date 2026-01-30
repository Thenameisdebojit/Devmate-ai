import pdfParse from 'pdf-parse'
import { CaptionGenerator } from './CaptionGenerator'

/**
 * Processes PDFs: extract text and generate summary caption
 */
export class PDFProcessor {
  private captionGenerator: CaptionGenerator

  constructor() {
    this.captionGenerator = new CaptionGenerator()
  }

  /**
   * Process a PDF: extract text and generate summary
   */
  async processPDF(pdfBuffer: Buffer): Promise<{
    extractedText: string
    caption: string
    tags: string[]
    pageCount: number
  }> {
    try {
      // Extract text from PDF
      const pdfData = await pdfParse(pdfBuffer)
      const extractedText = pdfData.text
      const pageCount = pdfData.numpages

      // Generate a summary caption from the extracted text
      // For PDFs, we'll use the first 1000 characters to generate a caption
      const textPreview = extractedText.substring(0, 1000)
      const caption = await this.generateTextCaption(textPreview)

      // Generate tags from the text content
      const tags = await this.generateTagsFromText(textPreview)

      return {
        extractedText,
        caption,
        tags,
        pageCount,
      }
    } catch (error: any) {
      console.error('[PDFProcessor] Error processing PDF:', error)
      throw new Error(`Failed to process PDF: ${error.message}`)
    }
  }

  /**
   * Generate a caption/summary from text content
   */
  private async generateTextCaption(text: string): Promise<string> {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured')
      }

      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

      const prompt = `Summarize the following document content in 2-3 sentences. Focus on the main topic, purpose, and key information:

${text}

Provide a concise summary:`

      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text().trim()
    } catch (error: any) {
      console.error('[PDFProcessor] Error generating caption:', error)
      // Fallback: use first 200 characters
      return text.substring(0, 200) + (text.length > 200 ? '...' : '')
    }
  }

  /**
   * Generate tags from text content
   */
  private async generateTagsFromText(text: string): Promise<string[]> {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return []
      }

      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

      const prompt = `Analyze this document text and provide 3-5 relevant tags (single words or short phrases) that describe its content, separated by commas:

${text.substring(0, 500)}

Return only the tags, comma-separated, no other text.`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const tagsText = response.text().trim()

      return tagsText.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    } catch (error: any) {
      console.error('[PDFProcessor] Error generating tags:', error)
      return []
    }
  }

  /**
   * Validate PDF file
   */
  static validatePDF(file: { size: number; type: string }): { valid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024 // 50MB
    const allowedTypes = ['application/pdf']

    if (file.size > maxSize) {
      return { valid: false, error: 'PDF size exceeds 50MB limit' }
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: `Unsupported file type: ${file.type}` }
    }

    return { valid: true }
  }
}
