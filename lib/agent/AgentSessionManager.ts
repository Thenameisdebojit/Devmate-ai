/**
 * PHASE 2: Backend Agent Session Manager
 * 
 * Manages agent sessions on the backend.
 * Sessions are scoped by domain + projectId.
 * Frontend sessionId must match backend session.
 */

import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'

export interface AgentSession {
  sessionId: string
  projectId: string
  domain: string
  intent?: ExecutionIntent
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number
}

export interface SessionMessage {
  id: string
  type: 'user' | 'assistant' | 'system' | 'observation' | 'error'
  content: string
  timestamp: number
  intent?: ExecutionIntent
  metadata?: Record<string, any>
}

/**
 * Backend Agent Session Manager
 * 
 * Rules:
 * - Create session if not exists
 * - Load existing session by sessionId
 * - Reject cross-project or cross-domain misuse
 * - Frontend sessionId must match backend session
 */
export class AgentSessionManager {
  private sessions: Map<string, AgentSession> = new Map()

  /**
   * Create or get session
   * 
   * Session key: `${domain}:${projectId}:${sessionId}`
   * This ensures session isolation per domain + project
   */
  createSession(
    sessionId: string,
    projectId: string,
    domain: string
  ): AgentSession {
    const sessionKey = this.getSessionKey(sessionId, projectId, domain)

    if (this.sessions.has(sessionKey)) {
      return this.sessions.get(sessionKey)!
    }

    const session: AgentSession = {
      sessionId,
      projectId,
      domain,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.sessions.set(sessionKey, session)
    return session
  }

  /**
   * Get session by sessionId
   * 
   * Validates that sessionId matches projectId and domain
   * Rejects cross-project or cross-domain misuse
   */
  getSession(
    sessionId: string,
    projectId: string,
    domain: string
  ): AgentSession | null {
    const sessionKey = this.getSessionKey(sessionId, projectId, domain)
    const session = this.sessions.get(sessionKey)

    if (!session) {
      return null
    }

    // Validate session matches projectId and domain
    if (session.projectId !== projectId || session.domain !== domain) {
      throw new Error(
        `Session mismatch: session ${sessionId} belongs to project ${session.projectId} (domain: ${session.domain}), ` +
        `but request is for project ${projectId} (domain: ${domain})`
      )
    }

    return session
  }

  /**
   * Get or create session (convenience method)
   */
  getOrCreateSession(
    sessionId: string,
    projectId: string,
    domain: string
  ): AgentSession {
    const existing = this.getSession(sessionId, projectId, domain)
    if (existing) {
      return existing
    }
    return this.createSession(sessionId, projectId, domain)
  }

  /**
   * Add message to session
   */
  addMessage(
    sessionId: string,
    projectId: string,
    domain: string,
    message: Omit<SessionMessage, 'id' | 'timestamp'>
  ): SessionMessage {
    const session = this.getOrCreateSession(sessionId, projectId, domain)

    const fullMessage: SessionMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    }

    session.messages.push(fullMessage)
    session.updatedAt = Date.now()

    return fullMessage
  }

  /**
   * Update session intent
   */
  updateIntent(
    sessionId: string,
    projectId: string,
    domain: string,
    intent: ExecutionIntent
  ): void {
    const session = this.getSession(sessionId, projectId, domain)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    session.intent = intent
    session.updatedAt = Date.now()
  }

  /**
   * Clear session (new chat)
   */
  clearSession(sessionId: string, projectId: string, domain: string): void {
    const session = this.getSession(sessionId, projectId, domain)
    if (session) {
      session.messages = []
      session.intent = undefined
      session.updatedAt = Date.now()
    }
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string, projectId: string, domain: string): void {
    const sessionKey = this.getSessionKey(sessionId, projectId, domain)
    this.sessions.delete(sessionKey)
  }

  /**
   * Get all sessions for a project
   */
  getSessionsForProject(projectId: string): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.projectId === projectId
    )
  }

  /**
   * Get all sessions for a domain
   */
  getSessionsForDomain(domain: string): AgentSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.domain === domain)
  }

  /**
   * Generate session key
   */
  private getSessionKey(
    sessionId: string,
    projectId: string,
    domain: string
  ): string {
    return `${domain}:${projectId}:${sessionId}`
  }
}

// Singleton instance
let sessionManagerInstance: AgentSessionManager | null = null

export function getAgentSessionManager(): AgentSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new AgentSessionManager()
  }
  return sessionManagerInstance
}

