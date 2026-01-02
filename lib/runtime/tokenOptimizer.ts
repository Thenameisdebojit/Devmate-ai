/**
 * Token Optimizer
 * 
 * Optimizes token usage by:
 * - Summarizing large files
 * - Removing redundant context
 * - Prioritizing relevant code
 * - Using incremental updates
 */

export interface TokenOptimizationOptions {
  maxTokens?: number
  prioritizeRecent?: boolean
  summarizeLargeFiles?: boolean
  includeOnlyChanged?: boolean
}

export class TokenOptimizer {
  private readonly MAX_FILE_SIZE = 5000 // characters
  private readonly MAX_CONTEXT_TOKENS = 8000 // tokens (roughly 2000 words)

  /**
   * Optimize file content for token usage
   */
  optimizeFileContent(content: string, maxLength: number = this.MAX_FILE_SIZE): string {
    if (content.length <= maxLength) {
      return content
    }

    // For large files, return summary + key sections
    const lines = content.split('\n')
    const totalLines = lines.length

    // Get first 20% and last 20% of file
    const startLines = Math.floor(totalLines * 0.2)
    const endLines = Math.floor(totalLines * 0.2)

    const start = lines.slice(0, startLines).join('\n')
    const end = lines.slice(-endLines).join('\n')

    return `// File truncated for token optimization (${totalLines} lines total)
// Showing first ${startLines} and last ${endLines} lines

${start}

// ... (${totalLines - startLines - endLines} lines omitted) ...

${end}`
  }

  /**
   * Select relevant files for context
   */
  selectRelevantFiles(
    files: Array<{ path: string; content: string; modified?: boolean }>,
    options: TokenOptimizationOptions = {}
  ): Array<{ path: string; content: string }> {
    // Sort by relevance
    let relevant = [...files]

    // Prioritize recently modified files
    if (options.prioritizeRecent) {
      relevant.sort((a, b) => {
        if (a.modified && !b.modified) return -1
        if (!a.modified && b.modified) return 1
        return 0
      })
    }

    // Include only changed files if requested
    if (options.includeOnlyChanged) {
      relevant = relevant.filter((f) => f.modified)
    }

    // Prioritize important files (package.json, main files, etc.)
    relevant.sort((a, b) => {
      const aImportance = this.getFileImportance(a.path)
      const bImportance = this.getFileImportance(b.path)
      return bImportance - aImportance
    })

    // Limit to fit token budget
    const optimized: Array<{ path: string; content: string }> = []
    let estimatedTokens = 0

    for (const file of relevant) {
      const fileTokens = this.estimateTokens(file.content)
      if (estimatedTokens + fileTokens > (options.maxTokens || this.MAX_CONTEXT_TOKENS)) {
        break
      }

      optimized.push({
        path: file.path,
        content: options.summarizeLargeFiles
          ? this.optimizeFileContent(file.content)
          : file.content,
      })

      estimatedTokens += fileTokens
    }

    return optimized
  }

  /**
   * Get file importance score
   */
  private getFileImportance(path: string): number {
    const importantPatterns = [
      { pattern: /package\.json$/, score: 10 },
      { pattern: /README\.md$/, score: 8 },
      { pattern: /\.config\.(js|ts|json)$/, score: 7 },
      { pattern: /^src\//, score: 6 },
      { pattern: /^app\//, score: 6 },
      { pattern: /^components\//, score: 5 },
      { pattern: /^lib\//, score: 5 },
      { pattern: /index\.(js|ts|tsx)$/, score: 4 },
      { pattern: /main\.(js|ts|tsx)$/, score: 4 },
      { pattern: /App\.(js|ts|tsx)$/, score: 4 },
    ]

    for (const { pattern, score } of importantPatterns) {
      if (pattern.test(path)) {
        return score
      }
    }

    return 1
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }

  /**
   * Create incremental context update
   */
  createIncrementalContext(
    previousContext: string,
    changes: Array<{ path: string; content: string; type: 'created' | 'modified' | 'deleted' }>
  ): string {
    const changeSummary = changes
      .map((change) => {
        switch (change.type) {
          case 'created':
            return `+ ${change.path} (new file)`
          case 'modified':
            return `~ ${change.path} (modified)`
          case 'deleted':
            return `- ${change.path} (deleted)`
        }
      })
      .join('\n')

    return `Previous context: ${previousContext.substring(0, 500)}...

Changes since last update:
${changeSummary}

Updated files:
${changes
  .filter((c) => c.type !== 'deleted')
  .map((c) => `\n${c.path}:\n${this.optimizeFileContent(c.content)}`)
  .join('\n\n')}`
  }

  /**
   * Summarize project structure
   */
  summarizeProjectStructure(files: Array<{ path: string; content: string }>): string {
    const structure = files.map((f) => f.path).sort()
    const fileCount = structure.length
    const directories = new Set(structure.map((p) => p.split('/')[0]))

    return `Project Structure:
- ${fileCount} files
- ${directories.size} top-level directories
- Main directories: ${Array.from(directories).slice(0, 5).join(', ')}${directories.size > 5 ? '...' : ''}

Files:
${structure.slice(0, 20).join('\n')}${structure.length > 20 ? `\n... and ${structure.length - 20} more files` : ''}`
  }
}

// Singleton instance
export const tokenOptimizer = new TokenOptimizer()

