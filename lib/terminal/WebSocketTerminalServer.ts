/**
 * WebSocket Terminal Server
 * 
 * Manages WebSocket connections for terminal communication.
 * Bridges WebSocket clients to PTY sessions.
 */

import { WebSocket } from 'ws'
import { EventEmitter } from 'events'
import { getPTYManager, PTYManager } from './PTYManager'
import { PTYOptions } from './PTYManager'

export interface TerminalConnection {
  ws: WebSocket
  sessionId: string | null
  projectId: string
  connectedAt: number
}

/**
 * WebSocket Terminal Server
 * 
 * Manages WebSocket connections and maps them to PTY sessions.
 */
export class WebSocketTerminalServer extends EventEmitter {
  private static instance: WebSocketTerminalServer
  private connections: Map<string, TerminalConnection> = new Map()
  private ptyManager: PTYManager

  private constructor() {
    super()
    this.ptyManager = getPTYManager()

    // Listen to PTY events
    this.ptyManager.on('data', ({ sessionId, data }) => {
      // Broadcast data to all connections using this session
      this.broadcastToSession(sessionId, { type: 'output', data })
    })

    this.ptyManager.on('exit', ({ sessionId, exitCode, signal }) => {
      this.broadcastToSession(sessionId, {
        type: 'exit',
        exitCode,
        signal,
      })
    })
  }

  static getInstance(): WebSocketTerminalServer {
    if (!WebSocketTerminalServer.instance) {
      WebSocketTerminalServer.instance = new WebSocketTerminalServer()
    }
    return WebSocketTerminalServer.instance
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws: WebSocket, projectId: string): Promise<void> {
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const connection: TerminalConnection = {
      ws,
      sessionId: null,
      projectId,
      connectedAt: Date.now(),
    }

    this.connections.set(connectionId, connection)

    // Handle WebSocket messages
    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString())
        await this.handleMessage(connectionId, data)
      } catch (error) {
        console.error('[WebSocketTerminalServer] Error handling message:', error)
        this.sendError(connectionId, 'Invalid message format')
      }
    })

    // Handle WebSocket close
    ws.on('close', () => {
      this.handleDisconnection(connectionId)
    })

    // Handle WebSocket error
    ws.on('error', (error) => {
      console.error('[WebSocketTerminalServer] WebSocket error:', error)
      this.handleDisconnection(connectionId)
    })

    // Send connection confirmation
    this.send(connectionId, { type: 'connected', connectionId })
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return
    }

    switch (data.type) {
      case 'create-session':
        await this.createSession(connectionId, data.options)
        break

      case 'input':
        if (connection.sessionId) {
          this.ptyManager.write(connection.sessionId, data.data)
        } else {
          this.sendError(connectionId, 'No active session')
        }
        break

      case 'resize':
        if (connection.sessionId && data.cols && data.rows) {
          this.ptyManager.resize(connection.sessionId, data.cols, data.rows)
        } else {
          this.sendError(connectionId, 'Invalid resize parameters')
        }
        break

      case 'destroy-session':
        if (connection.sessionId) {
          this.ptyManager.destroySession(connection.sessionId)
          connection.sessionId = null
        }
        break

      default:
        this.sendError(connectionId, `Unknown message type: ${data.type}`)
    }
  }

  /**
   * Create a new PTY session for a connection
   */
  private async createSession(connectionId: string, options: PTYOptions): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return
    }

    try {
      // Ensure projectId matches
      if (options.projectId !== connection.projectId) {
        throw new Error('Project ID mismatch')
      }

      // Destroy existing session if any
      if (connection.sessionId) {
        this.ptyManager.destroySession(connection.sessionId)
      }

      // Create new PTY session
      const sessionId = await this.ptyManager.createSession(options)
      connection.sessionId = sessionId

      // Send session created confirmation
      this.send(connectionId, {
        type: 'session-created',
        sessionId,
      })
    } catch (error: any) {
      console.error('[WebSocketTerminalServer] Failed to create session:', error)
      this.sendError(connectionId, error.message || 'Failed to create terminal session')
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return
    }

    // Destroy PTY session if exists
    if (connection.sessionId) {
      this.ptyManager.destroySession(connection.sessionId)
    }

    this.connections.delete(connectionId)
    this.emit('disconnection', { connectionId, projectId: connection.projectId })
  }

  /**
   * Send message to a connection
   */
  private send(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId)
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      connection.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('[WebSocketTerminalServer] Error sending message:', error)
    }
  }

  /**
   * Send error message to a connection
   */
  private sendError(connectionId: string, error: string): void {
    this.send(connectionId, { type: 'error', error })
  }

  /**
   * Broadcast message to all connections using a session
   */
  private broadcastToSession(sessionId: string, message: any): void {
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.sessionId === sessionId) {
        this.send(connectionId, message)
      }
    }
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size
  }

  /**
   * Get connections for a project
   */
  getConnectionsByProject(projectId: string): TerminalConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.projectId === projectId
    )
  }
}

/**
 * Get WebSocket Terminal Server instance
 */
export function getWebSocketTerminalServer(): WebSocketTerminalServer {
  return WebSocketTerminalServer.getInstance()
}
