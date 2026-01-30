/**
 * Build Configuration
 * 
 * Manages build configuration and presets.
 */

export interface BuildPreset {
  id: string
  name: string
  buildCommand: string
  flags?: string[]
  env?: Record<string, string>
}

export interface BuildTask {
  id: string
  name: string
  type: 'build' | 'test' | 'run' | 'clean' | 'custom'
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  dependsOn?: string[]
}

/**
 * Build Configuration
 * 
 * Manages build presets and tasks.
 */
export class BuildConfig {
  private static instance: BuildConfig
  private presets: Map<string, BuildPreset> = new Map()
  private tasks: Map<string, BuildTask> = new Map()

  private constructor() {
    this.initializeDefaultPresets()
  }

  static getInstance(): BuildConfig {
    if (!BuildConfig.instance) {
      BuildConfig.instance = new BuildConfig()
    }
    return BuildConfig.instance
  }

  /**
   * Initialize default presets
   */
  private initializeDefaultPresets(): void {
    this.presets.set('debug', {
      id: 'debug',
      name: 'Debug',
      buildCommand: 'build',
      flags: ['-g', '-O0'],
      env: {
        NODE_ENV: 'development',
      },
    })

    this.presets.set('release', {
      id: 'release',
      name: 'Release',
      buildCommand: 'build',
      flags: ['-O2', '-DNDEBUG'],
      env: {
        NODE_ENV: 'production',
      },
    })

    this.presets.set('development', {
      id: 'development',
      name: 'Development',
      buildCommand: 'build',
      flags: [],
      env: {
        NODE_ENV: 'development',
      },
    })
  }

  /**
   * Get preset by ID
   */
  getPreset(presetId: string): BuildPreset | undefined {
    return this.presets.get(presetId)
  }

  /**
   * Register a preset
   */
  registerPreset(preset: BuildPreset): void {
    this.presets.set(preset.id, preset)
  }

  /**
   * Register a task
   */
  registerTask(task: BuildTask): void {
    this.tasks.set(task.id, task)
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): BuildTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * Get all tasks
   */
  getAllTasks(): BuildTask[] {
    return Array.from(this.tasks.values())
  }
}

/**
 * Get Build Config instance
 */
export function getBuildConfig(): BuildConfig {
  return BuildConfig.getInstance()
}
