/**
 * Container Manager
 * 
 * Manages Docker containers for app execution (container-per-project model).
 * Each project gets its own isolated container with:
 * - Mounted project volume
 * - CPU and RAM limits
 * - Isolated network and ports
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { promises as fs } from 'fs'
import { nanoid } from 'nanoid'
import { checkpointEngine } from './checkpointEngine'
import { safetyManager } from './safetyManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

const execAsync = promisify(exec)

export interface ContainerConfig {
  projectId: string
  image?: string
  port?: number
  cpuLimit?: string // e.g., "0.5" for 50% of one CPU
  memoryLimit?: string // e.g., "512m" for 512MB
  env?: Record<string, string>
}

export interface ContainerStatus {
  id: string
  projectId: string
  status: 'running' | 'stopped' | 'building' | 'error'
  port?: number
  previewUrl?: string
  createdAt: number
}

export class ContainerManager {
  private containers: Map<string, ContainerStatus> = new Map()
  private portPool: Set<number> = new Set()
  private readonly BASE_PORT = 30000
  private readonly MAX_PORTS = 1000
  private readonly PROJECTS_DIR = join(process.cwd(), 'runtime-projects')
  private crashMonitoringIntervals: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    // Initialize projects directory
    this.ensureProjectsDir()
  }

  private async ensureProjectsDir() {
    try {
      await fs.mkdir(this.PROJECTS_DIR, { recursive: true })
    } catch (error) {
      console.error('Failed to create projects directory:', error)
    }
  }

  /**
   * Allocate a free port for a container
   */
  private allocatePort(): number {
    for (let i = 0; i < this.MAX_PORTS; i++) {
      const port = this.BASE_PORT + i
      if (!this.portPool.has(port)) {
        this.portPool.add(port)
        return port
      }
    }
    throw new Error('No available ports')
  }

  /**
   * Release a port back to the pool
   */
  private releasePort(port: number) {
    this.portPool.delete(port)
  }

  /**
   * PHASE 5: Detect framework from project files (public)
   */
  async detectFramework(projectPath: string): Promise<{
    type: 'nextjs' | 'vite' | 'react' | 'python' | 'node' | 'unknown'
    buildCommand?: string
    startCommand?: string
    port?: number
  }> {
    try {
      const packageJsonPath = join(projectPath, 'package.json')
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

      // Check for Next.js
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        return {
          type: 'nextjs',
          buildCommand: 'npm run build',
          startCommand: 'npm start',
          port: 3000,
        }
      }

      // Check for Vite
      if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) {
        return {
          type: 'vite',
          buildCommand: 'npm run build',
          startCommand: 'npm run dev',
          port: 5173,
        }
      }

      // Check for React
      if (packageJson.dependencies?.react) {
        return {
          type: 'react',
          buildCommand: 'npm run build',
          startCommand: 'npm start',
          port: 3000,
        }
      }

      // Check for Python
      const requirementsPath = join(projectPath, 'requirements.txt')
      try {
        await fs.access(requirementsPath)
        return {
          type: 'python',
          buildCommand: undefined,
          startCommand: 'python app.py || python main.py || uvicorn main:app --reload',
          port: 8000,
        }
      } catch {
        // Not Python
      }

      // Default Node.js
      if (packageJson.scripts) {
        return {
          type: 'node',
          buildCommand: packageJson.scripts.build,
          startCommand: packageJson.scripts.start || packageJson.scripts.dev,
          port: 3000,
        }
      }

      return { type: 'unknown' }
    } catch (error) {
      console.error('Framework detection error:', error)
      return { type: 'unknown' }
    }
  }

  /**
   * Create and start a container for a project
   * 
   * SAFETY: Applies safety policies and creates checkpoint before writes
   */
  async createContainer(config: ContainerConfig, createCheckpoint: boolean = true): Promise<ContainerStatus> {
    const projectPath = join(this.PROJECTS_DIR, config.projectId)
    const containerId = `devmate-${config.projectId}-${nanoid(8)}`
    const port = config.port || this.allocatePort()

    // Create checkpoint before container creation (safety)
    if (createCheckpoint) {
      try {
        await checkpointEngine.createCheckpoint(
          config.projectId,
          projectPath,
          'Checkpoint before container creation',
          'pre-write'
        )
      } catch (error) {
        console.warn('Failed to create checkpoint:', error)
        // Continue anyway - checkpoint failure shouldn't block container creation
      }
    }

    // Detect framework
    const framework = await this.detectFramework(projectPath)

    // Create container status
    const status: ContainerStatus = {
      id: containerId,
      projectId: config.projectId,
      status: 'building',
      port,
      createdAt: Date.now(),
    }

    this.containers.set(config.projectId, status)

    try {
      // Build Docker image or use base image
      const imageName = config.image || this.getBaseImage(framework.type)
      
      // Create Dockerfile if it doesn't exist
      await this.ensureDockerfile(projectPath, framework)

      // Build image
      try {
        await execAsync(`docker build -t ${containerId} ${projectPath}`, {
          timeout: 300000, // 5 minutes
        })
      } catch (buildError: any) {
        // Dispatch BUILD_FAILED event to WorkspaceDaemon
        try {
          const workspace = WorkspaceRegistry.get(config.projectId)
          workspace.dispatch({
            type: 'BUILD_FAILED',
            payload: {
              errors: [
                {
                  file: undefined,
                  line: undefined,
                  message: buildError.message || 'Build failed during Docker image build',
                },
              ],
            },
          })
        } catch (daemonError) {
          // If workspace dispatch fails, log but don't block error handling
          console.warn('Failed to dispatch BUILD_FAILED event:', daemonError)
        }
        // Re-throw to be caught by outer catch block
        throw buildError
      }

      // Get safety config
      const safetyConfig = safetyManager.getDefaultConfig()
      const cpuLimit = config.cpuLimit || safetyConfig.cpuLimit
      const memoryLimit = config.memoryLimit || safetyConfig.memoryLimit
      const containerPort = framework.port || 3000

      // Build docker run command with safety limits
      const dockerRunArgs = [
        'run', '-d',
        '--name', containerId,
        '--cpus', cpuLimit,
        '--memory', memoryLimit,
        '--pids-limit', String(safetyConfig.maxProcesses || 50),
        '-p', `${port}:${containerPort}`,
        '-v', `${projectPath}:/app`,
        ...(config.env ? Object.entries(config.env).flatMap(([k, v]) => ['-e', `${k}=${v}`]) : []),
        containerId,
      ]

      await execAsync(`docker ${dockerRunArgs.join(' ')}`, {
        timeout: 60000, // 1 minute timeout
      })

      // Apply additional safety policies
      await safetyManager.applySafetyPolicy(containerId, config.projectId, {
        cpuLimit,
        memoryLimit,
        maxProcesses: safetyConfig.maxProcesses,
      })

      status.status = 'running'
      status.previewUrl = `http://localhost:${port}`

      this.containers.set(config.projectId, status)
      
      // Start monitoring container for crashes
      this.startCrashMonitoring(config.projectId, containerId)
      
      return status
    } catch (error: any) {
      status.status = 'error'
      this.containers.set(config.projectId, status)
      this.releasePort(port)
      throw new Error(`Failed to create container: ${error.message}`)
    }
  }

  /**
   * Get base Docker image for framework
   */
  private getBaseImage(framework: string): string {
    const imageMap: Record<string, string> = {
      nextjs: 'node:18-alpine',
      vite: 'node:18-alpine',
      react: 'node:18-alpine',
      node: 'node:18-alpine',
      python: 'python:3.11-slim',
    }
    return imageMap[framework] || 'node:18-alpine'
  }

  /**
   * Ensure Dockerfile exists for project
   */
  private async ensureDockerfile(projectPath: string, framework: {
    type: string
    buildCommand?: string
    startCommand?: string
    port?: number
  }) {
    const dockerfilePath = join(projectPath, 'Dockerfile')
    
    try {
      await fs.access(dockerfilePath)
      // Dockerfile exists, use it
      return
    } catch {
      // Create default Dockerfile
    }

    let dockerfile = ''
    const port = framework.port || 3000

    if (framework.type === 'python') {
      dockerfile = `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE ${port}
CMD ${framework.startCommand || 'python app.py'}`
    } else {
      dockerfile = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
${framework.buildCommand ? `RUN ${framework.buildCommand}` : ''}
EXPOSE ${port}
CMD ${framework.startCommand || 'npm start'}`
    }

    await fs.writeFile(dockerfilePath, dockerfile)
  }

  /**
   * Stop and remove a container
   */
  async stopContainer(projectId: string): Promise<void> {
    const status = this.containers.get(projectId)
    if (!status) {
      throw new Error(`Container not found for project: ${projectId}`)
    }

    try {
      // Stop crash monitoring
      this.stopCrashMonitoring(projectId)
      
      // Mark as user-initiated stop before stopping
      status.status = 'stopped'
      this.containers.set(projectId, status)
      
      await execAsync(`docker stop ${status.id}`)
      await execAsync(`docker rm ${status.id}`)
      this.releasePort(status.port!)
      this.containers.delete(projectId)
    } catch (error: any) {
      console.error(`Error stopping container: ${error.message}`)
      throw error
    }
  }

  /**
   * Monitor container for unexpected crashes
   */
  private startCrashMonitoring(projectId: string, containerId: string) {
    // Clear any existing monitoring
    this.stopCrashMonitoring(projectId)
    
    // Check container status periodically
    const checkInterval = setInterval(async () => {
      try {
        const status = this.containers.get(projectId)
        if (!status || status.status === 'stopped') {
          this.stopCrashMonitoring(projectId)
          return
        }

        const exitCode = await this.checkContainerExitCode(projectId)
        
        // If container exited with non-zero code and wasn't stopped by user
        if (exitCode !== null && exitCode !== undefined && exitCode !== 0 && status.status === 'running') {
          // Container crashed
          status.status = 'error'
          this.containers.set(projectId, status)
          
          try {
            const workspace = WorkspaceRegistry.get(projectId)
            workspace.dispatch({
              type: 'RUNTIME_CRASHED',
              payload: {
                error: `Container exited unexpectedly with code ${exitCode}`,
              },
            })
          } catch (daemonError) {
            console.warn('Failed to dispatch RUNTIME_CRASHED event:', daemonError)
          }
          
          this.stopCrashMonitoring(projectId)
        } else if (exitCode === null) {
          // Container is still running, continue monitoring
        } else {
          // Container stopped normally (exit code 0) or was removed
          this.stopCrashMonitoring(projectId)
        }
      } catch (error) {
        // Ignore errors during monitoring
        console.warn('Error monitoring container:', error)
      }
    }, 5000) // Check every 5 seconds
    
    this.crashMonitoringIntervals.set(projectId, checkInterval)
  }

  /**
   * Stop crash monitoring for a container
   */
  private stopCrashMonitoring(projectId: string) {
    const interval = this.crashMonitoringIntervals.get(projectId)
    if (interval) {
      clearInterval(interval)
      this.crashMonitoringIntervals.delete(projectId)
    }
  }

  /**
   * Check if container exited unexpectedly (crashed)
   * Returns exit code if container exited, null if still running, undefined if not found
   * Public method for external crash detection
   */
  async checkContainerExitCode(projectId: string): Promise<number | null | undefined> {
    const status = this.containers.get(projectId)
    if (!status) {
      return undefined
    }

    try {
      // Check container state using docker inspect
      const { stdout } = await execAsync(`docker inspect --format='{{.State.Status}}|{{.State.ExitCode}}' ${status.id}`)
      const [containerStatus, exitCodeStr] = stdout.trim().split('|')
      
      if (containerStatus === 'exited') {
        const exitCode = parseInt(exitCodeStr, 10)
        return exitCode
      }
      
      // Container is still running
      return null
    } catch (error: any) {
      // Container might not exist anymore
      return undefined
    }
  }

  /**
   * Get container status
   */
  getContainerStatus(projectId: string): ContainerStatus | null {
    return this.containers.get(projectId) || null
  }

  /**
   * Get container logs
   */
  async getContainerLogs(projectId: string, tail: number = 100): Promise<string> {
    const status = this.containers.get(projectId)
    if (!status) {
      throw new Error(`Container not found for project: ${projectId}`)
    }

    try {
      const { stdout } = await execAsync(`docker logs --tail ${tail} ${status.id}`)
      return stdout
    } catch (error: any) {
      throw new Error(`Failed to get logs: ${error.message}`)
    }
  }

  /**
   * Execute command in container
   */
  async execInContainer(projectId: string, command: string): Promise<string> {
    const status = this.containers.get(projectId)
    if (!status) {
      throw new Error(`Container not found for project: ${projectId}`)
    }

    try {
      const { stdout } = await execAsync(`docker exec ${status.id} sh -c "${command}"`)
      return stdout
    } catch (error: any) {
      throw new Error(`Failed to execute command: ${error.message}`)
    }
  }

  /**
   * List all containers
   */
  getAllContainers(): ContainerStatus[] {
    return Array.from(this.containers.values())
  }
}

// Singleton instance
export const containerManager = new ContainerManager()

