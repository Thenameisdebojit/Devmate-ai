/**
 * Runtime API: Terminal Attach
 * 
 * Delegates to RuntimeKernel for PTY attachment.
 * NO PTY creation here - kernel owns all PTY lifecycle.
 * 
 * Uses SSE for now (Next.js limitation), but delegates to persistent PTY in kernel.
 */

import { NextRequest } from 'next/server'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * GET: Stream terminal output via SSE
 * Delegates to RuntimeKernel - attaches to existing PTY or creates one
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return new Response('Project ID is required', { status: 400 })
  }

  // Get RuntimeKernel instance
  const kernel = RuntimeKernel.get(projectId)

  // Attach to PTY (reuses existing or creates new)
  let ptySession
  try {
    ptySession = kernel.attachPTY()
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to attach PTY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      // Send connection confirmation
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', sessionId: ptySession.sessionId })}\n\n`)
      )

      // Subscribe to PTY output
      const onOutput = (data: { sessionId: string; data: string }) => {
        if (data.sessionId === ptySession.sessionId) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'output', data: data.data })}\n\n`)
          )
        }
      }

      const onError = (data: { sessionId: string; data: string }) => {
        if (data.sessionId === ptySession.sessionId) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', data: data.data })}\n\n`)
          )
        }
      }

      const onClose = (data: { sessionId: string; code: number | null }) => {
        if (data.sessionId === ptySession.sessionId) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'close', code: data.code })}\n\n`)
          )
          controller.close()
        }
      }

      kernel.on('ptyOutput', onOutput)
      kernel.on('ptyError', onError)
      kernel.on('ptyClose', onClose)

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        kernel.off('ptyOutput', onOutput)
        kernel.off('ptyError', onError)
        kernel.off('ptyClose', onClose)
        // DO NOT kill PTY - it persists across reconnects
        controller.close()
      })
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

/**
 * POST: Send input to PTY
 * Delegates to RuntimeKernel
 */
export async function POST(req: NextRequest) {
  const { projectId, input, resize } = await req.json()

  if (!projectId) {
    return new Response('Project ID is required', { status: 400 })
  }

  try {
    const kernel = RuntimeKernel.get(projectId)

    if (resize && resize.cols && resize.rows) {
      kernel.resizePTY(resize.cols, resize.rows)
    }

    if (input) {
      kernel.writeToPTY(input)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

