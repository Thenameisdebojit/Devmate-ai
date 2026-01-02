/**
 * Workspace Context Manager
 * 
 * Provides workspace-aware context for the App Generator agent.
 * Enforces agent rules: tool-first, no assumptions about file state.
 * 
 * TECH STACK ASSUMPTIONS:
 * - Frontend: Next.js + Monaco (no UI changes in this refactor)
 * - Backend: Agent Orchestrator abstraction
 * - Runtime: Container-per-project model (interface only, not implemented yet)
 * - Storage: File system for workspace state (can be abstracted later)
 */

export interface WorkspaceFile {
  path: string
  content: string
  lastModified: number
  checksum?: string
}

export interface WorkspaceContext {
  projectId: string
  basePath: string
  files: Map<string, WorkspaceFile>
  metadata: {
    createdAt: number
    lastCheckpoint?: string
    runtimeStatus?: 'idle' | 'running' | 'stopped'
  }
}

/**
 * Workspace Context Manager
 * 
 * AGENT RULE: The LLM must never assume file state - all file reads must go through tools.
 * This manager provides the abstraction layer for workspace operations.
 */
export class WorkspaceContextManager {
  private context: WorkspaceContext

  constructor(projectId: string, basePath?: string) {
    this.context = {
      projectId,
      basePath: basePath || `/workspaces/${projectId}`,
      files: new Map(),
      metadata: {
        createdAt: Date.now(),
      },
    }
  }

  /**
   * Get current workspace context
   * AGENT RULE: This is read-only - modifications must go through tools
   */
  getContext(): Readonly<WorkspaceContext> {
    return Object.freeze({
      ...this.context,
      files: new Map(this.context.files), // Return a copy
    })
  }

  /**
   * List all files in workspace
   * AGENT RULE: Tool-first - this is the canonical way to discover files
   */
  listFiles(): string[] {
    return Array.from(this.context.files.keys())
  }

  /**
   * Check if a file exists
   * AGENT RULE: Never assume - always check explicitly
   */
  fileExists(path: string): boolean {
    return this.context.files.has(this.normalizePath(path))
  }

  /**
   * Get file metadata (not content - content requires tool call)
   * AGENT RULE: Metadata checks are allowed, but content requires explicit tool
   */
  getFileMetadata(path: string): WorkspaceFile | null {
    return this.context.files.get(this.normalizePath(path)) || null
  }

  /**
   * Update workspace from tool results
   * AGENT RULE: All file writes must be traceable - this method logs the change
   */
  updateFromToolResult(
    toolName: string,
    operation: 'read' | 'write' | 'delete',
    path: string,
    content?: string
  ): void {
    const normalizedPath = this.normalizePath(path)

    if (operation === 'delete') {
      this.context.files.delete(normalizedPath)
    } else if (operation === 'write' && content !== undefined) {
      this.context.files.set(normalizedPath, {
        path: normalizedPath,
        content,
        lastModified: Date.now(),
        checksum: this.computeChecksum(content),
      })
    }
    // For 'read' operations, we don't update the context - that's the tool's responsibility
  }

  /**
   * Normalize file path for consistent storage
   */
  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, '')
  }

  /**
   * Compute simple checksum for change detection
   */
  private computeChecksum(content: string): string {
    // Simple hash for change detection
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  /**
   * Mark checkpoint
   * AGENT RULE: Checkpoints are mandatory before any destructive write
   */
  markCheckpoint(checkpointId: string): void {
    this.context.metadata.lastCheckpoint = checkpointId
  }

  /**
   * Get project ID
   */
  getProjectId(): string {
    return this.context.projectId
  }
}

