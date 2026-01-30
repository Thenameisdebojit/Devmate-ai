/**
 * Terminal Autocomplete
 * 
 * Provides command and file path autocomplete for terminal sessions.
 */

import { promises as fs } from 'fs'
import { join, dirname, basename } from 'path'
import { getProjectRootManager } from '@/lib/workspace/ProjectRootManager'

export interface AutocompleteResult {
  matches: string[]
  completed: string
  isComplete: boolean
}

/**
 * Terminal Autocomplete
 * 
 * Provides autocomplete suggestions for commands and file paths.
 */
export class TerminalAutocomplete {
  private static instance: TerminalAutocomplete
  private commandCache: Map<string, string[]> = new Map()

  private constructor() {
    this.initializeCommandCache()
  }

  static getInstance(): TerminalAutocomplete {
    if (!TerminalAutocomplete.instance) {
      TerminalAutocomplete.instance = new TerminalAutocomplete()
    }
    return TerminalAutocomplete.instance
  }

  /**
   * Initialize command cache with common commands
   */
  private initializeCommandCache(): void {
    const commonCommands = [
      'cd', 'ls', 'dir', 'pwd', 'mkdir', 'rm', 'rmdir', 'cp', 'mv', 'cat',
      'echo', 'grep', 'find', 'which', 'where', 'type', 'help', 'exit',
      'clear', 'cls', 'git', 'npm', 'node', 'python', 'gcc', 'g++', 'javac',
      'java', 'go', 'rustc', 'cargo', 'make', 'cmake', 'dotnet',
    ]
    this.commandCache.set('all', commonCommands)
  }

  /**
   * Autocomplete command or path
   */
  async autocomplete(
    input: string,
    projectId: string,
    cwd: string
  ): Promise<AutocompleteResult> {
    const trimmed = input.trim()

    // If input looks like a path, try path completion
    if (trimmed.startsWith('./') || trimmed.startsWith('../') || 
        trimmed.startsWith('/') || /^[A-Za-z]:/.test(trimmed)) {
      return this.autocompletePath(trimmed, projectId, cwd)
    }

    // Otherwise, try command completion
    return this.autocompleteCommand(trimmed)
  }

  /**
   * Autocomplete command
   */
  private autocompleteCommand(input: string): AutocompleteResult {
    const commands = this.commandCache.get('all') || []
    const lowerInput = input.toLowerCase()
    
    const matches = commands.filter((cmd) =>
      cmd.toLowerCase().startsWith(lowerInput)
    )

    if (matches.length === 1) {
      return {
        matches: [],
        completed: matches[0],
        isComplete: true,
      }
    }

    return {
      matches: matches.slice(0, 10), // Limit to 10 suggestions
      completed: input,
      isComplete: false,
    }
  }

  /**
   * Autocomplete file path
   */
  private async autocompletePath(
    input: string,
    projectId: string,
    cwd: string
  ): Promise<AutocompleteResult> {
    try {
      // Resolve path relative to project root
      let basePath = cwd
      if (projectId) {
        const rootManager = getProjectRootManager()
        basePath = await rootManager.getProjectRoot(projectId)
      }

      // Parse input path
      let searchPath = input
      let searchDir = basePath
      let searchPattern = ''

      if (input.includes('/') || input.includes('\\')) {
        const pathParts = input.split(/[/\\]/)
        searchPattern = pathParts.pop() || ''
        const dirPart = pathParts.join('/')
        searchDir = join(basePath, dirPart)
      } else {
        searchPattern = input
        searchDir = basePath
      }

      // Read directory
      const entries = await fs.readdir(searchDir, { withFileTypes: true })
      
      // Filter matching entries
      const matches = entries
        .filter((entry) => {
          const name = entry.name
          return name.toLowerCase().startsWith(searchPattern.toLowerCase())
        })
        .map((entry) => {
          const prefix = input.includes('/') || input.includes('\\') 
            ? input.substring(0, input.lastIndexOf('/') || input.lastIndexOf('\\') + 1)
            : ''
          return prefix + entry.name + (entry.isDirectory() ? '/' : '')
        })
        .slice(0, 10) // Limit to 10 suggestions

      if (matches.length === 1) {
        return {
          matches: [],
          completed: matches[0],
          isComplete: true,
        }
      }

      return {
        matches,
        completed: input,
        isComplete: false,
      }
    } catch (error) {
      // Path doesn't exist or can't be read
      return {
        matches: [],
        completed: input,
        isComplete: false,
      }
    }
  }

  /**
   * Add custom command to cache
   */
  addCommand(command: string): void {
    const commands = this.commandCache.get('all') || []
    if (!commands.includes(command)) {
      commands.push(command)
      this.commandCache.set('all', commands)
    }
  }
}

/**
 * Get Terminal Autocomplete instance
 */
export function getTerminalAutocomplete(): TerminalAutocomplete {
  return TerminalAutocomplete.getInstance()
}
