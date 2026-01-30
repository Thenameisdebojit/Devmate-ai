/**
 * Build System Detector
 * 
 * Auto-detects build systems and project configurations.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { existsSync } from 'fs'

export interface BuildSystem {
  type: 'make' | 'cmake' | 'meson' | 'ninja' | 'maven' | 'gradle' | 'ant' | 
        'npm' | 'yarn' | 'pnpm' | 'cargo' | 'go' | 'dotnet' | 'python' | 'unknown'
  configFile?: string
  buildCommand?: string
  cleanCommand?: string
  testCommand?: string
  runCommand?: string
  installCommand?: string
}

export interface DetectedProject {
  buildSystem: BuildSystem
  language?: string
  framework?: string
  rootPath: string
}

/**
 * Build System Detector
 * 
 * Detects build systems by examining project files and structure.
 */
export class BuildSystemDetector {
  private static instance: BuildSystemDetector

  private constructor() {}

  static getInstance(): BuildSystemDetector {
    if (!BuildSystemDetector.instance) {
      BuildSystemDetector.instance = new BuildSystemDetector()
    }
    return BuildSystemDetector.instance
  }

  /**
   * Detect build system for a project
   */
  async detect(projectPath: string): Promise<DetectedProject> {
    // Check for various build system files
    const checks = [
      () => this.checkCargo(projectPath),
      () => this.checkNpm(projectPath),
      () => this.checkGo(projectPath),
      () => this.checkCMake(projectPath),
      () => this.checkMake(projectPath),
      () => this.checkMaven(projectPath),
      () => this.checkGradle(projectPath),
      () => this.checkDotNet(projectPath),
      () => this.checkPython(projectPath),
      () => this.checkRust(projectPath),
    ]

    for (const check of checks) {
      const result = await check()
      if (result) {
        return {
          buildSystem: result,
          rootPath: projectPath,
        }
      }
    }

    // Default: unknown
    return {
      buildSystem: {
        type: 'unknown',
      },
      rootPath: projectPath,
    }
  }

  /**
   * Check for Cargo (Rust)
   */
  private async checkCargo(projectPath: string): Promise<BuildSystem | null> {
    if (existsSync(join(projectPath, 'Cargo.toml'))) {
      return {
        type: 'cargo',
        configFile: 'Cargo.toml',
        buildCommand: 'cargo build',
        cleanCommand: 'cargo clean',
        testCommand: 'cargo test',
        runCommand: 'cargo run',
      }
    }
    return null
  }

