/**
 * Terminal Server
 * 
 * WebSocket server for terminal streaming (xterm.js compatible).
 * Uses a separate WebSocket server for full bidirectional communication.
 * 
 * NOTE: This requires a separate WebSocket server process or Next.js WebSocket support.
 * For now, this is a structure that can be implemented with ws library.
 */

import { WebSocketServer, WebSocket } from 'ws'
import { containerManager } from './containerManager'
import { spawn } from 'child_process'

interface TerminalSession {
  projectId: string
  process: any
  ws: WebSocket
}

export class TerminalServer {
  private wss: WebSocketServer | null = null
  private sessions: Map<string, TerminalSession> = new Map()

  constructor(port: number = 8080) {
    // Initialize WebSocket server
    // Note: This requires ws library: npm install ws @types/ws
    // For Next.js, you might need a separate server process
    try {
      // Uncomment when ws is installed:
      // this.wss = new WebSocketServer({ port })
      // this.setupHandlers()
      console.log(`Terminal server would start on port ${port} (requires ws library)`)
    } catch (error) {
      console.warn('WebSocket server not available (install ws library for full support)')
    }
  }

  private setupHandlers() {
    if (!this.wss) return

    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url || '', 'http://localhost')
      const projectId = url.searchParams.get('projectId')

      if (!projectId) {
        ws.close(1008, 'Project ID required')
        return
      }

      const sessionId = `${projectId}-${Date.now()}`
      this.createSession(sessionId, projectId, ws)
    })
  }

  private createSession(sessionId: string, projectId: string, ws: WebSocket) {
    const status = containerManager.getContainerStatus(projectId)
    if (!status || status.status !== 'running') {
      ws.send(JSON.stringify({ type: 'error', message: 'Container not running' }))
      ws.close()
      return
    }

    // Create PTY process
    const ptyProcess = spawn('docker', ['exec', '-it', status.id, 'sh'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Handle PTY output -> WebSocket
    ptyProcess.stdout.on('data', (data) => {
      ws.send(JSON.stringify({ type: 'output', data: data.toString() }))
    })

    ptyProcess.stderr.on('data', (data) => {
      ws.send(JSON.stringify({ type: 'error', data: data.toString() }))
    })

    ptyProcess.on('close', () => {
      ws.send(JSON.stringify({ type: 'close' }))
      this.sessions.delete(sessionId)
    })

    // Handle WebSocket -> PTY input
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString())
        if (data.type === 'input') {
          ptyProcess.stdin.write(data.data)
        } else if (data.type === 'resize') {
          // Handle terminal resize
          ptyProcess.stdout.rows = data.rows
          ptyProcess.stdout.cols = data.cols
        }
      } catch (error) {
        console.error('Terminal message error:', error)
      }
    })

    ws.on('close', () => {
      ptyProcess.kill()
      this.sessions.delete(sessionId)
    })

    this.sessions.set(sessionId, {
      projectId,
      process: ptyProcess,
      ws,
    })

    // Send initial message
    ws.send(JSON.stringify({ type: 'connected', sessionId }))
  }

  close() {
    this.sessions.forEach((session) => {
      session.process.kill()
      session.ws.close()
    })
    this.sessions.clear()
    this.wss?.close()
  }
}

// Export singleton (initialize when needed)
let terminalServer: TerminalServer | null = null

export function getTerminalServer(port?: number): TerminalServer {
  if (!terminalServer) {
    terminalServer = new TerminalServer(port)
  }
  return terminalServer
}

