/**
 * PHASE 2: Context Builder
 * 
 * Gathers context for agent execution.
 * 
 * Rule: If a file is not read via ContextBuilder, the agent cannot modify it.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'

export interface ExecutionContext {
  // Files referenced by intent
  referencedFiles: Array<{ path: string; content: string }>
  
  // Recently modified files
  recentlyModified: Array<{ path: string; lastModified: number }>
  
  // Last runtime errors (if any)
  runtimeErrors: Array<{ file?: string; line?: number; message: string }>
  
  // Open files (if available)
  openFiles: string[]
}

/**
 * Context Builder
 * 
 * Builds execution context from:
 * - Files referenced by intent
 * - Recently modified files
 * - Last runtime errors
 */
export class ContextBuilder {
  /**
   * Build context for execution
   */
  async buildContext(
    intent: ExecutionIntent,
    projectRoot: string,
    openFiles: string[] = []
  ): Promise<ExecutionContext> {
    const context: ExecutionContext = {
      referencedFiles: [],
      recentlyModified: [],
      runtimeErrors: [],
      openFiles,
    }

    // Extract file references from intent
    if (intent.type === 'mutate' && intent.files) {
      // Read files referenced in mutate intent
      for (const filePath of intent.files) {
        try {
          const fullPath = join(projectRoot, filePath)
          const content = await fs.readFile(fullPath, 'utf-8')
          context.referencedFiles.push({ path: filePath, content })
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            console.warn(`[ContextBuilder] Failed to read file ${filePath}:`, error.message)
          }
        }
      }
    }

    // Get recently modified files (last 24 hours)
    try {
      const entries = await fs.readdir(projectRoot, { withFileTypes: true, recursive: true })
      const now = Date.now()
      const oneDayAgo = now - 24 * 60 * 60 * 1000

      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          try {
            const fullPath = join(projectRoot, entry.name)
            const stats = await fs.stat(fullPath)
            if (stats.mtimeMs > oneDayAgo) {
              context.recentlyModified.push({
                path: entry.name,
                lastModified: stats.mtimeMs,
              })
            }
          } catch (error) {
            // Skip files we can't stat
          }
        }
      }

      // Sort by last modified (most recent first)
      context.recentlyModified.sort((a, b) => b.lastModified - a.lastModified)
    } catch (error) {
      // If we can't read directory, continue without recently modified files
      console.warn('[ContextBuilder] Failed to read directory:', error)
    }

    // TODO: Runtime errors would come from RuntimeKernel or build output
    // For now, we'll leave this empty. It should be populated from:
    // - Build errors
    // - Runtime errors
    // - Linter errors

    return context
  }

  /**
   * Get files that can be modified
   * 
   * Rule: Only files that have been read via ContextBuilder can be modified
   */
  getModifiableFiles(context: ExecutionContext): string[] {
    const modifiable = new Set<string>()

    // Files referenced in intent
    context.referencedFiles.forEach((f) => modifiable.add(f.path))

    // Open files (user is viewing them, so they can be modified)
    context.openFiles.forEach((f) => modifiable.add(f))

    return Array.from(modifiable)
  }

  /**
   * Validate that a file can be modified
   */
  canModifyFile(
    filePath: string,
    context: ExecutionContext
  ): boolean {
    const modifiable = this.getModifiableFiles(context)
    return modifiable.includes(filePath)
  }
}

// Singleton instance
let contextBuilderInstance: ContextBuilder | null = null

export function getContextBuilder(): ContextBuilder {
  if (!contextBuilderInstance) {
    contextBuilderInstance = new ContextBuilder()
  }
  return contextBuilderInstance
}

