import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Generates captions for images using Gemini Vision API
 */
export class CaptionGenerator {
  private genAI: GoogleGenerativeAI

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  /**
   * Generate a descriptive caption for an image
   */
  async generateCaption(imageBase64: string, mimeType: string = 'image/png'): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp' // or 'gemini-1.5-pro-vision'
      })

      const prompt = `Describe this image in detail. Focus on:
- What objects, people, or scenes are visible
- Text content if any (OCR)
- Colors, layout, and composition
- Any technical diagrams, charts, or data visualizations
- Context and purpose if apparent

Provide a comprehensive description that would help someone understand what this image contains.`

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      }

      const result = await model.generateContent([prompt, imagePart])
      const response = await result.response
      const caption = response.text()

      return caption.trim()
    } catch (error: any) {
      console.error('[CaptionGenerator] Error generating caption:', error)
      throw new Error(`Failed to generate caption: ${error.message}`)
    }
  }

  /**
   * Generate tags for an image based on its content
   */
  async generateTags(imageBase64: string, mimeType: string = 'image/png'): Promise<string[]> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp'
      })

      const prompt = `Analyze this image and provide 3-5 relevant tags (single words or short phrases) that describe its content, separated by commas. Focus on:
- Main subjects or objects
- Document type (if applicable)
- Technical domain (if applicable)
- Visual characteristics

Return only the tags, comma-separated, no other text.`

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      }

      const result = await model.generateContent([prompt, imagePart])
      const response = await result.response
      const tagsText = response.text().trim()

      return tagsText.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    } catch (error: any) {
      console.error('[CaptionGenerator] Error generating tags:', error)
      return [] // Return empty tags on error
    }
  }
}
