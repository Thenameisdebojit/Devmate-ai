/**
 * Runtime API: Logs Stream
 * 
 * Streams container logs via Server-Sent Events (SSE).
 */

import { NextRequest } from 'next/server'
import { containerManager } from '@/lib/runtime/containerManager'
import { getWorkspaceDaemon } from '@/core/workspace'

export const runtime = 'nodejs'
export const maxDuration = 300

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
        // Stream logs in real-time
        const status = containerManager.getContainerStatus(projectId)
        if (!status || status.status !== 'running') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Container not running' })}\n\n`))
          controller.close()
          return
        }

        // Use docker logs -f for streaming
        const { spawn } = await import('child_process')
        const dockerProcess = spawn('docker', ['logs', '-f', '--tail', '0', status.id])

        dockerProcess.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean)
          for (const line of lines) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'log', content: line })}\n\n`)
            )
          }
        })

        dockerProcess.stderr.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean)
          for (const line of lines) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', content: line })}\n\n`)
            )
          }
        })

        dockerProcess.on('close', async (code) => {
          // Check if container crashed (exited unexpectedly)
          if (code !== null && code !== 0) {
            // Wait a moment for container to fully exit
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Check container exit code
            const exitCode = await containerManager.checkContainerExitCode(projectId)
            const containerStatus = containerManager.getContainerStatus(projectId)
            
            // If container exited with non-zero code and wasn't stopped by user
            if (exitCode !== null && exitCode !== undefined && exitCode !== 0 && containerStatus?.status !== 'stopped') {
              try {
                const daemon = getWorkspaceDaemon(projectId)
                daemon.dispatch({
                  type: 'RUNTIME_CRASHED',
                  payload: {
                    error: `Container exited with code ${exitCode}`,
                  },
                })
              } catch (daemonError) {
                console.warn('Failed to dispatch RUNTIME_CRASHED event:', daemonError)
              }
            }
          }
          
          controller.close()
        })

        // Cleanup on client disconnect
        req.signal.addEventListener('abort', () => {
          dockerProcess.kill()
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

