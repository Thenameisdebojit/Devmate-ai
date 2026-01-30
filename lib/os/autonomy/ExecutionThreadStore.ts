/**
 * PHASE F′-9: Execution Thread Store
 * 
 * Persists execution threads to disk.
 * One active thread per project.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { getProjectRootManager } from '@/lib/workspace/ProjectRootManager'
import type { ExecutionThread } from './ExecutionThread'

/**
 * Execution threads file structure
 */
interface ExecutionThreadsFile {
  projectId: string
  thread: ExecutionThread | null
  version: number
}

/**
 * Execution Thread Store
 * 
 * Manages execution threads per project.
 * Persists to .devmate/execution-thread.json
 */
class ExecutionThreadStoreImpl {
  private threadsCache: Map<string, ExecutionThread | null> = new Map() // projectId -> ExecutionThread
  private readonly THREAD_FILE = '.devmate/execution-thread.json'

  /**
   * Get thread file path for a project
   */
  private async getThreadFilePath(projectId: string): Promise<string> {
    const rootManager = getProjectRootManager()
    const rootPath = await rootManager.getProjectRoot(projectId)
    return join(rootPath, this.THREAD_FILE)
  }

  /**
   * Load thread from disk
   */
  private async loadThread(projectId: string): Promise<ExecutionThread | null> {
    // Check cache first
    if (this.threadsCache.has(projectId)) {
      return this.threadsCache.get(projectId)!
    }

    try {
      const filePath = await this.getThreadFilePath(projectId)
      const content = await fs.readFile(filePath, 'utf-8')
      const data: ExecutionThreadsFile = JSON.parse(content)

      if (data.projectId !== projectId) {
        console.warn(`[ExecutionThreadStore] Thread file projectId mismatch: expected ${projectId}, got ${data.projectId}`)
        return null
      }

      this.threadsCache.set(projectId, data.thread)
      return data.thread
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - return null
        this.threadsCache.set(projectId, null)
        return null
      }
      console.error(`[ExecutionThreadStore] Failed to load thread for ${projectId}:`, error)
      return null
    }
  }

  /**
   * Save thread to disk
   */
  private async saveThread(projectId: string, thread: ExecutionThread | null): Promise<void> {
    try {
      const filePath = await this.getThreadFilePath(projectId)
      const dir = join(filePath, '..')
      
      // Ensure .devmate directory exists
      await fs.mkdir(dir, { recursive: true })

      const data: ExecutionThreadsFile = {
        projectId,
        thread,
        version: 1,
      }

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      this.threadsCache.set(projectId, thread)
    } catch (error: any) {
      console.error(`[ExecutionThreadStore] Failed to save thread for ${projectId}:`, error)
      throw new Error(`Failed to save execution thread: ${error.message}`)
    }
  }

  /**
   * Create a new execution thread
   */
  async createThread(projectId: string, goalId: string, currentGoalNodeId: string | null = null): Promise<ExecutionThread> {
    // Check if project already has an active thread
    const existing = await this.getThread(projectId)
    if (existing && (existing.status === 'active' || existing.status === 'paused')) {
      throw new Error(`Project ${projectId} already has an ${existing.status} execution thread`)
    }

    const thread: ExecutionThread = {
      projectId,
      goalId,
      status: 'active',
      currentGoalNodeId,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    }

    await this.saveThread(projectId, thread)
    return thread
  }

  /**
   * Get execution thread for a project
   */
  async getThread(projectId: string): Promise<ExecutionThread | null> {
    return this.loadThread(projectId)
  }

  /**
   * Update thread
   */
  async updateThread(
    projectId: string,
    updates: Partial<Omit<ExecutionThread, 'projectId' | 'startedAt'>>
  ): Promise<ExecutionThread> {
    const thread = await this.getThread(projectId)
    if (!thread) {
      throw new Error(`Execution thread not found for project ${projectId}`)
    }

    const updated: ExecutionThread = {
      ...thread,
      ...updates,
      updatedAt: Date.now(),
    }

    await this.saveThread(projectId, updated)
    return updated
  }

  /**
   * Pause thread
   */
  async pauseThread(projectId: string): Promise<ExecutionThread> {
    return this.updateThread(projectId, {
      status: 'paused',
      pausedAt: Date.now(),
    })
  }

  /**
   * Resume thread
   */
  async resumeThread(projectId: string): Promise<ExecutionThread> {
    return this.updateThread(projectId, {
      status: 'active',
      pausedAt: undefined,
    })
  }

  /**
   * Complete thread
   */
  async completeThread(projectId: string): Promise<ExecutionThread> {
    return this.updateThread(projectId, {
      status: 'completed',
      completedAt: Date.now(),
    })
  }

  /**
   * Abort thread
   */
  async abortThread(projectId: string, reason?: string): Promise<ExecutionThread> {
    return this.updateThread(projectId, {
      status: 'aborted',
      abortedAt: Date.now(),
      abortReason: reason,
    })
  }

  /**
   * Clear cache for a project
   */
  clearCache(projectId: string): void {
    this.threadsCache.delete(projectId)
  }
}

// Singleton instance
let storeInstance: ExecutionThreadStoreImpl | null = null

export function getExecutionThreadStore(): ExecutionThreadStoreImpl {
  if (!storeInstance) {
    storeInstance = new ExecutionThreadStoreImpl()
  }
  return storeInstance
}
