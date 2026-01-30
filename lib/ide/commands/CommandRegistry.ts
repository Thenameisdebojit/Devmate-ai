/**
 * PHASE 2: Command Registry
 * 
 * VS Code-identical command system.
 * Commands dispatch to handlers only - no dynamic execution.
 */

import { EventEmitter } from 'events'

export interface CommandContext {
  projectId?: string
  [key: string]: any
}

export interface IDECommand {
  id: string
  title: string
  category: string
  handler: (context: CommandContext) => Promise<void> | void
  keybinding?: string
  when?: string // Conditional expression (not implemented yet)
}

/**
 * Command Registry
 */
class CommandRegistryImpl extends EventEmitter {
  private commands: Map<string, IDECommand> = new Map()
  private handlers: Map<string, (context: CommandContext) => Promise<void> | void> = new Map()

  /**
   * Register a command
   */
  register(command: IDECommand): void {
    if (this.commands.has(command.id)) {
      console.warn(`[CommandRegistry] Command ${command.id} already registered, overwriting`)
    }

    this.commands.set(command.id, command)
    this.handlers.set(command.id, command.handler)
    
    this.emit('commandRegistered', command)
  }

  /**
   * Execute a command
   */
  async execute(commandId: string, context: CommandContext = {}): Promise<void> {
    const handler = this.handlers.get(commandId)
    if (!handler) {
      throw new Error(`Command not found: ${commandId}`)
    }

    try {
      await handler(context)
      this.emit('commandExecuted', { commandId, context })
    } catch (error: any) {
      this.emit('commandError', { commandId, context, error })
      throw error
    }
  }

  /**
   * Get command by ID
   */
  getCommand(commandId: string): IDECommand | undefined {
    return this.commands.get(commandId)
  }

  /**
   * Get all commands
   */
  getAllCommands(): IDECommand[] {
    return Array.from(this.commands.values())
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: string): IDECommand[] {
    return Array.from(this.commands.values()).filter(cmd => cmd.category === category)
  }

  /**
   * Search commands (fuzzy match on title)
   */
  searchCommands(query: string): IDECommand[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.commands.values()).filter(cmd =>
      cmd.title.toLowerCase().includes(lowerQuery) ||
      cmd.id.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery)
    )
  }
}

// Singleton instance
let registryInstance: CommandRegistryImpl | null = null

export function getCommandRegistry(): CommandRegistryImpl {
  if (!registryInstance) {
    registryInstance = new CommandRegistryImpl()
    // Register built-in commands
    registerBuiltInCommands(registryInstance)
  }
  return registryInstance
}

/**
 * Register built-in commands
 */
function registerBuiltInCommands(registry: CommandRegistryImpl): void {
  // ========== OS / IDE Commands ==========
  
  registry.register({
    id: 'workspace.reload',
    title: 'Reload Workspace',
    category: 'Workspace',
    handler: async (context) => {
      // TODO: Implement workspace reload
      console.log('[Command] Reload Workspace', context)
    },
  })

  registry.register({
    id: 'settings.open',
    title: 'Open Settings',
    category: 'Preferences',
    handler: async (context) => {
      // This will be handled by UI layer
      registry.emit('openSettings', context)
    },
  })

  registry.register({
    id: 'sidebar.toggle',
    title: 'Toggle Sidebar',
    category: 'View',
    handler: async (context) => {
      registry.emit('toggleSidebar', context)
    },
  })

  registry.register({
    id: 'devtools.toggle',
    title: 'Toggle DevTools',
    category: 'Developer',
    handler: async (context) => {
      registry.emit('toggleDevTools', context)
    },
  })

  registry.register({
    id: 'devmate.state.clear',
    title: 'Clear Devmate State',
    category: 'Devmate',
    handler: async (context) => {
      // This will be handled by backend
      registry.emit('clearDevmateState', context)
    },
  })

  // ========== AI / Intelligence Commands ==========

  registry.register({
    id: 'devmate.critique.currentFile',
    title: 'Critique Current File',
    category: 'Devmate / AI',
    handler: async (context) => {
      registry.emit('critiqueCurrentFile', context)
    },
  })

  registry.register({
    id: 'devmate.explain.selection',
    title: 'Explain Selection',
    category: 'Devmate / AI',
    handler: async (context) => {
      registry.emit('explainSelection', context)
    },
  })

  registry.register({
    id: 'devmate.summarize.file',
    title: 'Summarize File',
    category: 'Devmate / AI',
    handler: async (context) => {
      registry.emit('summarizeFile', context)
    },
  })

  registry.register({
    id: 'devmate.autonomy.pause',
    title: 'Pause Autonomy',
    category: 'Devmate / Autonomy',
    handler: async (context) => {
      if (!context.projectId) {
        throw new Error('Project ID is required to pause autonomy')
      }
      // This will be handled by LongHorizonController
      registry.emit('pauseAutonomy', context)
    },
  })

  registry.register({
    id: 'devmate.autonomy.resume',
    title: 'Resume Autonomy',
    category: 'Devmate / Autonomy',
    handler: async (context) => {
      if (!context.projectId) {
        throw new Error('Project ID is required to resume autonomy')
      }
      // This will be handled by LongHorizonController
      registry.emit('resumeAutonomy', context)
    },
  })
}
