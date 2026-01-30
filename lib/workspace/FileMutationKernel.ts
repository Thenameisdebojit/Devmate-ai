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
import { join, dirname, normalize } from 'path'
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
  mode?: 'normal' | 'generation' // Generation mode bypasses context/confidence checks
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

    // PHASE E: Invariant check - rootPath must exist
    if (!this.projectRoot) {
      throw new Error(`Invariant violation: FileMutationKernel.projectRoot is missing for projectId: ${this.projectId}`)
    }

    // Generation mode: bypass context and confidence checks
    const isGenerationMode = changeSet.mode === 'generation'
    
    // PHASE F′-2: Check OS-level capabilities (unless in generation mode)
    if (!isGenerationMode) {
      try {
        const { getProjectEvolutionEngineManager } = await import('@/lib/os/ProjectEvolutionEngineManager')
        const peeManager = getProjectEvolutionEngineManager()
        const pee = peeManager.getEngineSync(this.projectId)
        
        if (pee) {
          const capabilities = pee.getCapabilities()
          if (capabilities.aiWrite === false) {
            return {
              success: false,
              appliedChanges: [],
              failedChanges: changeSet.changes.map((c) => ({
                change: c,
                error: `File writes blocked by OS: Project is in "${pee.getStage()}" stage, which doesn't allow AI writes.`,
              })),
              error: `File writes not allowed in current project stage: ${pee.getStage()}`,
            }
          }
        }
      } catch (error: any) {
        // If PEE check fails, log warning but don't block (backward compatibility)
        console.warn('[FileMutationKernel] Failed to check OS capabilities:', error)
      }
    }
    
    // Validate change set (always validate, even in generation mode)
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

    // Check confidence gate (bypassed in generation mode)
    if (!isGenerationMode && requireHighConfidence) {
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

    // PHASE 4: Create checkpoint if requested (MANDATORY for AI writes)
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
      } catch (error: any) {
        // PHASE 4: FAIL LOUDLY - No checkpoint = no AI write
        console.error('Failed to create checkpoint:', error)
        return {
          success: false,
          appliedChanges: [],
          failedChanges: changeSet.changes.map((c) => ({
            change: c,
            error: `Checkpoint creation failed: ${error.message || 'Unknown error'}. Cannot proceed without checkpoint.`,
          })),
          error: `Checkpoint creation failed: ${error.message || 'Unknown error'}. Cannot proceed without checkpoint.`,
        }
      }
    } else {
      // PHASE 4: Warn if checkpoint not requested for AI writes (but allow in generation mode)
      if (!isGenerationMode) {
        console.warn('[FileMutationKernel] Mutation requested without checkpoint. This should only happen for manual user edits.')
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
          // PHASE F: Log successful file creation for debugging
          if (change.type === 'create' && isGenerationMode) {
            console.log(`[FileMutationKernel] Successfully created file: ${change.path}`)
          }
        } catch (error: any) {
          // PHASE F: Log detailed error for debugging
          console.error(`[FileMutationKernel] Failed to apply change: ${change.path}`, {
            type: change.type,
            error: error.message,
            projectId: this.projectId,
            rootPath: this.projectRoot,
            fullPath: join(this.projectRoot, change.path),
          })
          failedChanges.push({
            change,
            error: error.message || 'Unknown error',
          })
        }
      }

      // If any change failed, rollback all (unless in generation mode, where we allow partial success)
      if (failedChanges.length > 0 && appliedChanges.length > 0) {
        // PHASE F: In generation mode, allow partial success (some files created is better than none)
        if (!isGenerationMode) {
          await this.rollbackChanges(appliedChanges, checkpointId)
          return {
            success: false,
            appliedChanges: [],
            failedChanges,
            checkpointId,
            error: 'Transaction failed: rolled back all changes',
          }
        } else {
          // Generation mode: log failures but continue with successful changes
          console.warn(`[FileMutationKernel] Generation mode: ${failedChanges.length} file(s) failed, but ${appliedChanges.length} file(s) succeeded. Continuing with successful changes.`)
        }
      }
      
      // If all changes failed, return error
      if (failedChanges.length > 0 && appliedChanges.length === 0) {
        return {
          success: false,
          appliedChanges: [],
          failedChanges,
          checkpointId,
          error: `All changes failed. First error: ${failedChanges[0].error}`,
        }
      }

      // PHASE E: Verify files were written to disk (invariant check)
      const { promises: fs } = await import('fs')
      const writtenFiles: string[] = []
      for (const change of appliedChanges) {
        if (change.type !== 'delete') {
          const fullPath = join(this.projectRoot, change.path)
          try {
            await fs.access(fullPath)
            writtenFiles.push(change.path)
          } catch (err) {
            // Hard error if file not found after write
            throw new Error(
              `Invariant violation: File not found on disk after write. ` +
              `projectId: ${this.projectId}, filePath: ${change.path}, fullPath: ${fullPath}, rootPath: ${this.projectRoot}`
            )
          }
        }
      }
      
      // Verify all files were written
      if (writtenFiles.length !== appliedChanges.filter(c => c.type !== 'delete').length) {
        throw new Error(
          `Invariant violation: Not all files were written to disk. ` +
          `projectId: ${this.projectId}, expected: ${appliedChanges.filter(c => c.type !== 'delete').length}, ` +
          `written: ${writtenFiles.length}, rootPath: ${this.projectRoot}`
        )
      }

      // Emit FILE_CHANGED and FILE_SAVED events for successful changes
      // PHASE F: Use WorkspaceRegistry to get workspace (never create it here)
      const workspace = await WorkspaceRegistry.get(this.projectId)
      for (const change of appliedChanges) {
        if (change.type !== 'delete') {
          // Emit FILE_CHANGED for UI updates (file list refresh)
          workspace.getEventBus().emit({
            type: 'FILE_CHANGED',
            payload: {
              path: change.path,
              content: change.fullContent || '',
              modifiedByAI: false, // User edits are not AI-modified
            },
          } as any)
          
          // Emit FILE_SAVED for state tracking
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
        // Allow empty strings for fullContent (valid for new files)
        // Only require fullContent or diff if both are undefined/null
        if (change.fullContent === undefined && !change.diff) {
          throw new Error('Create requires fullContent or diff')
        }
        // Ensure directory exists
        const dir = dirname(fullPath)
        await fs.mkdir(dir, { recursive: true })
        // fullContent can be empty string for new files, or use diff
        const createContent = change.fullContent !== undefined ? change.fullContent : this.applyDiff('', change.diff!)
        console.log(`[FileMutationKernel] Creating file: ${change.path}`, { 
          fullPath, 
          contentLength: createContent.length,
          projectRoot: this.projectRoot
        })
        await fs.writeFile(fullPath, createContent, 'utf-8')
        // Verify file was written
        try {
          const stats = await fs.stat(fullPath)
          console.log(`[FileMutationKernel] File created successfully: ${change.path}`, { size: stats.size })
        } catch (statError) {
          console.error(`[FileMutationKernel] ERROR: File created but cannot stat: ${change.path}`, statError)
        }
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
      // Allow empty strings for create (valid for new files)
      // Only require fullContent or diff if both are undefined
      if (change.type === 'create' && change.fullContent === undefined && !change.diff) {
        return { valid: false, error: 'Create requires fullContent or diff' }
      }

      if (change.type === 'modify' && change.fullContent === undefined && !change.diff) {
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
  // PHASE E: Invariant checks
  if (!projectId) {
    throw new Error('Invariant violation: projectId is required for getFileMutationKernel')
  }
  if (!projectRoot) {
    throw new Error(`Invariant violation: projectRoot is required for projectId: ${projectId}`)
  }
  
  // Normalize paths for consistent comparison (handles Windows case sensitivity and separators)
  const normalizedProjectRoot = normalize(projectRoot)
  
  if (!kernelInstances.has(projectId)) {
    kernelInstances.set(projectId, new FileMutationKernel(projectId, normalizedProjectRoot))
  } else {
    // PHASE E: Verify rootPath consistency (hard error on mismatch)
    const existing = kernelInstances.get(projectId)!
    const existingRoot = (existing as any).projectRoot
    const normalizedExistingRoot = normalize(existingRoot)
    
    // Compare normalized paths
    if (normalizedExistingRoot !== normalizedProjectRoot) {
      // If paths don't match, destroy old instance and create new one with correct path
      console.warn(
        `[FileMutationKernel] Root path mismatch detected. ` +
        `projectId: ${projectId}, existingRoot: ${existingRoot}, requestedRoot: ${projectRoot}. ` +
        `Recreating kernel instance with correct path.`
      )
      kernelInstances.delete(projectId)
      kernelInstances.set(projectId, new FileMutationKernel(projectId, normalizedProjectRoot))
    }
  }
  return kernelInstances.get(projectId)!
}

export function destroyFileMutationKernel(projectId: string): void {
  kernelInstances.delete(projectId)
}

