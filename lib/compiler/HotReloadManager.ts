/**
 * Hot Reload Manager
 * 
 * Manages hot module reloading and live code updates.
 */

import { watch, FSWatcher } from 'fs'
import { join } from 'path'
import { EventEmitter } from 'events'

export interface HotReloadConfig {
  projectPath: string
  watchPatterns: string[]
  ignorePatterns: string[]
  debounceMs?: number
}

/**
 * Hot Reload Manager
 * 
 * Watches files and triggers hot reload.
 */
export class HotReloadManager extends EventEmitter {
  private static instance: HotReloadManager
  private watchers: Map<string, FSWatcher> = new Map()
  private reloadTimers: Map<string, NodeJS.Timeout> = new Map()

  private constructor() {
    super()
  }

  static getInstance(): HotReloadManager {
    if (!HotReloadManager.instance) {
      HotReloadManager.instance = new HotReloadManager()
    }
    return HotReloadManager.instance
  }

  /**
   * Start watching for file changes
   */
  startWatching(config: HotReloadConfig): void {
    const { projectPath, watchPatterns, ignorePatterns, debounceMs = 300 } = config

    // Stop existing watcher if any
    this.stopWatching(projectPath)

    try {
      const watcher = watch(projectPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return

        // Check if file matches watch patterns
        const matches = watchPatterns.some((pattern) => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'))
            return regex.test(filename)
          }
          return filename.includes(pattern)
        })

        if (!matches) return

        // Check if file matches ignore patterns
        const ignored = ignorePatterns.some((pattern) => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'))
            return regex.test(filename)
          }
          return filename.includes(pattern)
        })

        if (ignored) return

        // Debounce reload
        const existingTimer = this.reloadTimers.get(projectPath)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        const timer = setTimeout(() => {
          this.emit('file-changed', {
            projectPath,
            file: filename,
            eventType,
          })
          this.reloadTimers.delete(projectPath)
        }, debounceMs)

        this.reloadTimers.set(projectPath, timer)
      })

      this.watchers.set(projectPath, watcher)
    } catch (error) {
      console.error('[HotReloadManager] Failed to start watching:', error)
    }
  }

  /**
   * Stop watching for file changes
   */
  stopWatching(projectPath: string): void {
    const watcher = this.watchers.get(projectPath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(projectPath)
    }

    const timer = this.reloadTimers.get(projectPath)
    if (timer) {
      clearTimeout(timer)
      this.reloadTimers.delete(projectPath)
    }
  }

  /**
   * Stop all watchers
   */
  stopAll(): void {
    for (const [projectPath] of this.watchers.entries()) {
      this.stopWatching(projectPath)
    }
  }
}

/**
 * Get Hot Reload Manager instance
 */
export function getHotReloadManager(): HotReloadManager {
  return HotReloadManager.getInstance()
}
