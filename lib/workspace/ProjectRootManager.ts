/**
 * PHASE F: Project Root Manager
 * 
 * Manages persistent project roots on disk.
 * Ensures projects survive restarts and are stored in durable locations.
 * 
 * Single source of truth for project root paths.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface ProjectRootConfig {
  userId?: string
  basePath?: string
}

/**
 * ProjectRootManager
 * 
 * Maps projectId → persistent directory on disk.
 * Uses durable location: ~/devmate/projects/<userId>/<projectId>/
 */
export class ProjectRootManager {
  private static instance: ProjectRootManager
  private basePath: string
  private userId: string

  private constructor(config?: ProjectRootConfig) {
    // PHASE F: Use durable location, not /tmp
    const userHome = homedir()
    this.userId = config?.userId || 'default'
    this.basePath = config?.basePath || join(userHome, 'devmate', 'projects', this.userId)
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: ProjectRootConfig): ProjectRootManager {
    if (!ProjectRootManager.instance) {
      ProjectRootManager.instance = new ProjectRootManager(config)
    }
    return ProjectRootManager.instance
  }

  /**
   * Get persistent root path for a project
   * 
   * Creates directory if missing.
   * Validates permissions.
   * 
   * @throws Error if directory cannot be created or accessed
   */
  async getProjectRoot(projectId: string): Promise<string> {
    if (!projectId) {
      throw new Error('Invariant violation: projectId is required for getProjectRoot')
    }

    const projectRoot = join(this.basePath, projectId)

    try {
      // Ensure base directory exists
      await fs.mkdir(this.basePath, { recursive: true })
      
      // Ensure project directory exists
      await fs.mkdir(projectRoot, { recursive: true })

      // Validate permissions by attempting to write a test file
      // On Windows, file deletion may fail due to file locking (antivirus, indexing, etc.)
      // If write succeeds, we have write access - deletion failure is acceptable
      const testFile = join(projectRoot, '.devmate-test')
      try {
        await fs.writeFile(testFile, 'test', 'utf8')
        // Try to delete, but don't fail if it's locked (Windows file locking issue)
        try {
          await fs.unlink(testFile)
        } catch (unlinkError: any) {
          // On Windows, EPERM/EBUSY errors are common due to file locking
          // If write succeeded, we have write access - deletion failure is acceptable
          if (unlinkError.code === 'EPERM' || unlinkError.code === 'EBUSY' || unlinkError.code === 'ENOENT') {
            // File is locked or already deleted - this is acceptable on Windows
            // The write succeeded, which proves we have write access
            console.warn(`[ProjectRootManager] Could not delete test file (likely Windows file locking): ${unlinkError.code}. Write access confirmed.`)
          } else {
            // Other errors might indicate real permission issues
            throw unlinkError
          }
        }
      } catch (permError: any) {
        // Write failed - this is a real permission issue
        throw new Error(
          `Invariant violation: Cannot write to project root. ` +
          `projectId: ${projectId}, rootPath: ${projectRoot}, error: ${permError.message}`
        )
      }

      return projectRoot
    } catch (error: any) {
      throw new Error(
        `Invariant violation: Failed to create or access project root. ` +
        `projectId: ${projectId}, rootPath: ${projectRoot}, error: ${error.message}`
      )
    }
  }

  /**
   * Initialize git repository in project root (optional)
   */
  async initializeGit(projectId: string): Promise<void> {
    try {
      const projectRoot = await this.getProjectRoot(projectId)
      const gitDir = join(projectRoot, '.git')

      // Check if git already initialized
      try {
        await fs.access(gitDir)
        return // Git already initialized
      } catch {
        // Git not initialized, continue
      }

      // Initialize git repository
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      await execAsync('git init', { cwd: projectRoot })
      
      // Create .gitignore if it doesn't exist
      const gitignorePath = join(projectRoot, '.gitignore')
      try {
        await fs.access(gitignorePath)
      } catch {
        // Create default .gitignore
        const defaultGitignore = [
          'node_modules/',
          '.next/',
          '.devmate-test',
          '*.log',
          '.env.local',
          '.env',
          'dist/',
          'build/',
        ].join('\n')
        await fs.writeFile(gitignorePath, defaultGitignore, 'utf8')
      }
    } catch (error: any) {
      // Log but don't fail - git initialization is optional
      console.warn(`[ProjectRootManager] Failed to initialize git for projectId: ${projectId}`, error)
    }
  }

  /**
   * Check if project root exists
   */
  async projectRootExists(projectId: string): Promise<boolean> {
    try {
      const projectRoot = await this.getProjectRoot(projectId)
      await fs.access(projectRoot)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get base path for all projects
   */
  getBasePath(): string {
    return this.basePath
  }

  /**
   * Get user ID
   */
  getUserId(): string {
    return this.userId
  }
}

/**
 * Get project root manager instance
 */
export function getProjectRootManager(config?: ProjectRootConfig): ProjectRootManager {
  return ProjectRootManager.getInstance(config)
}
