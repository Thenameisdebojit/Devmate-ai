/**
 * Runtime Kernel
 * 
 * Single source of truth for runtime execution lifecycle.
 * Owns PTY, child processes, preview server, and runtime state.
 * 
 * RULES:
 * - Singleton per project
 * - Lives in backend memory
 * - Survives UI reloads
 * - UI is viewer + controller, never owner
 * - API routes delegate to kernel, never spawn processes directly
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { containerManager, ContainerStatus } from './containerManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { join } from 'path'
import { promises as fs } from 'fs'

export interface RuntimeState {
  projectId: string
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed'
  containerId?: string
  containerPort?: number
  previewPort?: number
  previewUrl?: string
  previewStatus: 'idle' | 'starting' | 'running' | 'stopped'
  ptyActive: boolean
  buildStatus: 'idle' | 'building' | 'success' | 'failed'
  buildErrors: Array<{ file: string; line: number; message: string }>
  lastUpdated: number
}

export interface PTYSession {
  sessionId: string
  process: ChildProcess
  projectId: string
  createdAt: number
  lastActivity: number
}

type Unsubscribe = () => void

/**
 * Runtime Kernel
 * Owns all execution lifecycle for a project
 */
export class RuntimeKernel extends EventEmitter {
  private static instances: Map<string, RuntimeKernel> = new Map()

  private projectId: string
  private state: RuntimeState
  private ptySession: PTYSession | null = null
  private devServerProcess: ChildProcess | null = null
  private buildProcess: ChildProcess | null = null
  private stateSubscribers: Set<(state: RuntimeState) => void> = new Set()
  private ptyOutputBuffer: string = ''
  private previewPortDetectionRegex = /(?:Local|ready|listening).*?(\d{4,5})/i

  private constructor(projectId: string) {
    super()
    this.projectId = projectId
    this.state = this.createInitialState(projectId)
  }

  /**
   * Get or create RuntimeKernel instance for project
   * Singleton pattern - one kernel per project
   */
  static get(projectId: string): RuntimeKernel {
    if (!this.instances.has(projectId)) {
      this.instances.set(projectId, new RuntimeKernel(projectId))
    }
    return this.instances.get(projectId)!
  }

  /**
   * Destroy kernel instance (cleanup)
   */
  static destroy(projectId: string): void {
    const kernel = this.instances.get(projectId)
    if (kernel) {
      kernel.stopRuntime()
      this.instances.delete(projectId)
    }
  }

  /**
   * Create initial runtime state
   */
  private createInitialState(projectId: string): RuntimeState {
    return {
      projectId,
      status: 'idle',
      previewStatus: 'idle',
      ptyActive: false,
      buildStatus: 'idle',
      buildErrors: [],
      lastUpdated: Date.now(),
    }
  }

