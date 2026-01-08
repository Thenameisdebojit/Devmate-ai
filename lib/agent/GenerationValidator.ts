/**
 * PHASE 3: Generation Validator
 * 
 * Verifies generated projects are runnable.
 * Fails loudly if invalid.
 */

import { promises as fs } from 'fs'
import { join } from 'path'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Generation Validator
 * 
 * Verifies:
 * - package.json exists (if JS project)
 * - entry file exists
 * - project is runnable
 */
export class GenerationValidator {
  /**
   * Validate generated project
   */
  async validate(projectRoot: string): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check if project root exists
    try {
      await fs.access(projectRoot)
    } catch {
      errors.push(`Project root does not exist: ${projectRoot}`)
      return { valid: false, errors, warnings }
    }

    // Check for package.json (for JS/TS projects)
    const packageJsonPath = join(projectRoot, 'package.json')
    let hasPackageJson = false
    try {
      await fs.access(packageJsonPath)
      hasPackageJson = true

      // Validate package.json has runnable scripts
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(packageJsonContent)
      const scripts = packageJson.scripts || {}
      
      if (!scripts.dev && !scripts.start && !scripts.build) {
        errors.push('package.json exists but has no runnable scripts (dev, start, or build)')
      }
    } catch {
      // package.json not found - might be Python or other project
      warnings.push('No package.json found (might be non-JS project)')
    }

    // Check for entry file
    const entryPatterns = [
      'index.ts', 'index.tsx', 'index.js', 'index.jsx',
      'src/index.ts', 'src/index.tsx', 'src/index.js', 'src/index.jsx',
      'src/main.ts', 'src/main.tsx',
      'src/App.tsx', 'src/App.jsx',
      'app/page.tsx', // Next.js
      'pages/index.tsx', // Next.js pages
      'main.py', 'app.py', // Python
    ]

    let hasEntryFile = false
    for (const pattern of entryPatterns) {
      try {
        await fs.access(join(projectRoot, pattern))
        hasEntryFile = true
        break
      } catch {
        // Continue checking
      }
    }

    if (!hasEntryFile) {
      errors.push('No entry file found (checked: index.ts, src/index.ts, App.tsx, main.py, etc.)')
    }

    // Check minimum file count
    const fileCount = await this.countFiles(projectRoot)
    if (fileCount < 3) {
      errors.push(`Project has only ${fileCount} files, minimum 3 required`)
    } else if (fileCount < 10) {
      warnings.push(`Project has only ${fileCount} files, consider adding more`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Count files in project (excluding node_modules, .git, etc.)
   */
  private async countFiles(dir: string): Promise<number> {
    try {
      let count = 0
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue
        }
        
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          count += await this.countFiles(fullPath)
        } else {
          count++
        }
      }
      
      return count
    } catch {
      return 0
    }
  }
}

// Singleton instance
let validatorInstance: GenerationValidator | null = null

export function getGenerationValidator(): GenerationValidator {
  if (!validatorInstance) {
    validatorInstance = new GenerationValidator()
  }
  return validatorInstance
}

