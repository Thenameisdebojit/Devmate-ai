/**
 * PHASE D: Input Mode Types
 * 
 * Defines explicit input modes for user interactions.
 */

export type InputMode = 
  | "chat"        // Discussion only - no execution
  | "command"     // Explicit commands - /run, /edit, /explain
  | "implicit"    // Natural language actions - "add calculator logic"

/**
 * PHASE D: Resolve input mode from user input
 */
export function resolveInputMode(input: string): InputMode {
  const trimmed = input.trim()
  
  // Command mode: starts with /
  if (trimmed.startsWith('/chat')) {
    return 'chat'
  }
  
  if (trimmed.startsWith('/run') || 
      trimmed.startsWith('/edit') || 
      trimmed.startsWith('/explain') ||
      trimmed.startsWith('/fix') ||
      trimmed.startsWith('/generate')) {
    return 'command'
  }
  
  // Default: implicit (natural language)
  return 'implicit'
}