  /**
   * Get current runtime state (read-only)
   */
  getState(): Readonly<RuntimeState> {
    return { ...this.state }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: RuntimeState) => void): Unsubscribe {
    this.stateSubscribers.add(callback)
    // Immediately send current state
    callback(this.getState())

    return () => {
      this.stateSubscribers.delete(callback)
    }
  }

  /**
   * Update state and notify subscribers
   */
  private updateState(updates: Partial<RuntimeState>): void {
    this.state = {
      ...this.state,
      ...updates,
      lastUpdated: Date.now(),
    }

    // Notify subscribers
    this.stateSubscribers.forEach((cb) => cb(this.getState()))

    // Emit state change event
    this.emit('stateChanged', this.getState())
  }

  /**
   * Start runtime (container + dev server)
   * TASK 6: RuntimeKernel MUST resolve workspace via WorkspaceRegistry.get(projectId)
   */
  async startRuntime(): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'starting') {
      throw new Error('Runtime is already running or starting')
    }

    // TASK 6: Resolve workspace via WorkspaceRegistry
    let rootPath: string
    try {
      const workspace = WorkspaceRegistry.get(this.projectId)
      rootPath = WorkspaceRegistry.getRootPath(this.projectId)
      
      // TASK 6: If workspace rootPath does not exist → throw
      await fs.access(rootPath)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Workspace rootPath does not exist — workspace not initialized`)
      }
      throw new Error(`Workspace not registered for projectId: ${this.projectId}. Call /api/workspace/init first.`)
    }

    this.updateState({ status: 'starting' })

    try {
      // Get container status
      const containerStatus = containerManager.getContainerStatus(this.projectId)

      if (!containerStatus || containerStatus.status !== 'running') {
        // Container not running - this should be handled by caller
        // But we'll emit event for agent observation
        this.emitRuntimeEvent('RUNTIME_STARTED', {
          error: 'Container not running',
        })
        throw new Error('Container not running. Start container first.')
      }

      this.updateState({
        status: 'running',
        containerId: containerStatus.id,
        containerPort: containerStatus.port,
        previewUrl: containerStatus.previewUrl,
      })

      // Emit RUNTIME_STARTED event
      this.emitRuntimeEvent('RUNTIME_STARTED', {
        containerId: containerStatus.id,
        port: containerStatus.port || 0,
      })

      // Start dev server if not already running
      await this.startDevServer()

      // Start preview detection
      this.detectPreviewPort()
    } catch (error: any) {
      this.updateState({ status: 'crashed' })
      this.emitRuntimeEvent('RUNTIME_CRASHED', {
        error: error.message || 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Stop runtime (kills all processes)
   */
  async stopRuntime(): Promise<void> {
    if (this.state.status === 'stopped' || this.state.status === 'stopping') {
      return
    }

    this.updateState({ status: 'stopping' })

    // Kill dev server
    if (this.devServerProcess) {
      this.devServerProcess.kill('SIGTERM')
      this.devServerProcess = null
    }

    // Kill build process
    if (this.buildProcess) {
      this.buildProcess.kill('SIGTERM')
      this.buildProcess = null
    }

    // PTY is persistent - don't kill it on stop
    // It will be cleaned up when container stops

    this.updateState({
      status: 'stopped',
      previewStatus: 'stopped',
      previewPort: undefined,
      previewUrl: undefined,
    })

    // Emit RUNTIME_STOPPED event
    this.emitRuntimeEvent('RUNTIME_STOPPED', {})
  }

  /**
   * Attach to PTY (creates if doesn't exist, reuses if exists)
   * Exactly ONE PTY per project
   */
  attachPTY(): PTYSession {
    // If PTY already exists and is alive, reuse it
    if (this.ptySession && this.ptySession.process && !this.ptySession.process.killed) {
      this.ptySession.lastActivity = Date.now()
      return this.ptySession
    }

    // Get container status
    const containerStatus = containerManager.getContainerStatus(this.projectId)
    if (!containerStatus || containerStatus.status !== 'running') {
      throw new Error('Container not running. Cannot attach PTY.')
    }

    // Create new PTY session
    const sessionId = `pty-${this.projectId}-${Date.now()}`
    const ptyProcess = spawn('docker', ['exec', '-it', containerStatus.id, 'sh'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    })

    // Handle PTY output
    ptyProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      this.ptyOutputBuffer += output
      
      // Detect preview port from output
      this.detectPreviewPortFromOutput(output)

      // Emit output event
      this.emit('ptyOutput', { sessionId, data: output })

      // Update last activity
      if (this.ptySession) {
        this.ptySession.lastActivity = Date.now()
      }
    })

    ptyProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString()
      this.emit('ptyError', { sessionId, data: output })
    })

    ptyProcess.on('close', (code) => {
      // PTY closed - mark as inactive but don't remove session
      // It will be recreated on next attach
      this.updateState({ ptyActive: false })
      this.emit('ptyClose', { sessionId, code })
    })

    ptyProcess.on('error', (error) => {
      this.emit('ptyError', { sessionId, error: error.message })
      this.updateState({ ptyActive: false })
    })

    this.ptySession = {
      sessionId,
      process: ptyProcess,
      projectId: this.projectId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    }

    this.updateState({ ptyActive: true })

    return this.ptySession
  }

  /**
   * Write input to PTY
   */
  writeToPTY(input: string): void {
    if (!this.ptySession || !this.ptySession.process || this.ptySession.process.killed) {
      throw new Error('PTY not attached. Call attachPTY() first.')
    }

    this.ptySession.process.stdin.write(input)
    this.ptySession.lastActivity = Date.now()
  }

  /**
   * Resize PTY
   */
  resizePTY(cols: number, rows: number): void {
    if (!this.ptySession || !this.ptySession.process || this.ptySession.process.killed) {
      return
    }

    // Docker exec doesn't support resize directly, but we can try
    // For now, just update state
    this.emit('ptyResize', { cols, rows })
  }

  /**
   * Start dev server (spawned by kernel)
   */
  private async startDevServer(): Promise<void> {
    if (this.devServerProcess && !this.devServerProcess.killed) {
      return // Already running
    }

    const containerStatus = containerManager.getContainerStatus(this.projectId)
    if (!containerStatus || containerStatus.status !== 'running') {
      return
    }

    // PHASE 5: Detect framework and start appropriate dev server
    const projectPath = join(process.cwd(), 'runtime-projects', this.projectId)
    
    try {
      // Use containerManager's framework detection
      const frameworkInfo = await containerManager.detectFramework(projectPath)
      
      const packageJsonPath = join(projectPath, 'package.json')
      let devCommand: string
      
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
        devCommand = frameworkInfo.startCommand || packageJson.scripts?.dev || packageJson.scripts?.start || 'npm run dev'
      } catch {
        devCommand = frameworkInfo.startCommand || 'npm run dev'
      }

      // PHASE 5: Set expected port from framework detection
      if (frameworkInfo.port) {
        const containerPort = containerStatus.port || frameworkInfo.port
        const previewUrl = `http://localhost:${containerPort}`
        this.updateState({
          previewPort: containerPort,
          previewUrl,
          previewStatus: 'starting',
        })
      }

      // Spawn dev server in container
      this.devServerProcess = spawn('docker', ['exec', '-d', containerStatus.id, 'sh', '-c', devCommand], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      // Monitor dev server output for port detection
      this.devServerProcess.stdout?.on('data', (data: Buffer) => {
        this.detectPreviewPortFromOutput(data.toString())
      })

      this.devServerProcess.stderr?.on('data', (data: Buffer) => {
        this.detectPreviewPortFromOutput(data.toString())
      })

      this.devServerProcess.on('close', (code) => {
        if (code !== 0 && this.state.status === 'running') {
          // Dev server crashed
          this.updateState({ previewStatus: 'stopped' })
          this.emitRuntimeEvent('RUNTIME_CRASHED', {
            error: `Dev server exited with code ${code}`,
          })
        }
        this.devServerProcess = null
      })
    } catch (error) {
      console.error('Failed to start dev server:', error)
    }
  }

  /**
   * PHASE 5: Detect preview port from PTY/dev server output
   * Enhanced detection for multiple frameworks
   */
  private detectPreviewPortFromOutput(output: string): void {
    // Try multiple regex patterns for different frameworks
    const patterns = [
      /(?:Local|ready|listening|running).*?(\d{4,5})/i,
      /(?:http:\/\/localhost:)(\d{4,5})/i,
      /(?:http:\/\/127\.0\.0\.1:)(\d{4,5})/i,
      /(?:port\s+)(\d{4,5})/i,
      /(?:on\s+port\s+)(\d{4,5})/i,
    ]

    for (const pattern of patterns) {
      const match = output.match(pattern)
      if (match && match[1]) {
        const port = parseInt(match[1], 10)
        if (port >= 3000 && port <= 9999) {
          // PHASE 5: Map container port to preview URL
          const containerStatus = containerManager.getContainerStatus(this.projectId)
          const containerPort = containerStatus?.port
          
          // Use container port mapping if available, otherwise use detected port
          const previewPort = containerPort || port
          const previewUrl = containerPort 
            ? `http://localhost:${containerPort}` 
            : `http://localhost:${port}`
          
          if (this.state.previewPort !== previewPort) {
            this.updateState({
              previewPort: previewPort,
              previewUrl,
              previewStatus: 'running',
            })
            
            // Emit preview ready event
            this.emitRuntimeEvent('PREVIEW_READY', {
              previewUrl,
              port: previewPort,
            })
          }
          break
        }
      }
    }
  }

  /**
   * Periodically detect preview port
   */
  private detectPreviewPort(): void {
    // Check container logs for port info
    const interval = setInterval(() => {
      if (this.state.status !== 'running') {
        clearInterval(interval)
        return
      }

      // Port detection happens via output monitoring
      // This is just a fallback
    }, 5000)
  }

  /**
   * Build project
   */
  async buildProject(): Promise<void> {
    if (this.state.buildStatus === 'building') {
      throw new Error('Build already in progress')
    }

    this.updateState({ buildStatus: 'building', buildErrors: [] })
    this.emitRuntimeEvent('BUILD_STARTED', {})

    const containerStatus = containerManager.getContainerStatus(this.projectId)
    if (!containerStatus || containerStatus.status !== 'running') {
      throw new Error('Container not running')
    }

    const projectPath = join(process.cwd(), 'runtime-projects', this.projectId)
    
    try {
      const packageJsonPath = join(projectPath, 'package.json')
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      const buildCommand = packageJson.scripts?.build || 'npm run build'

      this.buildProcess = spawn('docker', ['exec', containerStatus.id, 'sh', '-c', buildCommand], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      this.buildProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      this.buildProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      await new Promise<void>((resolve, reject) => {
        this.buildProcess!.on('close', (code) => {
          if (code === 0) {
            this.updateState({ buildStatus: 'success', buildErrors: [] })
            this.emitRuntimeEvent('BUILD_SUCCEEDED', {})
            resolve()
          } else {
            // Parse build errors
            const errors = this.parseBuildErrors(stderr + stdout)
            this.updateState({ buildStatus: 'failed', buildErrors: errors })
            this.emitRuntimeEvent('BUILD_FAILED', { errors })
            reject(new Error(`Build failed with code ${code}`))
          }
          this.buildProcess = null
        })

        this.buildProcess!.on('error', (error) => {
          this.updateState({ buildStatus: 'failed', buildErrors: [] })
          this.emitRuntimeEvent('BUILD_FAILED', { errors: [] })
          reject(error)
          this.buildProcess = null
        })
      })
    } catch (error: any) {
      this.updateState({ buildStatus: 'failed', buildErrors: [] })
      this.emitRuntimeEvent('BUILD_FAILED', { errors: [] })
      throw error
    }
  }

  /**
   * Parse build errors from output
   */
  private parseBuildErrors(output: string): Array<{ file: string; line: number; message: string }> {
    const errors: Array<{ file: string; line: number; message: string }> = []
    
    // Simple error parsing (can be enhanced)
    const errorRegex = /(.+?):(\d+):(\d+):\s*(.+)/g
    let match
    
    while ((match = errorRegex.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        message: match[4],
      })
    }

    return errors
  }

  /**
   * Emit runtime event to WorkspaceDaemon
   * TASK 6: Use WorkspaceRegistry.get() instead of getWorkspaceDaemon()
   */
  private emitRuntimeEvent(type: string, payload: any): void {
    try {
      const workspace = WorkspaceRegistry.get(this.projectId)
      workspace.dispatch({
        type: type as any,
        payload,
      } as any)
    } catch (error) {
      console.warn('Failed to emit runtime event:', error)
    }
  }

  /**
   * Get PTY session (for reconnection)
   */
  getPTYSession(): PTYSession | null {
    return this.ptySession
  }

  /**
   * Check if PTY is active
   */
  isPTYActive(): boolean {
    return this.ptySession !== null && 
           this.ptySession.process !== null && 
           !this.ptySession.process.killed
  }

  /**
   * PHASE 5: Restart runtime on file change (debounced)
   * Only restarts if relevant files changed (e.g., source files, not logs)
   */
  scheduleRestart(filePath: string): void {
    // Only restart for relevant file changes
    const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.html', '.css', '.scss']
    const isRelevant = relevantExtensions.some(ext => filePath.endsWith(ext))
    
    if (!isRelevant) {
      return // Don't restart for irrelevant files
    }

    // Clear existing timer
    if (this.restartDebounceTimer) {
      clearTimeout(this.restartDebounceTimer)
    }

    // Schedule restart
    this.restartDebounceTimer = setTimeout(async () => {
      if (this.state.status === 'running' && this.devServerProcess) {
        try {
          // Stop current dev server
          if (this.devServerProcess && !this.devServerProcess.killed) {
            this.devServerProcess.kill('SIGTERM')
            this.devServerProcess = null
          }

          // Wait a bit for cleanup
          await new Promise(resolve => setTimeout(resolve, 500))

          // Restart dev server
          await this.startDevServer()

          this.emitRuntimeEvent('RUNTIME_RESTARTED', {
            reason: `File changed: ${filePath}`,
          })
        } catch (error: any) {
          console.error('Failed to restart runtime:', error)
          this.emitRuntimeEvent('RUNTIME_CRASHED', {
            error: `Restart failed: ${error.message}`,
          })
        }
      }
      this.restartDebounceTimer = null
    }, this.RESTART_DEBOUNCE_MS)
  }
}

