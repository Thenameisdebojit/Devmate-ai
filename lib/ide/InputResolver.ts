/**
 * PHASE D: Input Resolver
 * 
 * Resolves user input to input mode and command.
 * This is the bridge between natural language and deterministic commands.
 */

import type { InputMode } from './InputMode'
import { resolveInputMode } from './InputMode'
import { commandRegistry } from './CommandRegistry'
import type { IDECommand } from './CommandRegistry'
import { IntentBuilder, type ExecutionIntent } from './IntentBuilder'

export interface ResolvedInput {
  mode: InputMode
  commandId?: string
  command?: IDECommand
  intentDescription: string
  rawInput: string
}

/**
 * PHASE D: Resolve input to mode and command
 * 
 * Examples:
 * - "add calculator logic" → implicit → edit.files
 * - "/run npm start" → command → run.terminal
 * - "/explain this file" → command → explain.code
 * - "/chat how does this work?" → chat → no command
 */
export function resolveInput(input: string): ResolvedInput {
  const mode = resolveInputMode(input)
  const trimmed = input.trim()
  
  // Chat mode - no command, just discussion
  if (mode === 'chat') {
    const chatInput = trimmed.replace(/^\/chat\s*/i, '').trim()
    return {
      mode: 'chat',
      intentDescription: chatInput || input,
      rawInput: input,
    }
  }
  
  // Command mode - explicit commands
  if (mode === 'command') {
    // Try to match command prefixes
    if (trimmed.match(/^\/run/i)) {
      const command = commandRegistry.get('run.terminal')
      return {
        mode: 'command',
        commandId: 'run.terminal',
        command,
        intentDescription: trimmed,
        rawInput: input,
      }
    }
    
    if (trimmed.match(/^\/(?:edit|mutate)/i)) {
      const command = commandRegistry.get('edit.files')
      return {
        mode: 'command',
        commandId: 'edit.files',
        command,
        intentDescription: trimmed,
        rawInput: input,
      }
    }
    
    if (trimmed.match(/^\/(?:explain|explain\.code)/i)) {
      const command = commandRegistry.get('explain.code')
      return {
        mode: 'command',
        commandId: 'explain.code',
        command,
        intentDescription: trimmed,
        rawInput: input,
      }
    }
    
    if (trimmed.match(/^\/(?:fix|fix\.errors)/i)) {
      const command = commandRegistry.get('fix.errors')
      return {
        mode: 'command',
        commandId: 'fix.errors',
        command,
        intentDescription: trimmed,
        rawInput: input,
      }
    }
    
    if (trimmed.match(/^\/generate/i)) {
      const command = commandRegistry.get('generate.project')
      return {
        mode: 'command',
        commandId: 'generate.project',
        command,
        intentDescription: trimmed,
        rawInput: input,
      }
    }
    
    // Unknown command - treat as implicit
    return {
      mode: 'implicit',
      intentDescription: trimmed,
      rawInput: input,
    }
  }
  
  // Implicit mode - infer command from natural language
  // This uses IntentBuilder's existing inference logic
  const lowerInput = trimmed.toLowerCase()
  
  // Check for file editing patterns
  if (
    lowerInput.includes('add') && (lowerInput.includes('logic') || lowerInput.includes('function') || lowerInput.includes('code') || lowerInput.includes('feature')) ||
    lowerInput.includes('modify') ||
    lowerInput.includes('change') ||
    lowerInput.includes('update') ||
    lowerInput.includes('edit')
  ) {
    const command = commandRegistry.get('edit.files')
    return {
      mode: 'implicit',
      commandId: 'edit.files',
      command,
      intentDescription: trimmed,
      rawInput: input,
    }
  }
  
  // Check for run patterns
  if (lowerInput.includes('run') || lowerInput.includes('execute') || lowerInput.includes('start')) {
    const command = commandRegistry.get('run.terminal')
    return {
      mode: 'implicit',
      commandId: 'run.terminal',
      command,
      intentDescription: trimmed,
      rawInput: input,
    }
  }
  
  // Check for explain patterns
  if (lowerInput.includes('explain') || lowerInput.includes('what') || lowerInput.includes('how')) {
    const command = commandRegistry.get('explain.code')
    return {
      mode: 'implicit',
      commandId: 'explain.code',
      command,
      intentDescription: trimmed,
      rawInput: input,
    }
  }
  
  // Check for fix patterns
  if (lowerInput.includes('fix') || lowerInput.includes('error') || lowerInput.includes('bug')) {
    const command = commandRegistry.get('fix.errors')
    return {
      mode: 'implicit',
      commandId: 'fix.errors',
      command,
      intentDescription: trimmed,
      rawInput: input,
    }
  }
  
  // Default: no specific command (will use IntentBuilder.inferFromInput)
  return {
    mode: 'implicit',
    intentDescription: trimmed,
    rawInput: input,
  }
}

/**
 * PHASE D: Build ExecutionIntent from resolved input
 */
export async function buildExecutionIntent(
  resolved: ResolvedInput,
  context: {
    projectId?: string
    rootPath?: string
    stage?: string
    capabilities?: any
  }
): Promise<ExecutionIntent | null> {
  // Chat mode - return null (no execution)
  if (resolved.mode === 'chat') {
    return null
  }
  
  // Command mode - use command handler
  if (resolved.command && resolved.commandId) {
    try {
      const intent = await resolved.command.handler({
        input: resolved.intentDescription,
        ...context,
      } as any)
      return intent
    } catch (error: any) {
      console.error(`[InputResolver] Command handler failed for ${resolved.commandId}:`, error)
      // Fallback to IntentBuilder
      return IntentBuilder.inferFromInput(resolved.intentDescription)
    }
  }
  
  // Implicit mode - use IntentBuilder inference
  return IntentBuilder.inferFromInput(resolved.intentDescription)
}
