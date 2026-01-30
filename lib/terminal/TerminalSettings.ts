/**
 * Terminal Settings
 * 
 * Manages terminal configuration and settings.
 */

export interface TerminalSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  cursorBlink: boolean
  cursorStyle: 'block' | 'underline' | 'line' | 'bar'
  scrollback: number
  bellStyle: 'none' | 'sound' | 'visual'
  wordWrap: boolean
  theme: string
  profile: string
}

/**
 * Default terminal settings
 */
export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 10000,
  bellStyle: 'none',
  wordWrap: false,
  theme: 'dark-plus',
  profile: 'powershell',
}

/**
 * Terminal Settings Manager
 */
export class TerminalSettingsManager {
  private static instance: TerminalSettingsManager
  private settings: Map<string, TerminalSettings> = new Map()

  private constructor() {}

  static getInstance(): TerminalSettingsManager {
    if (!TerminalSettingsManager.instance) {
      TerminalSettingsManager.instance = new TerminalSettingsManager()
    }
    return TerminalSettingsManager.instance
  }

  /**
   * Get settings for a session (or default)
   */
  getSettings(sessionId?: string): TerminalSettings {
    if (sessionId) {
      return this.settings.get(sessionId) || { ...DEFAULT_TERMINAL_SETTINGS }
    }
    return { ...DEFAULT_TERMINAL_SETTINGS }
  }

  /**
   * Update settings for a session
   */
  updateSettings(sessionId: string, updates: Partial<TerminalSettings>): void {
    const current = this.getSettings(sessionId)
    this.settings.set(sessionId, { ...current, ...updates })
  }

  /**
   * Reset settings to default
   */
  resetSettings(sessionId: string): void {
    this.settings.set(sessionId, { ...DEFAULT_TERMINAL_SETTINGS })
  }
}

/**
 * Get Terminal Settings Manager instance
 */
export function getTerminalSettingsManager(): TerminalSettingsManager {
  return TerminalSettingsManager.getInstance()
}
