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
import { join } from 'path'

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
   * @param projectId - Project identifier
   * @param rootPath - Root path of the workspace (will be computed if not provided)
   * @returns The registered WorkspaceDaemon instance
   */
  register(projectId: string, rootPath?: string): WorkspaceDaemon {
    if (!projectId) {
      throw new Error('Project ID is required')
    }

    // Compute rootPath if not provided (standard pattern)
    const computedRootPath = rootPath || join(process.cwd(), 'runtime-projects', projectId)

    // If workspace already exists, return existing (don't create duplicate)
    if (this.workspaces.has(projectId)) {
      const existing = this.workspaces.get(projectId)!
      // Update rootPath if provided and different
      if (rootPath && existing.rootPath !== rootPath) {
        existing.rootPath = rootPath
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
  get(projectId: string): WorkspaceDaemon {
    if (!projectId) {
      throw new Error('Project ID is required')
    }

    const entry = this.workspaces.get(projectId)
    if (!entry) {
      throw new Error(
        `Workspace not registered for projectId: ${projectId}. ` +
        `Call WorkspaceRegistry.register(projectId) first via /api/workspace/init`
      )
    }

    return entry.daemon
  }

  /**
   * Get root path for a project
   * 
   * @param projectId - Project identifier
   * @returns The root path of the workspace
   * @throws Error if workspace is not registered
   */
  getRootPath(projectId: string): string {
    if (!projectId) {
      throw new Error('Project ID is required')
    }

    const entry = this.workspaces.get(projectId)
    if (!entry) {
      throw new Error(
        `Workspace not registered for projectId: ${projectId}. ` +
        `Call WorkspaceRegistry.register(projectId) first via /api/workspace/init`
      )
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
