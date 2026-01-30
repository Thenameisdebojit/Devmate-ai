/**
 * Build Executor
 * 
 * Executes builds using detected build systems.
 */

import { spawn, ChildProcess } from 'child_process'
import { getBuildSystemDetector, BuildSystem } from './BuildSystemDetector'
import { getErrorParser, Diagnostic } from './ErrorParser'
import { EventEmitter } from 'events'

export interface BuildOptions {
  projectPath: string
  buildSystem?: BuildSystem
  target?: string
  clean?: boolean
  parallel?: boolean
  env?: Record<string, string>
}

export interface BuildResult {
  success: boolean
  output: string
  errors: string
  diagnostics: Diagnostic[]
  duration: number
}

/**
 * Build Executor
 * 
 * Executes builds and manages build processes.
 */
export class BuildExecutor extends EventEmitter {
  private static instance: BuildExecutor
  private buildProcesses: Map<string, ChildProcess> = new Map()
  private buildCache: Map<string, { timestamp: number; result: BuildResult }> = new Map()

  private constructor() {
    super()
  }

  static getInstance(): BuildExecutor {
    if (!BuildExecutor.instance) {
      BuildExecutor.instance = new BuildExecutor()
    }
    return BuildExecutor.instance
  }

  /**
   * Execute build
   */
  async build(options: BuildOptions): Promise<BuildResult> {
    const startTime = Date.now()
    const buildId = `${options.projectPath}-${Date.now()}`

    // Detect build system if not provided
    let buildSystem = options.buildSystem
    if (!buildSystem) {
      const detector = getBuildSystemDetector()
      const detected = await detector.detect(options.projectPath)
      buildSystem = detected.buildSystem
    }

    if (buildSystem.type === 'unknown') {
      return {
        success: false,
        output: '',
        errors: 'No build system detected',
        diagnostics: [],
        duration: Date.now() - startTime,
      }
    }

    // Clean if requested
    if (options.clean && buildSystem.cleanCommand) {
      await this.executeCommand(buildSystem.cleanCommand, options.projectPath, options.env)
    }

    // Execute build command
    const buildCommand = options.target 
      ? `${buildSystem.buildCommand} ${options.target}`
      : buildSystem.buildCommand || ''

    if (!buildCommand) {
      return {
        success: false,
        output: '',
        errors: 'No build command available',
        diagnostics: [],
        duration: Date.now() - startTime,
      }
    }

    const result = await this.executeBuild(buildId, buildCommand, options)

    // Parse errors
    const errorParser = getErrorParser()
    const diagnostics = errorParser.parse(result.errors, this.getCompilerType(buildSystem.type))

    const buildResult: BuildResult = {
      success: result.exitCode === 0,
      output: result.stdout,
      errors: result.stderr,
      diagnostics,
      duration: Date.now() - startTime,
    }

    // Cache result
    this.buildCache.set(options.projectPath, {
      timestamp: Date.now(),
      result: buildResult,
    })

    this.emit('build-complete', { buildId, result: buildResult })

    return buildResult
  }

  /**
   * Execute build command
   */
  private async executeBuild(
    buildId: string,
    command: string,
    options: BuildOptions
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ')
      const process = spawn(cmd, args, {
        cwd: options.projectPath,
        env: {
          ...process.env,
          ...options.env,
        },
        shell: true,
      })

      this.buildProcesses.set(buildId, process)

      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        this.emit('build-output', { buildId, data: output })
      })

      process.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        this.emit('build-error', { buildId, data: output })
      })

      process.on('close', (code) => {
        this.buildProcesses.delete(buildId)
        resolve({
          stdout,
          stderr,
          exitCode: code,
        })
      })

      process.on('error', (error) => {
        this.buildProcesses.delete(buildId)
        resolve({
          stdout,
          stderr: error.message,
          exitCode: 1,
        })
      })
    })
  }

  /**
   * Execute a command
   */
  private async executeCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ')
      const process = spawn(cmd, args, {
        cwd,
        env: {
          ...process.env,
          ...env,
        },
        shell: true,
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Command failed with exit code ${code}`))
        }
      })

      process.on('error', reject)
    })
  }

  /**
   * Cancel build
   */
  cancelBuild(buildId: string): void {
    const process = this.buildProcesses.get(buildId)
    if (process) {
      process.kill()
      this.buildProcesses.delete(buildId)
      this.emit('build-cancelled', { buildId })
    }
  }

  /**
   * Get compiler type from build system type
   */
  private getCompilerType(buildSystemType: string): string {
    const mapping: Record<string, string> = {
      'make': 'gcc',
      'cmake': 'gcc',
      'maven': 'javac',
      'gradle': 'javac',
      'npm': 'tsc',
      'yarn': 'tsc',
      'pnpm': 'tsc',
      'cargo': 'rustc',
      'go': 'go',
    }
    return mapping[buildSystemType] || 'gcc'
  }

  /**
   * Get cached build result
   */
  getCachedResult(projectPath: string): BuildResult | null {
    const cached = this.buildCache.get(projectPath)
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.result
    }
    return null
  }
}

/**
 * Get Build Executor instance
 */
export function getBuildExecutor(): BuildExecutor {
  return BuildExecutor.getInstance()
}
