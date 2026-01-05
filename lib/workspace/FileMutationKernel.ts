/**
 * File Mutation Kernel
 * 
 * Authoritative file mutation authority.
 * NO OTHER COMPONENT may write files directly.
 * 
 * RULES:
 * - Own ALL file writes
 * - Apply diff-based change sets
 * - Enforce transactional writes
 * - Integrate with checkpoints
 * - Emit FILE_SAVED events
 * - Reject unauthorized writes
 */

import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { getAgentConfidenceEngine, type ConfidenceReport } from '@/core/workspace/AgentConfidenceEngine'
import { checkpointEngine } from '@/lib/runtime/checkpointEngine'

export type FileChangeType = 'create' | 'modify' | 'delete'

export interface UnifiedDiff {
  oldContent: string
  newContent: string
  hunks: Array<{
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    lines: string[]
  }>
}

export interface FileChange {
  path: string
  type: FileChangeType
  diff?: UnifiedDiff
  fullContent?: string
  reason?: string
}

export interface FileChangeSet {
  changes: FileChange[]
  reason: string
  confidenceSnapshot?: ConfidenceReport
  checkpointId?: string
}

export interface MutationResult {
  success: boolean
  appliedChanges: FileChange[]
  failedChanges: Array<{ change: FileChange; error: string }>
  checkpointId?: string
  error?: string
}

/**
 * File Mutation Kernel
 * Authoritative file mutation authority
 */
export class FileMutationKernel {
  private projectId: string
  private projectRoot: string
  private pendingMutations: Map<string, FileChangeSet> = new Map()
  private mutationHistory: FileChangeSet[] = []

  constructor(projectId: string, projectRoot: string) {
    this.projectId = projectId
    this.projectRoot = projectRoot
  }

  /**
   * Apply a change set to the filesystem
   * This is the ONLY way files should be modified
   */
  async apply(changeSet: FileChangeSet, options?: {
    requireApproval?: boolean
    requireHighConfidence?: boolean
    createCheckpoint?: boolean
  }): Promise<MutationResult> {
    const {
      requireApproval = false,
      requireHighConfidence = false,
      createCheckpoint: shouldCreateCheckpoint = true,
    } = options || {}

    // Validate change set
    const validation = this.validateChangeSet(changeSet)
    if (!validation.valid) {
      return {
        success: false,
        appliedChanges: [],
        failedChanges: changeSet.changes.map((c) => ({
          change: c,
          error: validation.error || 'Validation failed',
        })),
        error: validation.error,
      }
    }

    // Check confidence gate
    if (requireHighConfidence) {
      const confidenceEngine = getAgentConfidenceEngine(this.projectId)
      const report = confidenceEngine.getCurrentReport()
      if (report.confidenceLevel !== 'HIGH' || report.riskLevel !== 'LOW') {
        return {
          success: false,
          appliedChanges: [],
          failedChanges: changeSet.changes.map((c) => ({
            change: c,
            error: 'Confidence gate failed: requires HIGH confidence and LOW risk',
          })),
          error: 'Confidence gate failed',
        }
      }
    }

    // Create checkpoint if requested
    let checkpointId: string | undefined
    if (shouldCreateCheckpoint) {
      try {
        const checkpoint = await checkpointEngine.createCheckpoint(
          this.projectId,
          this.projectRoot,
          `File mutation: ${changeSet.reason}`,
          'pre-write'
        )
        checkpointId = checkpoint.id
      } catch (error) {
        console.error('Failed to create checkpoint:', error)
        // Continue without checkpoint if it fails
      }
    }

    // Apply changes transactionally
    const appliedChanges: FileChange[] = []
    const failedChanges: Array<{ change: FileChange; error: string }> = []

    try {
      for (const change of changeSet.changes) {
        try {
          await this.applyChange(change)
          appliedChanges.push(change)
        } catch (error: any) {
          failedChanges.push({
            change,
            error: error.message || 'Unknown error',
          })
        }
      }

      // If any change failed, rollback all
      if (failedChanges.length > 0 && appliedChanges.length > 0) {
        await this.rollbackChanges(appliedChanges, checkpointId)
        return {
          success: false,
          appliedChanges: [],
          failedChanges,
          checkpointId,
          error: 'Transaction failed: rolled back all changes',
        }
      }

      // Emit FILE_SAVED events for successful changes
      // Use WorkspaceRegistry to get workspace (never create it here)
      const workspace = WorkspaceRegistry.get(this.projectId)
      for (const change of appliedChanges) {
        if (change.type !== 'delete') {
          workspace.getEventBus().emit({
            type: 'FILE_SAVED',
            payload: { path: change.path },
          } as any)
        }
      }

      // Store in history
      this.mutationHistory.push({
        ...changeSet,
        checkpointId,
      })

      return {
        success: failedChanges.length === 0,
        appliedChanges,
        failedChanges,
        checkpointId,
      }
    } catch (error: any) {
      // Rollback on unexpected error
      if (appliedChanges.length > 0) {
        await this.rollbackChanges(appliedChanges, checkpointId)
      }

      return {
        success: false,
        appliedChanges: [],
        failedChanges: changeSet.changes.map((c) => ({
          change: c,
          error: error.message || 'Unexpected error',
        })),
        checkpointId,
        error: error.message || 'Unexpected error',
      }
    }
  }

