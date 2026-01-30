/**
 * PHASE D: Command Registry
 * 
 * Deterministic command definitions (NOT AI-generated).
 * Commands are registered code, not strings.
 */

import type { ExecutionIntent } from './IntentBuilder'
import type { ProjectStage } from '@/lib/os/ProjectEvolutionEngine'
import type { Capabilities } from '@/lib/os/ProjectEvolutionEngine'

export interface IDECommand {
  id: string
  label: string
  requiredStage: ProjectStage
  requiredCapabilities: Partial<Capabilities>
  allowedTools: {
    files?: boolean
    terminal?: boolean
    runtime?: boolean
  }
  handler: (context: CommandContext) => Promise<ExecutionIntent>
}

export interface CommandContext {
  input: string
  projectId?: string
  rootPath?: string
  stage?: ProjectStage
  capabilities?: Capabilities
}

/**
 * PHASE D: Command Registry
 * 
 * All commands are registered here - deterministic, not AI-generated.
 */
export class CommandRegistry {
  private commands: Map<string, IDECommand> = new Map()

  /**
   * Register a command
   */
  register(command: IDECommand): void {
    this.commands.set(command.id, command)
  }

  /**
   * Get command by ID
   */
  get(commandId: string): IDECommand | undefined {
    return this.commands.get(commandId)
  }

  /**
   * Get all commands
   */
  getAll(): IDECommand[] {
    return Array.from(this.commands.values())
  }

  /**
   * Find command by ID or alias
   */
  find(identifier: string): IDECommand | undefined {
    // Try exact match
    const exact = this.commands.get(identifier)
    if (exact) return exact
    
    // Try prefix match (e.g., "edit" matches "edit.files")
    for (const [id, cmd] of this.commands.entries()) {
      if (id.startsWith(identifier) || identifier.startsWith(id.split('.')[0])) {
        return cmd
      }
    }
    
    return undefined
  }
}

/**
 * PHASE D: Global command registry instance
 */
export const commandRegistry = new CommandRegistry()

/**
 * PHASE D: Register default commands
 */
function registerDefaultCommands() {
  const { IntentBuilder } = require('./IntentBuilder')
  
  // edit.files - Modify files
  commandRegistry.register({
    id: 'edit.files',
    label: 'Edit Files',
    requiredStage: 'editable',
    requiredCapabilities: { aiWrite: 'scoped' },
    allowedTools: { files: true },
    handler: async (context) => {
      return IntentBuilder.build('mutate', context.input) as ExecutionIntent
    },
  })

  // run.terminal - Run terminal commands
  commandRegistry.register({
    id: 'run.terminal',
    label: 'Run Terminal Command',
    requiredStage: 'bootstrapped',
    requiredCapabilities: { run: true },
    allowedTools: { terminal: true },
    handler: async (context) => {
      // Extract command from input (e.g., "/run npm start" → "npm start")
      const match = context.input.match(/\/run\s+(.+)/i) || context.input.match(/run\s+(.+)/i)
      const command = match ? match[1] : undefined
      
      return {
        type: 'run',
        command,
        description: context.input,
      } as ExecutionIntent
    },
  })

  // explain.code - Explain code (read-only)
  commandRegistry.register({
    id: 'explain.code',
    label: 'Explain Code',
    requiredStage: 'bootstrapped',
    requiredCapabilities: {},
    allowedTools: {}, // No tools needed - read-only
    handler: async (context) => {
      const match = context.input.match(/\/(?:explain|explain\.code)\s+(.+)/i) || 
                    context.input.match(/(?:explain|what\s+is)\s+(.+)/i)
      const target = match ? match[1] : undefined
      
      return {
        type: 'explain',
        target,
        description: context.input,
      } as ExecutionIntent
    },
  })

  // critique.file - Critique code (read-only)
  commandRegistry.register({
    id: 'critique.file',
    label: 'Critique Code',
    requiredStage: 'bootstrapped',
    requiredCapabilities: {},
    allowedTools: {}, // Read-only
    handler: async (context) => {
      return {
        type: 'explain',
        description: `Critique: ${context.input}`,
      } as ExecutionIntent
    },
  })

  // summarize.project - Summarize project (read-only)
  commandRegistry.register({
    id: 'summarize.project',
    label: 'Summarize Project',
    requiredStage: 'bootstrapped',
    requiredCapabilities: {},
    allowedTools: {}, // Read-only
    handler: async (context) => {
      return {
        type: 'explain',
        description: `Summarize project: ${context.input}`,
      } as ExecutionIntent
    },
  })

  // fix.errors - Fix code errors
  commandRegistry.register({
    id: 'fix.errors',
    label: 'Fix Errors',
    requiredStage: 'editable',
    requiredCapabilities: { aiWrite: 'scoped' },
    allowedTools: { files: true },
    handler: async (context) => {
      return IntentBuilder.build('fix', context.input) as ExecutionIntent
    },
  })

  // generate.project - Generate new project (only for empty stage)
  commandRegistry.register({
    id: 'generate.project',
    label: 'Generate Project',
    requiredStage: 'empty',
    requiredCapabilities: {},
    allowedTools: { files: true },
    handler: async (context) => {
      return IntentBuilder.build('generate', context.input) as ExecutionIntent
    },
  })
}

// Register commands on module load
registerDefaultCommands()
