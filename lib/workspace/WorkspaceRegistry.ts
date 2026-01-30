/**
 * Workspace Registry
 * 
 * SINGLE SOURCE OF TRUTH for WorkspaceDaemon instances.
 * 
 * RULES:
 * - NO component may instantiate WorkspaceDaemon directly
 * - ALL components MUST use WorkspaceRegistry.get(projectId)
 * - Workspace MUST be registered via register() before use
 * - get() throws if workspace is not registered
 * - rootPath is bound during registration
 * 
 * This registry ensures:
 * - Exactly ONE WorkspaceDaemon per projectId
 * - Workspace is initialized before use
 * - rootPath is bound to workspace
 */

import { WorkspaceDaemon } from '@/core/workspace/WorkspaceDaemon'
import { getProjectRootManager } from './ProjectRootManager'

interface WorkspaceEntry {
  daemon: WorkspaceDaemon
  rootPath: string
  registeredAt: number
}

/**
 * Workspace Registry Implementation
 * Singleton registry for WorkspaceDaemon instances
 */
class WorkspaceRegistryImpl {
  private workspaces: Map<string, WorkspaceEntry> = new Map()

  /**
   * Register a workspace for a project
   * 
   * PHASE F: Uses ProjectRootManager for persistent roots
   * 
   * @param projectId - Project identifier
   * @param rootPath - Root path of the workspace (will be resolved from ProjectRootManager if not provided)
   * @returns The registered WorkspaceDaemon instance
   */
  async register(projectId: string, rootPath?: string): Promise<WorkspaceDaemon> {
    // PHASE E: Invariant checks
    if (!projectId) {
      throw new Error('Invariant violation: Project ID is required for WorkspaceRegistry.register')
    }

    // PHASE F: Use ProjectRootManager for persistent roots
    let computedRootPath: string
    if (rootPath) {
      computedRootPath = rootPath
    } else {
      const rootManager = getProjectRootManager()
      computedRootPath = await rootManager.getProjectRoot(projectId)
    }
    
    if (!computedRootPath) {
      throw new Error(`Invariant violation: rootPath is missing for projectId: ${projectId}`)
    }

    // If workspace already exists, return existing (don't create duplicate)
    if (this.workspaces.has(projectId)) {
      const existing = this.workspaces.get(projectId)!
      // PHASE E: Hard error on rootPath mismatch (don't silently update)
      if (rootPath && existing.rootPath !== rootPath) {
        throw new Error(
          `Invariant violation: Workspace already registered with different rootPath. ` +
          `projectId: ${projectId}, existing: ${existing.rootPath}, requested: ${rootPath}`
        )
      }
      return existing.daemon
    }

    // Create new WorkspaceDaemon instance
    const daemon = new WorkspaceDaemon(projectId)

    // Register in registry
    this.workspaces.set(projectId, {
      daemon,
      rootPath: computedRootPath,
      registeredAt: Date.now(),
    })

    console.log('[WorkspaceRegistry] Registered workspace:', {
      projectId,
      rootPath: computedRootPath,
    })

    return daemon
  }

  /**
   * Get workspace for a project
   * 
   * @param projectId - Project identifier
   * @returns The WorkspaceDaemon instance
   * @throws Error if workspace is not registered
   */
  /**
   * Get workspace for a project
   * 
   * PHASE F: Auto-registers workspace if not found, using ProjectRootManager
   * 
   * @param projectId - Project identifier
   * @returns The WorkspaceDaemon instance
   * @throws Error if workspace cannot be registered or accessed
   */
  async get(projectId: string): Promise<WorkspaceDaemon> {
    if (!projectId) {
      throw new Error('Project ID is required')
    }

    let entry = this.workspaces.get(projectId)
    if (!entry) {
      // PHASE F: Auto-register using ProjectRootManager if not found
      const rootManager = getProjectRootManager()
      const rootPath = await rootManager.getProjectRoot(projectId)
      return await this.register(projectId, rootPath)
    }

    // PHASE E: Invariant check - rootPath must exist
    if (!entry.rootPath) {
      throw new Error(`Invariant violation: WorkspaceRegistry entry has no rootPath for projectId: ${projectId}`)
    }

    return entry.daemon
  }

  /**
   * Get root path for a project
   * 
   * PHASE F: Auto-registers workspace if not found, using ProjectRootManager
   * 
   * @param projectId - Project identifier
   * @returns The root path of the workspace
   * @throws Error if workspace cannot be registered or accessed
   */
  async getRootPath(projectId: string): Promise<string> {
    if (!projectId) {
      throw new Error('Project ID is required')
    }

    let entry = this.workspaces.get(projectId)
    if (!entry) {
      // PHASE F: Auto-register using ProjectRootManager if not found
      const rootManager = getProjectRootManager()
      const rootPath = await rootManager.getProjectRoot(projectId)
      await this.register(projectId, rootPath)
      entry = this.workspaces.get(projectId)!
    }

    // PHASE E: Invariant check - rootPath must exist
    if (!entry.rootPath) {
      throw new Error(`Invariant violation: WorkspaceRegistry entry has no rootPath for projectId: ${projectId}`)
    }

    return entry.rootPath
  }

  /**
   * Check if workspace is registered
   * 
   * @param projectId - Project identifier
   * @returns true if workspace is registered, false otherwise
   */
  has(projectId: string): boolean {
    return this.workspaces.has(projectId)
  }

  /**
   * Reset workspace for a project
   * Stops the daemon and removes it from registry
   * 
   * @param projectId - Project identifier
   */
  reset(projectId: string): void {
    if (!projectId) {
      return
    }

    const entry = this.workspaces.get(projectId)
    if (entry) {
      // Stop the daemon
      entry.daemon.stop()
      
      // Remove from registry
      this.workspaces.delete(projectId)
      
      console.log('[WorkspaceRegistry] Reset workspace:', {
        projectId,
      })
    }
  }

}

// Singleton instance
const registryInstance = new WorkspaceRegistryImpl()

// Export convenience functions (use these instead of direct class instantiation)
export const WorkspaceRegistry = {
  /**
   * Register a workspace
   */
  register: (projectId: string, rootPath?: string) => registryInstance.register(projectId, rootPath),

  /**
   * Get workspace daemon
   */
  get: (projectId: string) => registryInstance.get(projectId),

  /**
   * Get root path
   */
  getRootPath: (projectId: string) => registryInstance.getRootPath(projectId),

  /**
   * Check if workspace is registered
   */
  has: (projectId: string) => registryInstance.has(projectId),

  /**
   * Reset workspace
   */
  reset: (projectId: string) => registryInstance.reset(projectId),
}
