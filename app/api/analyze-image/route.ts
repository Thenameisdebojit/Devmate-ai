import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
  throw new Error('At least one of OPENAI_API_KEY or GEMINI_API_KEY environment variable is required')
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      )
    }

    const { image, prompt } = await req.json()

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    let analysisText = ''

    // Try OpenAI first if available
    if (openai && process.env.OPENAI_API_KEY) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // GPT-4o used as API fallback for GPT-5.1 (UI removed, but API still uses it until GPT-5.1 is available)
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || 'Analyze this image and describe what you see in detail.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      })
      analysisText = response.choices[0].message.content || ''
    } else if (gemini) {
      // Fallback to Gemini Vision
      try {
        // Handle image data - if it's a data URL, extract the base64 part
        // Format: data:image/png;base64,iVBOR...
        let imagePart: any
        
        if (image.startsWith('data:')) {
          const [mimeType, base64Data] = image.split(';base64,')
          imagePart = {
            inlineData: {
              mimeType: mimeType.replace('data:', ''),
              data: base64Data
            }
          }
        } else {
          // Assume it's a URL - Gemini API via @google/genai might not support direct URL in some versions
          // For now, we'll try to use it as is or skip if not supported
          // Actually, @google/genai usually expects base64 for inlineData.
          // If we can't process the URL, we might need to fetch it first.
          // For simplicity/safety, we'll warn if it's not a data URL.
          console.warn('Gemini Vision fallback requires base64 data URL. Attempting to use as is.')
          // This might fail if the API expects something else.
          throw new Error('Gemini Vision requires base64 image data')
        }

        // Gemini 1.5 Flash removed from UI, but use as API fallback
        const model = (gemini as any).getGenerativeModel({ model: 'gemini-flash' }) // Try simple format first, falls back to 1.5-flash internally
        const result = await model.generateContent([
          prompt || 'Analyze this image and describe what you see in detail.',
          imagePart
        ])
        analysisText = result.response.text()
      } catch (error: any) {
        console.error('Gemini Vision fallback failed:', error)
        throw new Error(`Vision analysis failed: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      analysis: analysisText
    })
  } catch (error: any) {
    console.error('Image analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    )
  }
}
