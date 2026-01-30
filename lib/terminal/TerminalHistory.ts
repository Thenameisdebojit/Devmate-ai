/**
 * Terminal History Manager
 * 
 * Manages command history for terminal sessions.
 * Provides persistent history storage and search functionality.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface HistoryEntry {
  command: string
  timestamp: number
  sessionId: string
  projectId: string
}

/**
 * Terminal History Manager
 * 
 * Stores and retrieves terminal command history per session/project.
 */
export class TerminalHistory {
  private static instance: TerminalHistory
  private history: Map<string, HistoryEntry[]> = new Map()
  private readonly maxHistoryPerSession = 1000
  private readonly historyDir: string

  private constructor() {
    const userHome = homedir()
    this.historyDir = join(userHome, '.devmate', 'terminal-history')
    this.loadHistory()
  }

  static getInstance(): TerminalHistory {
    if (!TerminalHistory.instance) {
      TerminalHistory.instance = new TerminalHistory()
    }
    return TerminalHistory.instance
  }

  /**
   * Add command to history
   */
  addCommand(sessionId: string, projectId: string, command: string): void {
    if (!command.trim()) {
      return // Don't store empty commands
    }

    const key = this.getHistoryKey(sessionId, projectId)
    const entries = this.history.get(key) || []

    // Don't add duplicate consecutive commands
    if (entries.length > 0 && entries[entries.length - 1].command === command) {
      return
    }

    const entry: HistoryEntry = {
      command,
      timestamp: Date.now(),
      sessionId,
      projectId,
    }

    entries.push(entry)

    // Limit history size
    if (entries.length > this.maxHistoryPerSession) {
      entries.shift() // Remove oldest
    }

    this.history.set(key, entries)
    this.saveHistory(key, entries)
  }

  /**
   * Get history for a session
   */
  getHistory(sessionId: string, projectId: string, limit?: number): HistoryEntry[] {
    const key = this.getHistoryKey(sessionId, projectId)
    const entries = this.history.get(key) || []
    
    if (limit) {
      return entries.slice(-limit)
    }
    
    return entries
  }

  /**
   * Search history
   */
  searchHistory(sessionId: string, projectId: string, query: string): HistoryEntry[] {
    const entries = this.getHistory(sessionId, projectId)
    const lowerQuery = query.toLowerCase()
    
    return entries.filter((entry) =>
      entry.command.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Clear history for a session
   */
  clearHistory(sessionId: string, projectId: string): void {
    const key = this.getHistoryKey(sessionId, projectId)
    this.history.delete(key)
    this.deleteHistoryFile(key)
  }

  /**
   * Get history key
   */
  private getHistoryKey(sessionId: string, projectId: string): string {
    return `${projectId}-${sessionId}`
  }

  /**
   * Load history from disk
   */
  private async loadHistory(): Promise<void> {
    try {
      await fs.mkdir(this.historyDir, { recursive: true })
      const files = await fs.readdir(this.historyDir)
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const key = file.replace('.json', '')
          const filePath = join(this.historyDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const entries: HistoryEntry[] = JSON.parse(content)
          this.history.set(key, entries)
        }
      }
    } catch (error) {
      console.warn('[TerminalHistory] Failed to load history:', error)
    }
  }

  /**
   * Save history to disk
   */
  private async saveHistory(key: string, entries: HistoryEntry[]): Promise<void> {
    try {
      await fs.mkdir(this.historyDir, { recursive: true })
      const filePath = join(this.historyDir, `${key}.json`)
      await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8')
    } catch (error) {
      console.warn('[TerminalHistory] Failed to save history:', error)
    }
  }

  /**
   * Delete history file
   */
  private async deleteHistoryFile(key: string): Promise<void> {
    try {
      const filePath = join(this.historyDir, `${key}.json`)
      await fs.unlink(filePath)
    } catch (error) {
      // File might not exist, ignore error
    }
  }
}

/**
 * Get Terminal History instance
 */
export function getTerminalHistory(): TerminalHistory {
  return TerminalHistory.getInstance()
}
