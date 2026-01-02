/**
 * Runtime API: Terminal Attach
 * 
 * WebSocket endpoint for terminal attachment (PTY).
 * Provides xterm.js-compatible terminal streaming.
 */

import { NextRequest } from 'next/server'
import { containerManager } from '@/lib/runtime/containerManager'
import { Server } from 'socket.io'

// Note: Next.js doesn't natively support WebSocket, so we'll use a workaround
// For production, consider using a separate WebSocket server or upgrading to Next.js with WebSocket support

export const runtime = 'nodejs'
export const maxDuration = 300

// In-memory WebSocket-like handler using SSE for now
// For full WebSocket support, you'd need a separate server or use a library like ws
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return new Response('Project ID is required', { status: 400 })
  }

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        const status = containerManager.getContainerStatus(projectId)
        if (!status || status.status !== 'running') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Container not running' })}\n\n`))
          controller.close()
          return
        }

        // Attach to container's TTY
        const { spawn } = await import('child_process')
        
        // For terminal, we use docker exec with interactive mode
        // This is a simplified version - full PTY would require more setup
        const terminalProcess = spawn('docker', ['exec', '-it', status.id, 'sh'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        // Handle input (from client)
        // Note: SSE is one-way, so we'd need WebSocket for full bidirectional
        // This is a placeholder that shows the structure

        terminalProcess.stdout.on('data', (data) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'output', data: data.toString() })}\n\n`)
          )
        })

        terminalProcess.stderr.on('data', (data) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', data: data.toString() })}\n\n`)
          )
        })

        terminalProcess.on('close', () => {
          controller.close()
        })

        // Cleanup
        req.signal.addEventListener('abort', () => {
          terminalProcess.kill()
          controller.close()
        })
      } catch (error: any) {
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
}

// For full WebSocket support, create a separate WebSocket server
// This is a placeholder showing the structure
export async function POST(req: NextRequest) {
  // Handle terminal input (for WebSocket implementation)
  const { projectId, input } = await req.json()

  if (!projectId) {
    return new Response('Project ID is required', { status: 400 })
  }

  try {
    await containerManager.execInContainer(projectId, input)
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

