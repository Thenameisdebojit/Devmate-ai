/**
 * Local Terminal API Route (DEPRECATED)
 * 
 * Creates a local PowerShell/CMD terminal session that works without Docker containers.
 * This provides a functional terminal in the IDE for local development.
 * 
 * @deprecated This route uses SSE (Server-Sent Events) which is unidirectional.
 * Use the WebSocket terminal API at /api/terminal/ws for full bidirectional communication.
 * This route is kept for backward compatibility and will be removed in a future version.
 */

import { NextRequest, NextResponse } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'
import { promises as fs } from 'fs'

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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'terminal/local/route.ts:34',message:'SSE GET request',data:{projectId:projectId||'null',hasProjectId:!!projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
  // #endregion
  console.log('[Terminal API] SSE GET request:', { projectId })

  if (!projectId) {
    return new Response('Project ID is required', { status: 400 })
  }

  // Get or create terminal session
  let session = terminalSessions.get(projectId)
  
  if (!session || session.process.killed || !session.process.stdin?.writable) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'terminal/local/route.ts:48',message:'Creating new terminal session',data:{projectId,hasExistingSession:!!session},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
    // #endregion
    console.log('[Terminal API] Creating new terminal session:', { projectId, hasExistingSession: !!session })
    // Determine shell based on OS
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'powershell.exe' : '/bin/bash'
    const shellArgs = isWindows ? ['-NoLogo', '-NoExit'] : ['-l'] // -l for login shell on Unix

    // Get workspace root if projectId provided
    let workspaceRoot = process.cwd()
    if (projectId) {
      // PHASE F: Use ProjectRootManager for consistent project root paths
      try {
        const { getProjectRootManager } = await import('@/lib/workspace/ProjectRootManager')
        const rootManager = getProjectRootManager()
        workspaceRoot = await rootManager.getProjectRoot(projectId)
      } catch (error) {
        // Fallback to old path if ProjectRootManager fails
        console.warn(`Failed to get project root from ProjectRootManager, using fallback:`, error)
        workspaceRoot = join(process.cwd(), 'runtime-projects', projectId)
        try {
          await fs.mkdir(workspaceRoot, { recursive: true })
        } catch (mkdirError) {
          console.warn(`Failed to create workspace directory: ${workspaceRoot}`, mkdirError)
        }
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'terminal/local/route.ts:110',message:'SSE stream started',data:{projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      console.log('[Terminal API] SSE stream started:', { projectId })
      
      // Send connection confirmation
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', projectId })}\n\n`)
      )

      // Subscribe to terminal events
      const onOutput = (data: { projectId: string; data: string }) => {
        if (data.projectId === projectId) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'output', data: data.data })}\n\n`)
            )
          } catch (error) {
            console.error('[Terminal API] Error enqueueing output:', error)
          }
        }
      }

      const onError = (data: { projectId: string; data: string }) => {
        if (data.projectId === projectId) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', data: data.data })}\n\n`)
            )
          } catch (error) {
            console.error('[Terminal API] Error enqueueing error:', error)
          }
        }
      }

      const onClose = (data: { projectId: string; code: number | null }) => {
        if (data.projectId === projectId) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'close', code: data.code })}\n\n`)
            )
            controller.close()
          } catch (error) {
            console.error('[Terminal API] Error closing stream:', error)
          }
        }
      }

      terminalEvents.on('output', onOutput)
      terminalEvents.on('error', onError)
      terminalEvents.on('close', onClose)

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'terminal/local/route.ts:155',message:'SSE stream aborted',data:{projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        console.log('[Terminal API] SSE stream aborted:', { projectId })
        terminalEvents.off('output', onOutput)
        terminalEvents.off('error', onError)
        terminalEvents.off('close', onClose)
        try {
          controller.close()
        } catch (error) {
          console.error('[Terminal API] Error closing controller on abort:', error)
        }
      })
      
      // Send periodic heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch (error) {
          clearInterval(heartbeatInterval)
        }
      }, 30000) // Every 30 seconds
      
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
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

    if (input && input.trim().length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'terminal/local/route.ts:190',message:'Sending command to terminal',data:{projectId,inputLength:input.length,inputPreview:input.substring(0,200).replace(/\r\n/g,'\\r\\n')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      // Log the command being sent (for debugging)
      console.log('[Terminal API] Sending command to terminal:', { projectId, inputLength: input.length, inputPreview: input.substring(0, 200).replace(/\r\n/g, '\\r\\n') })
      try {
        session.process.stdin.write(input)
      } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'terminal/local/route.ts:195',message:'Error writing to stdin',data:{projectId,error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        console.error('[Terminal API] Error writing to stdin:', error)
        return NextResponse.json(
          { error: `Failed to write to terminal: ${error.message}` },
          { status: 500 }
        )
      }
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'terminal/local/route.ts:203',message:'Received empty input',data:{projectId,inputLength:input?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      console.warn('[Terminal API] Received empty input:', { projectId, inputLength: input?.length || 0 })
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
