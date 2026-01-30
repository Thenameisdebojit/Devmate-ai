/**
 * PHASE D: Authority Gate
 * 
 * Validates command execution before tools are unlocked.
 * Uses existing ProjectEvolutionEngine authority logic.
 */

import type { IDECommand } from './CommandRegistry'
import type { ProjectStage, Capabilities, AuthorizationResult } from '@/lib/os/ProjectEvolutionEngine'
import type { ExecutionIntent } from './IntentBuilder'

export interface AuthorityCheckResult {
  authorized: boolean
  reason?: string
  toolPermissions?: {
    files: boolean
    terminal: boolean
    runtime: boolean
  }
  authorizationResult?: AuthorizationResult
}

/**
 * PHASE D: Authorize command execution
 * 
 * This function checks:
 * 1. Stage requirements
 * 2. Capability requirements
 * 3. Uses existing ProjectEvolutionEngine.authorizeExecution()
 * 
 * Rules:
 * - If stage < requiredStage → deny
 * - If capabilities insufficient → deny
 * - No silent fallbacks
 */
export async function authorizeExecution(
  command: IDECommand,
  intent: ExecutionIntent,
  stage: ProjectStage,
  capabilities: Capabilities,
  authorizationResult: AuthorizationResult
): Promise<AuthorityCheckResult> {
  // PHASE D: Check stage requirement
  const stageOrder: ProjectStage[] = ['empty', 'bootstrapped', 'editable', 'evolving', 'locked']
  const currentStageIndex = stageOrder.indexOf(stage)
  const requiredStageIndex = stageOrder.indexOf(command.requiredStage)
  
  if (currentStageIndex < requiredStageIndex) {
    return {
      authorized: false,
      reason: `Command ${command.id} requires stage "${command.requiredStage}", but project is in "${stage}" stage`,
      toolPermissions: {
        files: false,
        terminal: false,
        runtime: false,
      },
    }
  }
  
  // PHASE D: Check capability requirements
  if (command.requiredCapabilities.aiWrite && capabilities.aiWrite !== command.requiredCapabilities.aiWrite) {
    const required = command.requiredCapabilities.aiWrite
    const current = capabilities.aiWrite
    if (required === 'scoped' && current === false) {
      return {
        authorized: false,
        reason: `Command ${command.id} requires aiWrite capability "scoped", but current capability is "${current}"`,
        toolPermissions: {
          files: false,
          terminal: false,
          runtime: false,
        },
      }
    }
    if (required === 'planned' && (current === false || current === 'scoped')) {
      return {
        authorized: false,
        reason: `Command ${command.id} requires aiWrite capability "planned", but current capability is "${current}"`,
        toolPermissions: {
          files: false,
          terminal: false,
          runtime: false,
        },
      }
    }
  }
  
  if (command.requiredCapabilities.run !== undefined && capabilities.run !== command.requiredCapabilities.run) {
    return {
      authorized: false,
      reason: `Command ${command.id} requires run capability "${command.requiredCapabilities.run}", but current capability is "${capabilities.run}"`,
      toolPermissions: {
        files: false,
        terminal: false,
        runtime: false,
      },
    }
  }
  
  // PHASE D: Use existing authorization result from ProjectEvolutionEngine
  if (authorizationResult.status === 'deny') {
    return {
      authorized: false,
      reason: authorizationResult.reason,
      toolPermissions: {
        files: false,
        terminal: false,
        runtime: false,
      },
      authorizationResult,
    }
  }
  
  if (authorizationResult.status === 'defer') {
    return {
      authorized: false,
      reason: authorizationResult.reason,
      toolPermissions: {
        files: false,
        terminal: false,
        runtime: false,
      },
      authorizationResult,
    }
  }
  
  // PHASE D: Authorized - unlock tools based on command
  return {
    authorized: true,
    toolPermissions: {
      files: command.allowedTools.files === true,
      terminal: command.allowedTools.terminal === true,
      runtime: command.allowedTools.runtime === true,
    },
    authorizationResult,
  }
}
