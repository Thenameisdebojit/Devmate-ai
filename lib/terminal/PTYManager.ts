/**
 * PTY Manager
 * 
 * Manages PTY (pseudo-terminal) sessions for terminal tabs.
 * Provides real terminal functionality using node-pty.
 */

import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { getProjectRootManager } from '@/lib/workspace/ProjectRootManager'
import { platform } from 'os'

export interface PTYOptions {
  projectId: string
  shell?: string
  shellArgs?: string[]
  cwd?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
}

export interface PTYSession {
  id: string
  pty: pty.IPty
  projectId: string
  createdAt: number
  lastActivity: number
}

/**
 * PTY Manager Singleton
 * 
 * Manages all PTY sessions across the application.
 * Each terminal tab gets its own PTY session.
 */
export class PTYManager extends EventEmitter {
  private static instance: PTYManager
  private sessions: Map<string, PTYSession> = new Map()
  private readonly maxSessions = 100 // Limit concurrent sessions

  private constructor() {
    super()
    // Cleanup old sessions periodically
    setInterval(() => this.cleanupInactiveSessions(), 60000) // Every minute
  }

  static getInstance(): PTYManager {
    if (!PTYManager.instance) {
      PTYManager.instance = new PTYManager()
    }
    return PTYManager.instance
  }

  /**
   * Get default shell for the current platform
   */
  private getDefaultShell(): { shell: string; args: string[] } {
    const isWindows = platform() === 'win32'
    
    if (isWindows) {
      // Try PowerShell first, fallback to CMD
      return {
        shell: process.env.COMSPEC || 'powershell.exe',
        args: ['-NoLogo', '-NoExit'],
      }
    } else {
      // Unix-like systems
      const shell = process.env.SHELL || '/bin/bash'
      return {
        shell,
        args: ['-l'], // Login shell
      }
    }
  }

  /**
   * Create a new PTY session
   */
  async createSession(options: PTYOptions): Promise<string> {
    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum number of terminal sessions (${this.maxSessions}) reached`)
    }

    const sessionId = `pty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Get project root directory
    let cwd = options.cwd
    if (!cwd && options.projectId) {
      try {
        const rootManager = getProjectRootManager()
        cwd = await rootManager.getProjectRoot(options.projectId)
      } catch (error) {
        console.warn('[PTYManager] Failed to get project root, using current directory:', error)
        cwd = process.cwd()
      }
    }

    // Determine shell
    const { shell, args } = options.shell
      ? { shell: options.shell, args: options.shellArgs || [] }
      : this.getDefaultShell()

    // Prepare environment
    const env = {
      ...process.env,
      ...options.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    }

    // Create PTY
    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: cwd || process.cwd(),
      env: env as { [key: string]: string },
      handleFlowControl: true,
    })

    // Create session
    const session: PTYSession = {
      id: sessionId,
      pty: ptyProcess,
      projectId: options.projectId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    }

    // Handle PTY output
    ptyProcess.onData((data: string) => {
      session.lastActivity = Date.now()
      this.emit('data', { sessionId, data })
    })

    // Handle PTY exit
    ptyProcess.onExit((exitCode: number, signal?: number) => {
      this.emit('exit', { sessionId, exitCode, signal })
      this.destroySession(sessionId)
    })

    this.sessions.set(sessionId, session)
    this.emit('session-created', { sessionId, projectId: options.projectId })

    return sessionId
  }

  /**
   * Write data to a PTY session
   */
  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`PTY session not found: ${sessionId}`)
    }

    session.lastActivity = Date.now()
    session.pty.write(data)
  }

  /**
   * Resize a PTY session
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`PTY session not found: ${sessionId}`)
    }

    try {
      session.pty.resize(cols, rows)
      session.lastActivity = Date.now()
    } catch (error) {
      console.error('[PTYManager] Failed to resize PTY:', error)
    }
  }

  /**
   * Destroy a PTY session
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return
    }

    try {
      // Kill the PTY process
      session.pty.kill()
    } catch (error) {
      console.error('[PTYManager] Error killing PTY:', error)
    }

    this.sessions.delete(sessionId)
    this.emit('session-destroyed', { sessionId })
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): PTYSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all sessions for a project
   */
  getSessionsByProject(projectId: string): PTYSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.projectId === projectId
    )
  }

  /**
   * Destroy all sessions for a project
   */
  destroyProjectSessions(projectId: string): void {
    const sessions = this.getSessionsByProject(projectId)
    sessions.forEach((session) => {
      this.destroySession(session.id)
    })
  }

  /**
   * Cleanup inactive sessions (older than 1 hour)
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now()
    const maxInactiveTime = 60 * 60 * 1000 // 1 hour

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > maxInactiveTime) {
        console.log(`[PTYManager] Cleaning up inactive session: ${sessionId}`)
        this.destroySession(sessionId)
      }
    }
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size
  }
}

/**
 * Get PTY Manager instance
 */
export function getPTYManager(): PTYManager {
  return PTYManager.getInstance()
}
