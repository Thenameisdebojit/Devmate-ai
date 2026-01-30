import { CaptionGenerator } from './CaptionGenerator'

/**
 * Processes images: OCR and captioning
 */
export class ImageProcessor {
  private captionGenerator: CaptionGenerator

  constructor() {
    this.captionGenerator = new CaptionGenerator()
  }

  /**
   * Process an image: extract text (OCR) and generate caption
   */
  async processImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/png'
  ): Promise<{
    extractedText: string
    caption: string
    tags: string[]
  }> {
    try {
      // Convert buffer to base64
      const imageBase64 = imageBuffer.toString('base64')

      // Generate caption and tags using Gemini Vision
      const [caption, tags] = await Promise.all([
        this.captionGenerator.generateCaption(imageBase64, mimeType),
        this.captionGenerator.generateTags(imageBase64, mimeType),
      ])

      // Extract text from caption (Gemini Vision can read text in images)
      // The caption will include any visible text, so we use it as extracted text
      const extractedText = caption

      return {
        extractedText,
        caption,
        tags,
      }
    } catch (error: any) {
      console.error('[ImageProcessor] Error processing image:', error)
      throw new Error(`Failed to process image: ${error.message}`)
    }
  }

  /**
   * Validate image file
   */
  static validateImage(file: { size: number; type: string }): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']

    if (file.size > maxSize) {
      return { valid: false, error: 'Image size exceeds 10MB limit' }
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: `Unsupported image type: ${file.type}` }
    }

    return { valid: true }
  }
}
