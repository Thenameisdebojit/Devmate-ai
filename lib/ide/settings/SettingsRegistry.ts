/**
 * PHASE 2: Settings Registry (Runtime State)
 * 
 * Manages IDE settings as runtime state, not files.
 * Never infers from files. Always schema-driven.
 */

import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import { join } from 'path'
import { SETTINGS_SCHEMA, getSettingSchema, validateSetting, type SettingScope } from './SettingsSchema'
import { getProjectRootManager } from '@/lib/workspace/ProjectRootManager'

/**
 * Settings change event
 */
export interface SettingsChangeEvent {
  key: string
  value: any
  scope: SettingScope
}

/**
 * Settings Registry
 * 
 * Responsibilities:
 * - Load defaults from schema
 * - Overlay user settings
 * - Overlay workspace settings
 * - Emit change events
 * - Never infer from files
 */
class SettingsRegistryImpl extends EventEmitter {
  private userSettings: Map<string, any> = new Map()
  private workspaceSettings: Map<string, Map<string, any>> = new Map() // projectId -> settings
  private initialized: boolean = false
  private readonly USER_SETTINGS_PATH = join(process.cwd(), '.devmate-global', 'user-settings.json')

  /**
   * Initialize registry (load from storage)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Load user settings
      await this.loadUserSettings()
    } catch (error: any) {
      console.warn('[SettingsRegistry] Failed to load user settings:', error)
      // Continue with defaults
    }

    this.initialized = true
  }

  /**
   * Load user settings from disk
   */
  private async loadUserSettings(): Promise<void> {
    try {
      await fs.mkdir(join(process.cwd(), '.devmate-global'), { recursive: true })
      const content = await fs.readFile(this.USER_SETTINGS_PATH, 'utf-8')
      const data = JSON.parse(content)
      
      // Validate and load each setting
      for (const [key, value] of Object.entries(data)) {
        const validation = validateSetting(key, value)
        if (validation.valid) {
          this.userSettings.set(key, value)
        } else {
          console.warn(`[SettingsRegistry] Invalid user setting ${key}: ${validation.error}`)
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - use defaults
        return
      }
      throw error
    }
  }

  /**
   * Save user settings to disk
   */
  private async saveUserSettings(): Promise<void> {
    try {
      await fs.mkdir(join(process.cwd(), '.devmate-global'), { recursive: true })
      const data: Record<string, any> = {}
      this.userSettings.forEach((value, key) => {
        data[key] = value
      })
      await fs.writeFile(this.USER_SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error: any) {
      console.error('[SettingsRegistry] Failed to save user settings:', error)
      throw error
    }
  }

  /**
   * Load workspace settings for a project
   */
  private async loadWorkspaceSettings(projectId: string): Promise<void> {
    if (this.workspaceSettings.has(projectId)) {
      return // Already loaded
    }

    try {
      const rootManager = getProjectRootManager()
      const rootPath = await rootManager.getProjectRoot(projectId)
      const settingsPath = join(rootPath, '.devmate', 'state', 'settings.json')

      const content = await fs.readFile(settingsPath, 'utf-8')
      const data = JSON.parse(content)

      const projectSettings = new Map<string, any>()
      for (const [key, value] of Object.entries(data)) {
        const validation = validateSetting(key, value)
        if (validation.valid) {
          projectSettings.set(key, value)
        } else {
          console.warn(`[SettingsRegistry] Invalid workspace setting ${key} for ${projectId}: ${validation.error}`)
        }
      }

      this.workspaceSettings.set(projectId, projectSettings)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - use empty map
        this.workspaceSettings.set(projectId, new Map())
        return
      }
      console.warn(`[SettingsRegistry] Failed to load workspace settings for ${projectId}:`, error)
      this.workspaceSettings.set(projectId, new Map())
    }
  }

  /**
   * Save workspace settings for a project
   */
  private async saveWorkspaceSettings(projectId: string): Promise<void> {
    const projectSettings = this.workspaceSettings.get(projectId)
    if (!projectSettings) {
      return
    }

    try {
      const rootManager = getProjectRootManager()
      const rootPath = await rootManager.getProjectRoot(projectId)
      const settingsDir = join(rootPath, '.devmate', 'state')
      await fs.mkdir(settingsDir, { recursive: true })
      
      const settingsPath = join(settingsDir, 'settings.json')
      const data: Record<string, any> = {}
      projectSettings.forEach((value, key) => {
        data[key] = value
      })
      await fs.writeFile(settingsPath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error: any) {
      console.error(`[SettingsRegistry] Failed to save workspace settings for ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Get setting value (merged: default → user → workspace)
   */
  get(key: string, projectId?: string): any {
    const schema = getSettingSchema(key)
    if (!schema) {
      return undefined
    }

    // Check workspace settings first (if projectId provided)
    if (projectId) {
      const projectSettings = this.workspaceSettings.get(projectId)
      if (projectSettings?.has(key)) {
        return projectSettings.get(key)
      }
    }

    // Check user settings
    if (this.userSettings.has(key)) {
      return this.userSettings.get(key)
    }

    // Return default
    return schema.default
  }

  /**
   * Set setting value
   */
  async set(key: string, value: any, scope: SettingScope, projectId?: string): Promise<void> {
    // Validate against schema
    const validation = validateSetting(key, value)
    if (!validation.valid) {
      throw new Error(`Invalid setting value: ${validation.error}`)
    }

    const schema = getSettingSchema(key)
    if (!schema) {
      throw new Error(`Unknown setting key: ${key}`)
    }

    // Check scope matches schema
    if (schema.scope === "workspace" && scope === "user") {
      throw new Error(`Setting ${key} can only be set at workspace scope`)
    }

    // Set value
    if (scope === "workspace") {
      if (!projectId) {
        throw new Error(`Project ID is required for workspace-scoped settings`)
      }
      
      // Ensure workspace settings are loaded
      await this.loadWorkspaceSettings(projectId)
      
      const projectSettings = this.workspaceSettings.get(projectId)!
      projectSettings.set(key, value)
      await this.saveWorkspaceSettings(projectId)
    } else {
      this.userSettings.set(key, value)
      await this.saveUserSettings()
    }

    // Emit change event
    this.emit('change', { key, value, scope } as SettingsChangeEvent)
  }

  /**
   * Reset setting to default
   */
  async reset(key: string, scope: SettingScope, projectId?: string): Promise<void> {
    const schema = getSettingSchema(key)
    if (!schema) {
      throw new Error(`Unknown setting key: ${key}`)
    }

    if (scope === "workspace") {
      if (!projectId) {
        throw new Error(`Project ID is required for workspace-scoped settings`)
      }
      
      await this.loadWorkspaceSettings(projectId)
      const projectSettings = this.workspaceSettings.get(projectId)!
      projectSettings.delete(key)
      await this.saveWorkspaceSettings(projectId)
    } else {
      this.userSettings.delete(key)
      await this.saveUserSettings()
    }

    // Emit change event with default value
    this.emit('change', { key, value: schema.default, scope } as SettingsChangeEvent)
  }

  /**
   * Get all settings (merged) for a project
   */
  getAll(projectId?: string): Record<string, any> {
    const result: Record<string, any> = {}

    // Load defaults
    SETTINGS_SCHEMA.forEach(schema => {
      result[schema.key] = schema.default
    })

    // Overlay user settings
    this.userSettings.forEach((value, key) => {
      result[key] = value
    })

    // Overlay workspace settings (if projectId provided)
    if (projectId) {
      const projectSettings = this.workspaceSettings.get(projectId)
      if (projectSettings) {
        projectSettings.forEach((value, key) => {
          result[key] = value
        })
      }
    }

    return result
  }

  /**
   * Get user settings only
   */
  getUserSettings(): Record<string, any> {
    const result: Record<string, any> = {}
    this.userSettings.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  /**
   * Get workspace settings only (for a project)
   */
  getWorkspaceSettings(projectId: string): Record<string, any> {
    const projectSettings = this.workspaceSettings.get(projectId)
    if (!projectSettings) {
      return {}
    }
    
    const result: Record<string, any> = {}
    projectSettings.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
}

// Singleton instance
let registryInstance: SettingsRegistryImpl | null = null

export function getSettingsRegistry(): SettingsRegistryImpl {
  if (!registryInstance) {
    registryInstance = new SettingsRegistryImpl()
    // Initialize asynchronously (don't await)
    registryInstance.initialize().catch(error => {
      console.error('[SettingsRegistry] Initialization error:', error)
    })
  }
  return registryInstance
}
