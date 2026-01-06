/**
 * Local Terminal API Route
 * 
 * Creates a local PowerShell/CMD terminal session that works without Docker containers.
 * This provides a functional terminal in the IDE for local development.
 */

import { NextRequest, NextResponse } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

export const runtime = 'nodejs'
export const maxDuration = 300

// Store terminal sessions in memory
const terminalSessions = new Map<string, {
  process: ChildProcess
  projectId: string
  createdAt: number
}>()

// Event emitter for terminal output
const terminalEvents = new EventEmitter()

/**
 * GET: Stream terminal output via SSE
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return new Response('Project ID is required', { status: 400 })
  }

  // Get or create terminal session
  let session = terminalSessions.get(projectId)
  
  if (!session || session.process.killed) {
    // Determine shell based on OS
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'powershell.exe' : '/bin/bash'
    const shellArgs = isWindows ? ['-NoLogo', '-NoExit'] : ['-l'] // -l for login shell on Unix

    // Get workspace root if projectId provided
    let workspaceRoot = process.cwd()
    if (projectId) {
      workspaceRoot = join(process.cwd(), 'runtime-projects', projectId)
      // Ensure directory exists
      try {
        await fs.mkdir(workspaceRoot, { recursive: true })
      } catch (error) {
        console.warn(`Failed to create workspace directory: ${workspaceRoot}`, error)
      }
    }

    // Spawn local shell process with proper working directory
    const terminalProcess = spawn(shell, shellArgs, {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    })

    // Handle terminal output
    terminalProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      terminalEvents.emit('output', { projectId, data: output })
    })

    terminalProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString()
      terminalEvents.emit('error', { projectId, data: output })
    })

    terminalProcess.on('close', (code) => {
      terminalEvents.emit('close', { projectId, code })
      terminalSessions.delete(projectId)
    })

    terminalProcess.on('error', (error) => {
      terminalEvents.emit('error', { projectId, data: error.message })
    })

    session = {
      process: terminalProcess,
      projectId,
      createdAt: Date.now(),
    }
    terminalSessions.set(projectId, session)
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      // Send connection confirmation
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', projectId })}\n\n`)
      )

      // Subscribe to terminal events
      const onOutput = (data: { projectId: string; data: string }) => {
        if (data.projectId === projectId) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'output', data: data.data })}\n\n`)
          )
        }
      }

      const onError = (data: { projectId: string; data: string }) => {
        if (data.projectId === projectId) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', data: data.data })}\n\n`)
          )
        }
      }

      const onClose = (data: { projectId: string; code: number | null }) => {
        if (data.projectId === projectId) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'close', code: data.code })}\n\n`)
          )
          controller.close()
        }
      }

      terminalEvents.on('output', onOutput)
      terminalEvents.on('error', onError)
      terminalEvents.on('close', onClose)

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        terminalEvents.off('output', onOutput)
        terminalEvents.off('error', onError)
        terminalEvents.off('close', onClose)
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
 * POST: Send input to terminal
 */
export async function POST(req: NextRequest) {
  try {
    const { projectId, input, resize } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const session = terminalSessions.get(projectId)
    if (!session || session.process.killed) {
      return NextResponse.json(
        { error: 'Terminal session not found' },
        { status: 404 }
      )
    }

    if (input) {
      session.process.stdin.write(input)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to send input' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Close terminal session
 */
export async function DELETE(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 }
    )
  }

  const session = terminalSessions.get(projectId)
  if (session) {
    session.process.kill()
    terminalSessions.delete(projectId)
  }

  return NextResponse.json({ success: true })
}
