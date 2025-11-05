import { NextRequest, NextResponse } from 'next/server'
import { 
  chooseModel, 
  callAIModelWithFailover, 
  streamAIModelWithFailover,
  AIRequest 
} from '@/lib/aiOrchestrator'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      prompt, 
      domain, 
      action, 
      systemInstruction, 
      temperature, 
      maxTokens,
      stream = false 
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'No AI API keys configured' },
        { status: 503 }
      )
    }

    const aiRequest: AIRequest = {
      prompt,
      domain,
      action,
      systemInstruction,
      temperature,
      maxTokens,
      stream,
    }

    if (stream) {
      const selectedModel = chooseModel(prompt, action, domain)
      
      const encoder = new TextEncoder()
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ modelUsed: selectedModel })}\n\n`)
            )
            
            for await (const text of streamAIModelWithFailover(aiRequest)) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              )
            }
            
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error: any) {
            console.error('Streaming error:', error)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
            )
            controller.close()
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      const response = await callAIModelWithFailover(aiRequest)
      
      return NextResponse.json({
        text: response.text,
        modelUsed: response.modelUsed,
      })
    }
  } catch (error: any) {
    console.error('AI API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process AI request' },
      { status: 500 }
    )
  }
}
