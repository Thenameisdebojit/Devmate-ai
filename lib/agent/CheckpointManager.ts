/**
 * PHASE 4: Checkpoint Manager
 * 
 * Wraps checkpointEngine with Phase 4 API:
 * - createCheckpoint(projectId, reason)
 * - rollbackFile(projectId, filePath, checkpointId)
 * - rollbackProject(projectId, checkpointId)
 * 
 * Stores diffs + metadata (intent type, timestamp, etc.)
 */

import { checkpointEngine, type Checkpoint } from '@/lib/runtime/checkpointEngine'
import { join } from 'path'
import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'

export interface CheckpointMetadata {
  intentType?: ExecutionIntent['type']
  intentDescription?: string
  sessionId?: string
  filesAffected?: string[]
}

/**
 * Checkpoint Manager
 * 
 * Provides Phase 4 API for checkpoints and rollback.
 */
export class CheckpointManager {
  /**
   * Create checkpoint before AI write
   * 
   * PHASE 4: Auto checkpoint before every AI write
   * Stores: file diffs, timestamp, intent type
   */
  async createCheckpoint(
    projectId: string,
    reason: string,
    metadata?: CheckpointMetadata
  ): Promise<Checkpoint> {
    const projectPath = join(process.cwd(), 'runtime-projects', projectId)
    
    const description = metadata?.intentType
      ? `${metadata.intentType}: ${metadata.intentDescription || reason}`
      : reason

    const checkpoint = await checkpointEngine.createCheckpoint(
      projectId,
      projectPath,
      description,
      'pre-write'
    )

    // Store additional metadata
    if (metadata) {
      const metadataPath = join(
        process.cwd(),
        'runtime-checkpoints',
        projectId,
        checkpoint.id,
        'phase4-metadata.json'
      )
      try {
        const { promises: fs } = await import('fs')
        await fs.writeFile(
          metadataPath,
          JSON.stringify(metadata, null, 2)
        )
      } catch (error) {
        console.warn('Failed to save checkpoint metadata:', error)
      }
    }

    return checkpoint
  }

  /**
   * Rollback a single file to checkpoint
   * 
   * PHASE 4: Per-file rollback
   * Must emit FILE_CHANGED events
   */
  async rollbackFile(
    projectId: string,
    filePath: string,
    checkpointId?: string
  ): Promise<void> {
    const projectPath = join(process.cwd(), 'runtime-projects', projectId)
    
    // Use latest checkpoint if not specified
    const targetCheckpointId = checkpointId || checkpointEngine.getLatestCheckpoint(projectId)?.id
    
    if (!targetCheckpointId) {
      throw new Error('No checkpoint available for rollback')
    }

    await checkpointEngine.rollback(
      projectId,
      targetCheckpointId,
      projectPath,
      filePath
    )
  }

  /**
   * Rollback entire project to checkpoint
   * 
   * PHASE 4: Full project rollback
   * Must emit FILE_CHANGED events for all rolled back files
   */
  async rollbackProject(
    projectId: string,
    checkpointId?: string
  ): Promise<string[]> {
    const projectPath = join(process.cwd(), 'runtime-projects', projectId)
    
    // Use latest checkpoint if not specified
    const targetCheckpointId = checkpointId || checkpointEngine.getLatestCheckpoint(projectId)?.id
    
    if (!targetCheckpointId) {
      throw new Error('No checkpoint available for rollback')
    }

    const checkpoint = checkpointEngine.getCheckpoint(projectId, targetCheckpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${targetCheckpointId}`)
    }

    await checkpointEngine.rollback(
      projectId,
      targetCheckpointId,
      projectPath
    )

    // Return list of files that were rolled back
    return checkpoint.files
  }

  /**
   * Get latest checkpoint for project
   */
  getLatestCheckpoint(projectId: string): Checkpoint | null {
    return checkpointEngine.getLatestCheckpoint(projectId)
  }

  /**
   * List all checkpoints for project
   */
  listCheckpoints(projectId: string): Checkpoint[] {
    return checkpointEngine.listCheckpoints(projectId)
  }

  /**
   * Get checkpoint metadata
   */
  async getCheckpointMetadata(
    projectId: string,
    checkpointId: string
  ): Promise<CheckpointMetadata | null> {
    const metadataPath = join(
      process.cwd(),
      'runtime-checkpoints',
      projectId,
      checkpointId,
      'phase4-metadata.json'
    )
    
    try {
      const { promises: fs } = await import('fs')
      const content = await fs.readFile(metadataPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }
}

// Singleton instance
let checkpointManagerInstance: CheckpointManager | null = null

export function getCheckpointManager(): CheckpointManager {
  if (!checkpointManagerInstance) {
    checkpointManagerInstance = new CheckpointManager()
  }
  return checkpointManagerInstance
}

