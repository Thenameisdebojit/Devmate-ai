/**
 * PHASE D: Execution Boundary
 * 
 * Clear boundary between input acceptance and execution start.
 * 
 * Flow:
 * 1. User input accepted
 * 2. Command resolved
 * 3. Authority checked
 * 4. Tools unlocked
 * 5. Execution starts
 */

import { resolveInput, buildExecutionIntent } from './InputResolver'
import type { ResolvedInput } from './InputResolver'
import { authorizeExecution } from './AuthorityGate'
import type { AuthorityCheckResult } from './AuthorityGate'
import type { ExecutionIntent } from './IntentBuilder'
import type { IDECommand } from './CommandRegistry'

export interface ExecutionContext {
  projectId: string
  rootPath: string
  stage: string
  capabilities: any
  authorizationResult: any
}

export interface ExecutionBoundaryResult {
  mode: 'chat' | 'command' | 'implicit'
  command?: IDECommand
  intent?: ExecutionIntent | null
  authorized: boolean
  reason?: string
  toolPermissions?: {
    files: boolean
    terminal: boolean
    runtime: boolean
  }
}

/**
 * PHASE D: Process input through execution boundary
 * 
 * This is the single entry point for all user input processing.
 */
export async function processInputThroughBoundary(
  input: string,
  context: ExecutionContext
): Promise<ExecutionBoundaryResult> {
  // Step 1: Resolve input to mode and command
  const resolved: ResolvedInput = resolveInput(input)
  
  // Step 2: Chat mode - no execution
  if (resolved.mode === 'chat') {
    return {
      mode: 'chat',
      authorized: false, // Chat doesn't execute
      toolPermissions: {
        files: false,
        terminal: false,
        runtime: false,
      },
    }
  }
  
  // Step 3: Build execution intent
  const intent = await buildExecutionIntent(resolved, context)
  
  if (!intent || !resolved.command) {
    // No command or intent - treat as chat
    return {
      mode: resolved.mode,
      authorized: false,
      toolPermissions: {
        files: false,
        terminal: false,
        runtime: false,
      },
    }
  }
  
  // Step 4: Check authority
  const authorityCheck = await authorizeExecution(
    resolved.command,
    intent,
    context.stage as any,
    context.capabilities,
    context.authorizationResult
  )
  
  // Step 5: Return result with tool permissions
  return {
    mode: resolved.mode,
    command: resolved.command,
    intent,
    authorized: authorityCheck.authorized,
    reason: authorityCheck.reason,
    toolPermissions: authorityCheck.toolPermissions || {
      files: false,
      terminal: false,
      runtime: false,
    },
  }
}