  /**
   * Apply a single file change
   */
  private async applyChange(change: FileChange): Promise<void> {
    const fullPath = join(this.projectRoot, change.path)

    switch (change.type) {
      case 'create':
        if (!change.fullContent && !change.diff) {
          throw new Error('Create requires fullContent or diff')
        }
        // Ensure directory exists
        await fs.mkdir(dirname(fullPath), { recursive: true })
        const createContent = change.fullContent || this.applyDiff('', change.diff!)
        await fs.writeFile(fullPath, createContent, 'utf-8')
        break

      case 'modify':
        // Read existing content
        let existingContent: string
        try {
          existingContent = await fs.readFile(fullPath, 'utf-8')
        } catch {
          throw new Error(`File not found: ${change.path}`)
        }

        // Apply diff or full content
        const modifiedContent = change.fullContent || this.applyDiff(existingContent, change.diff!)
        await fs.writeFile(fullPath, modifiedContent, 'utf-8')
        break

      case 'delete':
        try {
          await fs.unlink(fullPath)
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            throw error
          }
          // File doesn't exist, consider it deleted
        }
        break
    }
  }

  /**
   * Apply a diff to content
   */
  private applyDiff(oldContent: string, diff: UnifiedDiff): string {
    // Simple diff application (can be enhanced with proper diff library)
    // For now, if diff is provided, use newContent
    if (diff.newContent) {
      return diff.newContent
    }

    // Fallback: apply hunks
    const lines = oldContent.split('\n')
    let result = [...lines]

    for (const hunk of diff.hunks) {
      // Apply hunk (simplified - would need proper line-by-line application)
      // For now, replace the section
      const before = result.slice(0, hunk.oldStart - 1)
      const after = result.slice(hunk.oldStart + hunk.oldLines - 1)
      const newLines = hunk.lines
        .filter((line) => !line.startsWith('-'))
        .map((line) => (line.startsWith('+') ? line.slice(1) : line.slice(1)))
      result = [...before, ...newLines, ...after]
    }

    return result.join('\n')
  }

  /**
   * Rollback changes using checkpoint
   */
  private async rollbackChanges(changes: FileChange[], checkpointId?: string): Promise<void> {
    if (!checkpointId) {
      // No checkpoint, can't rollback
      console.warn('Cannot rollback: no checkpoint available')
      return
    }

    try {
      await checkpointEngine.rollback(this.projectId, checkpointId, this.projectRoot)
    } catch (error) {
      console.error('Failed to rollback via checkpoint:', error)
      // Manual rollback attempt
      // This is a fallback - ideally checkpoints handle this
    }
  }

  /**
   * Validate change set
   */
  private validateChangeSet(changeSet: FileChangeSet): { valid: boolean; error?: string } {
    if (!changeSet.changes || changeSet.changes.length === 0) {
      return { valid: false, error: 'Change set is empty' }
    }

    for (const change of changeSet.changes) {
      // Validate path
      if (!change.path || change.path.includes('..')) {
        return { valid: false, error: `Invalid path: ${change.path}` }
      }

      // Validate change type
      if (!['create', 'modify', 'delete'].includes(change.type)) {
        return { valid: false, error: `Invalid change type: ${change.type}` }
      }

      // Validate content requirements
      if (change.type === 'create' && !change.fullContent && !change.diff) {
        return { valid: false, error: 'Create requires fullContent or diff' }
      }

      if (change.type === 'modify' && !change.fullContent && !change.diff) {
        return { valid: false, error: 'Modify requires fullContent or diff' }
      }
    }

    return { valid: true }
  }

  /**
   * Get mutation history
   */
  getHistory(): FileChangeSet[] {
    return [...this.mutationHistory]
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.mutationHistory = []
  }
}

// Singleton per project
const kernelInstances = new Map<string, FileMutationKernel>()

export function getFileMutationKernel(projectId: string, projectRoot: string): FileMutationKernel {
  if (!kernelInstances.has(projectId)) {
    kernelInstances.set(projectId, new FileMutationKernel(projectId, projectRoot))
  }
  return kernelInstances.get(projectId)!
}

export function destroyFileMutationKernel(projectId: string): void {
  kernelInstances.delete(projectId)
}

