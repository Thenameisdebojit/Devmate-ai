/**
 * PHASE F′-2: Project Evolution Engine Manager
 * 
 * Manages ProjectEvolutionEngine instances per project.
 * Provides singleton access to engines with automatic descriptor inference.
 */

import { ProjectEvolutionEngine, type ProjectDescriptor, createProjectEvolutionEngine, type ProjectStage } from './ProjectEvolutionEngine'
import { promises as fs } from 'fs'
import { join } from 'path'
import { loadStage, saveStage } from './stagePersistence'

/**
 * Manager for ProjectEvolutionEngine instances
 */
class ProjectEvolutionEngineManagerImpl {
  private engines: Map<string, ProjectEvolutionEngine> = new Map()
  private rootPaths: Map<string, string> = new Map() // PHASE A: Store rootPath for persistence

  /**
   * Get or create ProjectEvolutionEngine for a project
   * 
   * If engine doesn't exist, creates one with inferred descriptor.
   * Descriptor is inferred from project files (package.json, etc.)
   * 
   * PHASE A: Loads stage from disk (single source of truth)
   */
  async getEngine(projectId: string, rootPath: string): Promise<ProjectEvolutionEngine> {
    // Store rootPath for persistence
    this.rootPaths.set(projectId, rootPath)
    
    if (this.engines.has(projectId)) {
      return this.engines.get(projectId)!
    }

    // Infer descriptor from project files
    const descriptor = await this.inferDescriptor(projectId, rootPath)
    
    // Create engine
    const engine = createProjectEvolutionEngine(descriptor)
    
    // PHASE A: Load stage from disk (single source of truth)
    try {
      const persistedState = await loadStage(rootPath)
      if (persistedState) {
        engine.setStage(persistedState.stage)
        console.log(`[ProjectEvolutionEngineManager] Loaded stage from disk: ${projectId} → ${persistedState.stage} (updated: ${persistedState.updatedAt}, source: ${persistedState.updatedBy})`)
      } else {
        // No persisted state - engine starts with "empty" (default)
        console.log(`[ProjectEvolutionEngineManager] No persisted stage found for ${projectId}, using default: empty`)
      }
    } catch (error: any) {
      console.warn(`[ProjectEvolutionEngineManager] Failed to load stage from disk for ${projectId}, using default:`, error)
      // Continue with default "empty" stage
    }
    
    this.engines.set(projectId, engine)
    
    return engine
  }

  /**
   * Infer ProjectDescriptor from project files
   */
  private async inferDescriptor(projectId: string, rootPath: string): Promise<ProjectDescriptor> {
    // Default descriptor
    let descriptor: ProjectDescriptor = {
      projectId,
      template: 'custom',
      language: 'js',
      runtime: 'browser',
    }

    try {
      // Try to read package.json
      const packageJsonPath = join(rootPath, 'package.json')
      try {
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(packageJsonContent)

        // Infer template from dependencies
        if (packageJson.dependencies?.react || packageJson.dependencies?.['react-dom']) {
          descriptor.template = 'react'
        } else if (packageJson.dependencies?.express || packageJson.dependencies?.['@types/node']) {
          descriptor.template = 'node'
        } else {
          descriptor.template = 'static-web'
        }

        // Infer language from files or tsconfig
        try {
          await fs.access(join(rootPath, 'tsconfig.json'))
          descriptor.language = 'ts'
        } catch {
          descriptor.language = 'js'
        }

        // Infer runtime
        if (descriptor.template === 'node') {
          descriptor.runtime = 'node'
        } else if (descriptor.template === 'react' || descriptor.template === 'static-web') {
          descriptor.runtime = 'browser'
        }
      } catch {
        // package.json doesn't exist or is invalid - use defaults
      }

      // Check for Python files
      try {
        const files = await fs.readdir(rootPath, { recursive: true, withFileTypes: true })
        const hasPythonFiles = files.some(f => f.isFile() && f.name.endsWith('.py'))
        if (hasPythonFiles) {
          descriptor.language = 'py'
          descriptor.runtime = 'python'
        }
      } catch {
        // Can't read directory - use defaults
      }
    } catch (error) {
      // If inference fails, use defaults
      console.warn(`[ProjectEvolutionEngineManager] Failed to infer descriptor for ${projectId}, using defaults:`, error)
    }

    return descriptor
  }

  /**
   * Get existing engine synchronously (throws if not found)
   * 
   * Use this when engine must already exist.
   * Do NOT use this to create engines - use getEngine() instead.
   */
  get(projectId: string): ProjectEvolutionEngine {
    const engine = this.engines.get(projectId)
    if (!engine) {
      throw new Error(`ProjectEvolutionEngine not found for projectId: ${projectId}. Engine must be created via getEngine() first.`)
    }
    return engine
  }

  /**
   * Get existing engine synchronously (returns null if not found)
   * 
   * Use this for optional checks only.
   */
  getEngineSync(projectId: string): ProjectEvolutionEngine | null {
    return this.engines.get(projectId) || null
  }

  /**
   * Set stage for a project (requires engine to exist)
   * 
   * PHASE A: Persists stage to disk (single source of truth)
   */
  async setStage(
    projectId: string,
    stage: Parameters<ProjectEvolutionEngine['setStage']>[0],
    source: 'bootstrap' | 'recovery' | 'manual' | 'evolution' = 'manual'
  ): Promise<void> {
    const engine = this.get(projectId)
    const previousStage = engine.getStage()
    
    // Update in-memory stage
    engine.setStage(stage)
    
    // PHASE A: Persist to disk (single source of truth)
    const rootPath = this.rootPaths.get(projectId)
    if (rootPath) {
      try {
        await saveStage(rootPath, projectId, stage, source)
        console.log(`[ProjectEvolutionEngineManager] Stage transition: ${projectId} ${previousStage} → ${stage} (source: ${source})`)
      } catch (error: any) {
        console.error(`[ProjectEvolutionEngineManager] Failed to persist stage for ${projectId}:`, error)
        // Don't throw - in-memory update succeeded, persistence failure is logged
      }
    } else {
      console.warn(`[ProjectEvolutionEngineManager] Cannot persist stage for ${projectId}: rootPath not stored`)
    }
  }
}

// Singleton instance
let managerInstance: ProjectEvolutionEngineManagerImpl | null = null

export function getProjectEvolutionEngineManager(): ProjectEvolutionEngineManagerImpl {
  if (!managerInstance) {
    managerInstance = new ProjectEvolutionEngineManagerImpl()
  }
  return managerInstance
}
