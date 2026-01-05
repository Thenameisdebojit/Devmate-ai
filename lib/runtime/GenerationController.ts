/**
 * Generation Controller
 * 
 * Owns generation lifecycle and enforces project completeness.
 * Backend authority for generation status - UI must respect this.
 * 
 * RULES:
 * - Generation cannot complete unless contract is satisfied
 * - Validation is deterministic and file-system based
 * - No optimistic assumptions
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(require('child_process').exec)

export interface GenerationStatus {
  complete: boolean
  missingArtifacts: string[]
  attempts: number
  maxAttempts: number
  issues: string[]
  fileCount: number
  sourceFileCount: number
  requiredMinimum: number
}

export interface ProjectContract {
  packageJson: boolean
  entryFile: boolean
  frameworkConfig: boolean
  readme: boolean
  minimumFiles: boolean
}

/**
 * Generation Controller
 * Enforces project completeness before allowing generation to complete
 */
export class GenerationController {
  private projectPath: string
  private attempts: number = 0
  private maxAttempts: number = 3
  private projectId: string

  constructor(projectId: string, projectPath: string) {
    this.projectId = projectId
    this.projectPath = projectPath
  }

  /**
   * Validate project against minimum runnable contract
   * Returns deterministic status - no guessing
   */
  async validateProject(): Promise<GenerationStatus> {
    this.attempts++

    const contract = await this.checkContract()
    const missingArtifacts: string[] = []
    const issues: string[] = []

    // Check package.json
    if (!contract.packageJson) {
      missingArtifacts.push('package.json')
      issues.push('Missing package.json with runnable scripts')
    }

    // Check entry file
    if (!contract.entryFile) {
      missingArtifacts.push('Entry file (index.ts, src/index.ts, src/main.ts, App.tsx, etc.)')
      issues.push('Missing entry file to run the application')
    }

    // Check framework config
    if (!contract.frameworkConfig) {
      missingArtifacts.push('Framework config (tsconfig.json, vite.config.ts, next.config.js, etc.)')
      issues.push('Missing framework configuration file')
    }

    // Check README
    if (!contract.readme) {
      missingArtifacts.push('README.md')
      issues.push('Missing README.md')
    }

    // Check minimum files
    if (!contract.minimumFiles) {
      issues.push(`Only ${contract.fileCount} files generated, need at least ${contract.requiredMinimum}`)
    }

    // Count files on disk
    const fileCount = await this.countFilesOnDisk()
    const sourceFileCount = await this.countSourceFilesOnDisk()

    const complete = 
      contract.packageJson &&
      contract.entryFile &&
      contract.frameworkConfig &&
      contract.readme &&
      contract.minimumFiles

    return {
      complete,
      missingArtifacts,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      issues,
      fileCount,
      sourceFileCount,
      requiredMinimum: contract.requiredMinimum,
    }
  }

  /**
   * Check minimum runnable contract
   */
  private async checkContract(): Promise<ProjectContract & { fileCount: number; requiredMinimum: number }> {
    const contract: ProjectContract = {
      packageJson: false,
      entryFile: false,
      frameworkConfig: false,
      readme: false,
      minimumFiles: false,
    }

    try {
      // Check package.json
      const packageJsonPath = join(this.projectPath, 'package.json')
      try {
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(packageJsonContent)
        
        // Must have at least one runnable script
        const scripts = packageJson.scripts || {}
        const hasRunnableScript = 
          scripts.dev || 
          scripts.start || 
          scripts.build ||
          scripts.serve

        contract.packageJson = hasRunnableScript
      } catch {
        contract.packageJson = false
      }

      // Check entry file (common patterns)
      const entryPatterns = [
        'index.ts',
        'index.tsx',
        'index.js',
        'index.jsx',
        'src/index.ts',
        'src/index.tsx',
        'src/index.js',
        'src/index.jsx',
        'src/main.ts',
        'src/main.tsx',
        'src/App.tsx',
        'src/App.jsx',
        'app/page.tsx', // Next.js
        'pages/index.tsx', // Next.js pages
      ]

      for (const pattern of entryPatterns) {
        const entryPath = join(this.projectPath, pattern)
        try {
          await fs.access(entryPath)
          contract.entryFile = true
          break
        } catch {
          // Continue checking
        }
      }

      // Check framework config
      const configPatterns = [
        'tsconfig.json',
        'jsconfig.json',
        'vite.config.ts',
        'vite.config.js',
        'next.config.js',
        'next.config.ts',
        'tailwind.config.js',
        'tailwind.config.ts',
        'webpack.config.js',
      ]

      for (const pattern of configPatterns) {
        const configPath = join(this.projectPath, pattern)
        try {
          await fs.access(configPath)
          contract.frameworkConfig = true
          break
        } catch {
          // Continue checking
        }
      }

      // Check README
      const readmePath = join(this.projectPath, 'README.md')
      try {
        await fs.access(readmePath)
        contract.readme = true
      } catch {
        contract.readme = false
      }

      // Count files
      const fileCount = await this.countFilesOnDisk()
      const requiredMinimum = 10 // Minimum for a runnable project
      contract.minimumFiles = fileCount >= requiredMinimum

      return {
        ...contract,
        fileCount,
        requiredMinimum,
      }
    } catch (error) {
      console.error('Contract check error:', error)
      return {
        ...contract,
        fileCount: 0,
        requiredMinimum: 10,
      }
    }
  }