  /**
   * Check for npm/yarn/pnpm (Node.js)
   */
  private async checkNpm(projectPath: string): Promise<BuildSystem | null> {
    const packageJsonPath = join(projectPath, 'package.json')
    if (existsSync(packageJsonPath)) {
      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(content)
        const scripts = packageJson.scripts || {}

        // Detect package manager by lock file
        let type: 'npm' | 'yarn' | 'pnpm' = 'npm'
        if (existsSync(join(projectPath, 'yarn.lock'))) {
          type = 'yarn'
        } else if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) {
          type = 'pnpm'
        }

        return {
          type,
          configFile: 'package.json',
          buildCommand: scripts.build || `${type} run build`,
          cleanCommand: scripts.clean || `rm -rf dist build .next node_modules/.cache`,
          testCommand: scripts.test || `${type} test`,
          runCommand: scripts.start || scripts.dev || `${type} start`,
          installCommand: `${type} install`,
        }
      } catch (error) {
        console.warn('[BuildSystemDetector] Failed to parse package.json:', error)
      }
    }
    return null
  }

  /**
   * Check for Go
   */
  private async checkGo(projectPath: string): Promise<BuildSystem | null> {
    if (existsSync(join(projectPath, 'go.mod')) || existsSync(join(projectPath, 'go.sum'))) {
      return {
        type: 'go',
        configFile: 'go.mod',
        buildCommand: 'go build',
        cleanCommand: 'go clean',
        testCommand: 'go test ./...',
        runCommand: 'go run .',
        installCommand: 'go mod download',
      }
    }
    return null
  }

  /**
   * Check for CMake
   */
  private async checkCMake(projectPath: string): Promise<BuildSystem | null> {
    if (existsSync(join(projectPath, 'CMakeLists.txt'))) {
      return {
        type: 'cmake',
        configFile: 'CMakeLists.txt',
        buildCommand: 'cmake --build build',
        cleanCommand: 'rm -rf build',
        testCommand: 'ctest',
      }
    }
    return null
  }

  /**
   * Check for Make
   */
  private async checkMake(projectPath: string): Promise<BuildSystem | null> {
    if (existsSync(join(projectPath, 'Makefile')) || existsSync(join(projectPath, 'makefile'))) {
      return {
        type: 'make',
        configFile: 'Makefile',
        buildCommand: 'make',
        cleanCommand: 'make clean',
        testCommand: 'make test',
      }
    }
    return null
  }

  /**
   * Check for Maven
   */
  private async checkMaven(projectPath: string): Promise<BuildSystem | null> {
    if (existsSync(join(projectPath, 'pom.xml'))) {
      return {
        type: 'maven',
        configFile: 'pom.xml',
        buildCommand: 'mvn compile',
        cleanCommand: 'mvn clean',
        testCommand: 'mvn test',
        runCommand: 'mvn exec:java',
        installCommand: 'mvn install',
      }
    }
    return null
  }

  /**
   * Check for Gradle
   */
  private async checkGradle(projectPath: string): Promise<BuildSystem | null> {
    if (existsSync(join(projectPath, 'build.gradle')) || 
        existsSync(join(projectPath, 'build.gradle.kts'))) {
      return {
        type: 'gradle',
        configFile: 'build.gradle',
        buildCommand: 'gradle build',
        cleanCommand: 'gradle clean',
        testCommand: 'gradle test',
        runCommand: 'gradle run',
        installCommand: 'gradle build',
      }
    }
    return null
  }

  /**
   * Check for .NET
   */
  private async checkDotNet(projectPath: string): Promise<BuildSystem | null> {
    if (existsSync(join(projectPath, '*.csproj')) || 
        existsSync(join(projectPath, '*.sln'))) {
      const csprojFiles = await fs.readdir(projectPath)
      const csprojFile = csprojFiles.find(f => f.endsWith('.csproj'))
      
      return {
        type: 'dotnet',
        configFile: csprojFile,
        buildCommand: 'dotnet build',
        cleanCommand: 'dotnet clean',
        testCommand: 'dotnet test',
        runCommand: 'dotnet run',
        installCommand: 'dotnet restore',
      }
    }
    return null
  }

  /**
   * Check for Python
   */
  private async checkPython(projectPath: string): Promise<BuildSystem | null> {
    if (existsSync(join(projectPath, 'setup.py')) ||
        existsSync(join(projectPath, 'pyproject.toml')) ||
        existsSync(join(projectPath, 'requirements.txt'))) {
      return {
        type: 'python',
        configFile: 'requirements.txt',
        buildCommand: 'python setup.py build',
        installCommand: 'pip install -r requirements.txt',
        testCommand: 'pytest',
        runCommand: 'python main.py',
      }
    }
    return null
  }

  /**
   * Check for Rust (standalone, not Cargo)
   */
  private async checkRust(projectPath: string): Promise<BuildSystem | null> {
    const rustFiles = await fs.readdir(projectPath).catch(() => [])
    if (rustFiles.some(f => f.endsWith('.rs'))) {
      return {
        type: 'cargo',
        buildCommand: 'rustc',
        runCommand: './a.out',
      }
    }
    return null
  }
}

/**
 * Get Build System Detector instance
 */
export function getBuildSystemDetector(): BuildSystemDetector {
  return BuildSystemDetector.getInstance()
}
