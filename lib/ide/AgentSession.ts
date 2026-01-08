/**
 * PHASE 1: Agent Session Model
 * 
 * Every domain + project + chat = a new agent session.
 * Sessions are scoped and isolated.
 */

export interface AgentSession {
  id: string
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

import type { ExecutionIntent } from './IntentBuilder'

/**
 * Session Manager
 * 
 * Manages agent sessions in memory (frontend).
 * Backend will have its own session store.
 */
export class AgentSessionManager {
  private sessions: Map<string, AgentSession> = new Map()

  /**
   * Create or get session
   * 
   * Session key: `${domain}:${projectId}`
   */
  createSession(domain: string, projectId: string): AgentSession {
    const sessionKey = `${domain}:${projectId}`
    
    if (this.sessions.has(sessionKey)) {
      return this.sessions.get(sessionKey)!
    }

    const session: AgentSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
   * Get session
   */
  getSession(domain: string, projectId: string): AgentSession | null {
    const sessionKey = `${domain}:${projectId}`
    return this.sessions.get(sessionKey) || null
  }

  /**
   * Add message to session
   */
  addMessage(
    domain: string,
    projectId: string,
    message: Omit<SessionMessage, 'id' | 'timestamp'>
  ): SessionMessage {
    const session = this.getSession(domain, projectId) || this.createSession(domain, projectId)
    
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
   * Clear session (new chat)
   */
  clearSession(domain: string, projectId: string): void {
    const session = this.getSession(domain, projectId)
    if (session) {
      session.messages = []
      session.intent = undefined
      session.updatedAt = Date.now()
    }
  }

  /**
   * Delete session
   */
  deleteSession(domain: string, projectId: string): void {
    const sessionKey = `${domain}:${projectId}`
    this.sessions.delete(sessionKey)
  }

  /**
   * Get all sessions for a domain
   */
  getSessionsForDomain(domain: string): AgentSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.domain === domain)
  }
}

// Singleton instance
export const sessionManager = new AgentSessionManager()