  /**
   * Count files on disk (recursive)
   */
  private async countFilesOnDisk(): Promise<number> {
    try {
      let count = 0
      const countFilesRecursive = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          // Skip node_modules, .git, etc.
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue
          }
          if (entry.isDirectory()) {
            await countFilesRecursive(fullPath)
          } else {
            count++
          }
        }
      }
      await countFilesRecursive(this.projectPath)
      return count
    } catch {
      return 0
    }
  }

  /**
   * Count source files (exclude configs, Dockerfiles, etc.)
   */
  private async countSourceFilesOnDisk(): Promise<number> {
    try {
      let count = 0
      const countSourceFilesRecursive = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          // Skip node_modules, .git, etc.
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue
          }
          if (entry.isDirectory()) {
            await countSourceFilesRecursive(fullPath)
          } else {
            // Count source files (exclude Dockerfiles, configs, etc.)
            const ext = entry.name.split('.').pop()?.toLowerCase()
            const isSourceFile = 
              ['ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'html'].includes(ext || '') ||
              entry.name.includes('component') ||
              entry.name.includes('page') ||
              entry.name.includes('route')
            
            if (isSourceFile && !entry.name.includes('Dockerfile') && !entry.name.includes('config')) {
              count++
            }
          }
        }
      }
      await countSourceFilesRecursive(this.projectPath)
      return count
    } catch {
      return 0
    }
  }

  /**
   * Validate using Python completeness validator
   * This is the authoritative validator
   */
  async validateWithPythonValidator(generatedFiles: Array<{ path: string; content: string }>): Promise<{
    isComplete: boolean
    issues: string[]
    recommendation: string
  }> {
    const validatorPath = join(process.cwd(), 'autonomus-dev-agent', 'agents', 'validators', 'code_completeness_validator.py')
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3'

    // Convert files to dict format expected by validator
    const generatedCode: Record<string, string> = {}
    for (const file of generatedFiles) {
      generatedCode[file.path] = file.content
    }

    // Create requirements dict (minimal)
    const requirements = {
      project_type: 'full-stack-web',
      tech_stack: {},
    }

    // Create Python script to call validator
    const pythonScript = `
import sys
import json
sys.path.insert(0, '${join(process.cwd(), 'autonomus-dev-agent')}')
from agents.validators.code_completeness_validator import validate_code_completeness

generated_code = ${JSON.stringify(generatedCode)}
requirements = ${JSON.stringify(requirements)}

result = validate_code_completeness(generated_code, requirements)
print(json.dumps(result))
`

    try {
      const { stdout, stderr } = await execAsync(
        `${pythonCommand} -c ${JSON.stringify(pythonScript)}`,
        {
          cwd: process.cwd(),
          env: { ...process.env, PYTHONPATH: join(process.cwd(), 'autonomus-dev-agent') },
          timeout: 30000, // 30 seconds
        }
      )

      if (stderr && !stdout) {
        throw new Error(`Python validator error: ${stderr}`)
      }

      const result = JSON.parse(stdout.trim())
      
      return {
        isComplete: result.is_complete || false,
        issues: result.issues || [],
        recommendation: result.recommendation || 'Unknown',
      }
    } catch (error: any) {
      console.warn('Python validator failed, using fallback validation:', error.message)
      // Fallback to basic validation
      return {
        isComplete: generatedFiles.length >= 10,
        issues: generatedFiles.length < 10 ? [`Only ${generatedFiles.length} files, need at least 10`] : [],
        recommendation: 'Python validator unavailable, using basic validation',
      }
    }
  }

  /**
   * Mark generation as complete (only if validation passes)
   */
  async markComplete(): Promise<boolean> {
    const status = await this.validateProject()
    return status.complete
  }

  /**
   * Mark generation as failed
   */
  markFailed(reason: string[]): void {
    // Status will reflect failure on next validation
    this.attempts = this.maxAttempts
  }

  /**
   * Get current attempt count
   */
  getAttempts(): number {
    return this.attempts
  }

  /**
   * Check if max attempts reached
   */
  hasReachedMaxAttempts(): boolean {
    return this.attempts >= this.maxAttempts
  }
}

