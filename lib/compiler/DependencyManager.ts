/**
 * Dependency Manager
 * 
 * Manages package dependencies across different languages.
 */

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { existsSync } from 'fs'

export interface Dependency {
  name: string
  version: string
  type: 'dependencies' | 'devDependencies' | 'peerDependencies'
}

export interface DependencyInfo {
  installed: boolean
  version?: string
  latestVersion?: string
  outdated?: boolean
}

/**
 * Dependency Manager
 * 
 * Manages dependencies for various package managers.
 */
export class DependencyManager {
  private static instance: DependencyManager

  private constructor() {}

  static getInstance(): DependencyManager {
    if (!DependencyManager.instance) {
      DependencyManager.instance = new DependencyManager()
    }
    return DependencyManager.instance
  }

  /**
   * Detect package manager for project
   */
  async detectPackageManager(projectPath: string): Promise<'npm' | 'yarn' | 'pnpm' | 'pip' | 'cargo' | 'go' | 'maven' | 'gradle' | null> {
    if (existsSync(join(projectPath, 'package.json'))) {
      if (existsSync(join(projectPath, 'yarn.lock'))) {
        return 'yarn'
      }
      if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) {
        return 'pnpm'
      }
      return 'npm'
    }

    if (existsSync(join(projectPath, 'requirements.txt')) || 
        existsSync(join(projectPath, 'pyproject.toml'))) {
      return 'pip'
    }

    if (existsSync(join(projectPath, 'Cargo.toml'))) {
      return 'cargo'
    }

    if (existsSync(join(projectPath, 'go.mod'))) {
      return 'go'
    }

    if (existsSync(join(projectPath, 'pom.xml'))) {
      return 'maven'
    }

    if (existsSync(join(projectPath, 'build.gradle'))) {
      return 'gradle'
    }

    return null
  }

  /**
   * Install dependencies
   */
  async installDependencies(projectPath: string, packageManager?: string): Promise<void> {
    const pm = packageManager || await this.detectPackageManager(projectPath)
    
    if (!pm) {
      throw new Error('No package manager detected')
    }

    const commands: Record<string, string> = {
      'npm': 'npm install',
      'yarn': 'yarn install',
      'pnpm': 'pnpm install',
      'pip': 'pip install -r requirements.txt',
      'cargo': 'cargo build',
      'go': 'go mod download',
      'maven': 'mvn install',
      'gradle': 'gradle build --refresh-dependencies',
    }

    const command = commands[pm]
    if (!command) {
      throw new Error(`Unsupported package manager: ${pm}`)
    }

    await this.executeCommand(command, projectPath)
  }

  /**
   * Update dependencies
   */
  async updateDependencies(projectPath: string, packageManager?: string): Promise<void> {
    const pm = packageManager || await this.detectPackageManager(projectPath)
    
    if (!pm) {
      throw new Error('No package manager detected')
    }

    const commands: Record<string, string> = {
      'npm': 'npm update',
      'yarn': 'yarn upgrade',
      'pnpm': 'pnpm update',
      'pip': 'pip install --upgrade -r requirements.txt',
      'cargo': 'cargo update',
      'go': 'go get -u ./...',
      'maven': 'mvn versions:use-latest-versions',
      'gradle': 'gradle dependencyUpdates',
    }

    const command = commands[pm]
    if (!command) {
      throw new Error(`Unsupported package manager: ${pm}`)
    }

    await this.executeCommand(command, projectPath)
  }

  /**
   * List dependencies
   */
  async listDependencies(projectPath: string, packageManager?: string): Promise<Dependency[]> {
    const pm = packageManager || await this.detectPackageManager(projectPath)
    
    if (!pm) {
      return []
    }

    if (pm === 'npm' || pm === 'yarn' || pm === 'pnpm') {
      return this.listNpmDependencies(projectPath)
    }

    if (pm === 'pip') {
      return this.listPipDependencies(projectPath)
    }

    if (pm === 'cargo') {
      return this.listCargoDependencies(projectPath)
    }

    if (pm === 'go') {
      return this.listGoDependencies(projectPath)
    }

    return []
  }

  /**
   * List npm dependencies
   */
  private async listNpmDependencies(projectPath: string): Promise<Dependency[]> {
    const packageJsonPath = join(projectPath, 'package.json')
    if (!existsSync(packageJsonPath)) {
      return []
    }

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)
      const dependencies: Dependency[] = []

      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'dependencies',
          })
        }
      }

      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'devDependencies',
          })
        }
      }

      return dependencies
    } catch (error) {
      console.error('[DependencyManager] Failed to parse package.json:', error)
      return []
    }
  }

  /**
   * List pip dependencies
   */
  private async listPipDependencies(projectPath: string): Promise<Dependency[]> {
    const requirementsPath = join(projectPath, 'requirements.txt')
    if (!existsSync(requirementsPath)) {
      return []
    }

    try {
      const content = await fs.readFile(requirementsPath, 'utf-8')
      const lines = content.split('\n')
      const dependencies: Dependency[] = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split(/[>=<]+/)
          if (parts.length >= 1) {
            dependencies.push({
              name: parts[0].trim(),
              version: parts[1]?.trim() || '*',
              type: 'dependencies',
            })
          }
        }
      }

      return dependencies
    } catch (error) {
      console.error('[DependencyManager] Failed to parse requirements.txt:', error)
      return []
    }
  }

  /**
   * List Cargo dependencies
   */
  private async listCargoDependencies(projectPath: string): Promise<Dependency[]> {
    const cargoTomlPath = join(projectPath, 'Cargo.toml')
    if (!existsSync(cargoTomlPath)) {
      return []
    }

    try {
      const content = await fs.readFile(cargoTomlPath, 'utf-8')
      const dependencies: Dependency[] = []
      const lines = content.split('\n')
      let inDependencies = false

      for (const line of lines) {
        if (line.trim().startsWith('[dependencies]')) {
          inDependencies = true
          continue
        }
        if (line.trim().startsWith('[')) {
          inDependencies = false
          continue
        }

        if (inDependencies && line.includes('=')) {
          const match = line.match(/^(\w+)\s*=\s*"([^"]+)"/)
          if (match) {
            dependencies.push({
              name: match[1],
              version: match[2],
              type: 'dependencies',
            })
          }
        }
      }

      return dependencies
    } catch (error) {
      console.error('[DependencyManager] Failed to parse Cargo.toml:', error)
      return []
    }
  }

  /**
   * List Go dependencies
   */
  private async listGoDependencies(projectPath: string): Promise<Dependency[]> {
    const goModPath = join(projectPath, 'go.mod')
    if (!existsSync(goModPath)) {
      return []
    }

    try {
      const content = await fs.readFile(goModPath, 'utf-8')
      const lines = content.split('\n')
      const dependencies: Dependency[] = []

      for (const line of lines) {
        if (line.trim().startsWith('require')) {
          const match = line.match(/require\s+([^\s]+)\s+([^\s]+)/)
          if (match) {
            dependencies.push({
              name: match[1],
              version: match[2],
              type: 'dependencies',
            })
          }
        }
      }

      return dependencies
    } catch (error) {
      console.error('[DependencyManager] Failed to parse go.mod:', error)
      return []
    }
  }

  /**
   * Execute a command
   */
  private async executeCommand(command: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ')
      const process = spawn(cmd, args, {
        cwd,
        shell: true,
        stdio: 'inherit',
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
}

/**
 * Get Dependency Manager instance
 */
export function getDependencyManager(): DependencyManager {
  return DependencyManager.getInstance()
}
