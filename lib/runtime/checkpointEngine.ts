/**
 * Checkpoint Engine
 * 
 * Provides checkpoint, rollback, and diff capabilities for safe AI operations.
 * 
 * FEATURES:
 * - Auto-snapshot before AI writes
 * - Diff generation after writes
 * - Hidden Git or filesystem snapshots
 * - Per-file and full app rollback
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { nanoid } from 'nanoid'

const execAsync = promisify(exec)

export interface Checkpoint {
  id: string
  projectId: string
  timestamp: number
  description: string
  type: 'auto' | 'manual' | 'pre-write'
  files: string[] // List of files in checkpoint
  metadata: {
    trigger: string // What caused this checkpoint
    fileCount: number
    totalSize: number
  }
}

export interface FileDiff {
  path: string
  type: 'created' | 'modified' | 'deleted'
  oldContent?: string
  newContent?: string
  checksum?: {
    old: string
    new: string
  }
}

export interface CheckpointDiff {
  checkpointId: string
  files: FileDiff[]
  summary: {
    created: number
    modified: number
    deleted: number
  }
}

export class CheckpointEngine {
  private checkpoints: Map<string, Checkpoint[]> = new Map()
  private readonly CHECKPOINTS_DIR = join(process.cwd(), 'runtime-checkpoints')
  private readonly USE_GIT = true // Use Git for snapshots if available

  constructor() {
    this.ensureCheckpointsDir()
  }

  private async ensureCheckpointsDir() {
    try {
      await fs.mkdir(this.CHECKPOINTS_DIR, { recursive: true })
    } catch (error) {
      console.error('Failed to create checkpoints directory:', error)
    }
  }

  /**
   * Create a checkpoint before AI write operation
   * AGENT RULE: Checkpoints are mandatory before writes
   */
  async createCheckpoint(
    projectId: string,
    projectPath: string,
    description: string = 'Auto-checkpoint before AI write',
    type: Checkpoint['type'] = 'pre-write'
  ): Promise<Checkpoint> {
    const checkpointId = `checkpoint-${nanoid(12)}`
    const checkpointPath = join(this.CHECKPOINTS_DIR, projectId, checkpointId)

    try {
      await fs.mkdir(checkpointPath, { recursive: true })

      // Get list of files
      const files = await this.getAllFiles(projectPath)
      const fileCount = files.length
      let totalSize = 0

      // Create snapshot
      if (this.USE_GIT) {
        // Try Git-based snapshot (more efficient)
        try {
          await this.createGitSnapshot(projectPath, checkpointPath, checkpointId)
        } catch (error) {
          // Fallback to filesystem copy
          await this.createFilesystemSnapshot(projectPath, checkpointPath, files)
        }
      } else {
        // Filesystem-based snapshot
        await this.createFilesystemSnapshot(projectPath, checkpointPath, files)
      }

      // Calculate total size
      for (const file of files) {
        try {
          const stats = await fs.stat(join(projectPath, file))
          totalSize += stats.size
        } catch {
          // File might not exist
        }
      }

      const checkpoint: Checkpoint = {
        id: checkpointId,
        projectId,
        timestamp: Date.now(),
        description,
        type,
        files,
        metadata: {
          trigger: 'pre-write',
          fileCount,
          totalSize,
        },
      }

      // Store checkpoint metadata
      if (!this.checkpoints.has(projectId)) {
        this.checkpoints.set(projectId, [])
      }
      this.checkpoints.get(projectId)!.push(checkpoint)

      // Save checkpoint metadata
      await fs.writeFile(
        join(checkpointPath, 'metadata.json'),
        JSON.stringify(checkpoint, null, 2)
      )

      return checkpoint
    } catch (error: any) {
      throw new Error(`Failed to create checkpoint: ${error.message}`)
    }
  }

  /**
   * Create Git-based snapshot (more efficient)
   */
  private async createGitSnapshot(
    projectPath: string,
    checkpointPath: string,
    checkpointId: string
  ): Promise<void> {
    // Initialize Git repo if not exists
    try {
      await execAsync('git rev-parse --git-dir', { cwd: projectPath })
    } catch {
      // Not a Git repo, initialize
      await execAsync('git init', { cwd: projectPath })
      await execAsync('git config user.email "devmate@checkpoint"', { cwd: projectPath })
      await execAsync('git config user.name "Devmate Checkpoint"', { cwd: projectPath })
    }

    // Stage all files
    await execAsync('git add -A', { cwd: projectPath })

    // Create commit with checkpoint ID
    try {
      await execAsync(`git commit -m "Checkpoint: ${checkpointId}"`, { cwd: projectPath })
    } catch {
      // No changes to commit (all files already committed)
    }

    // Create archive of this commit
    await execAsync(
      `git archive HEAD -o ${join(checkpointPath, 'snapshot.tar')}`,
      { cwd: projectPath }
    )
  }

  /**
   * Create filesystem-based snapshot
   */
  private async createFilesystemSnapshot(
    projectPath: string,
    checkpointPath: string,
    files: string[]
  ): Promise<void> {
    for (const file of files) {
      const sourcePath = join(projectPath, file)
      const destPath = join(checkpointPath, file)

      try {
        const stats = await fs.stat(sourcePath)
        if (stats.isFile()) {
          await fs.mkdir(join(destPath, '..'), { recursive: true })
          await fs.copyFile(sourcePath, destPath)
        }
      } catch (error) {
        // File might not exist or be inaccessible
        console.warn(`Failed to snapshot file ${file}:`, error)
      }
    }
  }

  /**
   * Get all files in project (recursive)
   */
  private async getAllFiles(dir: string, basePath: string = ''): Promise<string[]> {
    const files: string[] = []
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      // Skip hidden files and common ignore patterns
      if (entry.name.startsWith('.') && entry.name !== '.git') {
        continue
      }

      const fullPath = join(dir, entry.name)
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) {
          continue
        }
        const subFiles = await this.getAllFiles(fullPath, relativePath)
        files.push(...subFiles)
      } else {
        files.push(relativePath)
      }
    }

    return files
  }

  /**
   * Generate diff between checkpoint and current state
   */
  async generateDiff(
    projectId: string,
    checkpointId: string,
    projectPath: string
  ): Promise<CheckpointDiff> {
    const checkpoint = this.getCheckpoint(projectId, checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`)
    }

    const checkpointPath = join(this.CHECKPOINTS_DIR, projectId, checkpointId)
    const diffs: FileDiff[] = []

    // Get current files
    const currentFiles = await this.getAllFiles(projectPath)
    const checkpointFiles = checkpoint.files

    // Find created files
    for (const file of currentFiles) {
      if (!checkpointFiles.includes(file)) {
        try {
          const content = await fs.readFile(join(projectPath, file), 'utf-8')
          diffs.push({
            path: file,
            type: 'created',
            newContent: content,
            checksum: {
              old: '',
              new: this.computeChecksum(content),
            },
          })
        } catch {
          // File might be inaccessible
        }
      }
    }

    // Find deleted files
    for (const file of checkpointFiles) {
      if (!currentFiles.includes(file)) {
        try {
          const oldContent = await fs.readFile(join(checkpointPath, file), 'utf-8')
          diffs.push({
            path: file,
            type: 'deleted',
            oldContent,
            checksum: {
              old: this.computeChecksum(oldContent),
              new: '',
            },
          })
        } catch {
          // File might not exist in checkpoint
        }
      }
    }

    // Find modified files
    for (const file of currentFiles) {
      if (checkpointFiles.includes(file)) {
        try {
          const currentContent = await fs.readFile(join(projectPath, file), 'utf-8')
          const checkpointContent = await fs.readFile(join(checkpointPath, file), 'utf-8')

          if (currentContent !== checkpointContent) {
            diffs.push({
              path: file,
              type: 'modified',
              oldContent: checkpointContent,
              newContent: currentContent,
              checksum: {
                old: this.computeChecksum(checkpointContent),
                new: this.computeChecksum(currentContent),
              },
            })
          }
        } catch {
          // File might not exist in one location
        }
      }
    }

    return {
      checkpointId,
      files: diffs,
      summary: {
        created: diffs.filter((d) => d.type === 'created').length,
        modified: diffs.filter((d) => d.type === 'modified').length,
        deleted: diffs.filter((d) => d.type === 'deleted').length,
      },
    }
  }

  /**
   * Rollback to checkpoint
   */
  async rollback(
    projectId: string,
    checkpointId: string,
    projectPath: string,
    filePath?: string // If provided, rollback only this file
  ): Promise<void> {
    const checkpoint = this.getCheckpoint(projectId, checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`)
    }

    const checkpointPath = join(this.CHECKPOINTS_DIR, projectId, checkpointId)

    if (filePath) {
      // Per-file rollback
      await this.rollbackFile(checkpointPath, projectPath, filePath)
    } else {
      // Full app rollback
      await this.rollbackFull(checkpointPath, projectPath, checkpoint.files)
    }
  }

  /**
   * Rollback a single file
   */
  private async rollbackFile(
    checkpointPath: string,
    projectPath: string,
    filePath: string
  ): Promise<void> {
    const sourceFile = join(checkpointPath, filePath)
    const destFile = join(projectPath, filePath)

    try {
      await fs.access(sourceFile)
      await fs.mkdir(join(destFile, '..'), { recursive: true })
      await fs.copyFile(sourceFile, destFile)
    } catch (error: any) {
      throw new Error(`Failed to rollback file ${filePath}: ${error.message}`)
    }
  }

  /**
   * Rollback full project
   */
  private async rollbackFull(
    checkpointPath: string,
    projectPath: string,
    files: string[]
  ): Promise<void> {
    for (const file of files) {
      try {
        await this.rollbackFile(checkpointPath, projectPath, file)
      } catch (error) {
        console.warn(`Failed to rollback file ${file}:`, error)
      }
    }
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(projectId: string, checkpointId: string): Checkpoint | null {
    const checkpoints = this.checkpoints.get(projectId)
    if (!checkpoints) return null
    return checkpoints.find((c) => c.id === checkpointId) || null
  }

  /**
   * List all checkpoints for a project
   */
  listCheckpoints(projectId: string): Checkpoint[] {
    return this.checkpoints.get(projectId) || []
  }

  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(projectId: string): Checkpoint | null {
    const checkpoints = this.listCheckpoints(projectId)
    if (checkpoints.length === 0) return null
    return checkpoints.sort((a, b) => b.timestamp - a.timestamp)[0]
  }

  /**
   * Compute simple checksum for change detection
   */
  private computeChecksum(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(projectId: string, checkpointId: string): Promise<void> {
    const checkpointPath = join(this.CHECKPOINTS_DIR, projectId, checkpointId)
    try {
      await fs.rm(checkpointPath, { recursive: true, force: true })
    } catch (error) {
      console.warn(`Failed to delete checkpoint ${checkpointId}:`, error)
    }

    const checkpoints = this.checkpoints.get(projectId)
    if (checkpoints) {
      const filtered = checkpoints.filter((c) => c.id !== checkpointId)
      this.checkpoints.set(projectId, filtered)
    }
  }
}

// Singleton instance
export const checkpointEngine = new CheckpointEngine()

