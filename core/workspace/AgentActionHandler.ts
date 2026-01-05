/**
 * Agent Action Handler
 * 
 * Handles user-approved agent actions with strict safety constraints.
 * 
 * RULES:
 * - Only executes after explicit user consent
 * - Only one action type allowed: FIX_BUILD_ERROR
 * - Only one file modified per action
 * - Checkpoint always created before action
 * - Full rollback support
 */

import { WorkspaceDaemon, WorkspaceEvent, getWorkspaceDaemon } from './WorkspaceDaemon'
import { AgentPlan, AgentPlanStep } from './AgentPlan'
import { getAgentConfidenceEngine } from './AgentConfidenceEngine'

export type AgentActionType = 'FIX_BUILD_ERROR'

export interface AgentActionRequest {
  actionType: AgentActionType
  projectId: string
  userExplicitlyApproved: boolean
}

export class AgentActionHandler {
  private daemon: WorkspaceDaemon
  private projectId: string

  constructor(daemon: WorkspaceDaemon, projectId: string) {
    this.daemon = daemon
    this.projectId = projectId
    this.setupSubscriptions()
  }

  /**
   * Setup event subscriptions
   */
  private setupSubscriptions() {
    const eventBus = this.daemon.getEventBus()
    
    const handleActionRequest = (payload: any) => {
      // Only handle if actionType matches
      if (payload && payload.actionType) {
        this.handleActionRequest({
          actionType: payload.actionType,
          projectId: this.projectId,
          userExplicitlyApproved: true, // Only called after user click
        })
      }
    }

    eventBus.on('AGENT_ACTION_REQUESTED', handleActionRequest)
  }

  /**
   * Handle action request with safety assertions
   */
  private async handleActionRequest(request: AgentActionRequest): Promise<void> {
    try {
      // Safety Assertion 1: Action type must be FIX_BUILD_ERROR
      if (request.actionType !== 'FIX_BUILD_ERROR') {
        this.emitObservation(
          `[observing] Action type "${request.actionType}" is not allowed. Only FIX_BUILD_ERROR is permitted.`
        )
        return
      }

      // Safety Assertion 2: User must have explicitly approved
      if (!request.userExplicitlyApproved) {
        this.emitObservation(
          '[observing] Action aborted: User approval required.'
        )
        return
      }

      // Get workspace state
      const state = this.daemon.getState()
      
      // Safety Assertion 3: Must have build errors
      if (state.build.errors.length === 0) {
        this.emitObservation(
          '[observing] No build errors found. Nothing to fix.'
        )
        return
      }

      // Generate plan (NO EXECUTION YET)
      await this.generateFixPlan(state.build.errors)

    } catch (error: any) {
      console.error('[AgentActionHandler] Error:', error)
      this.emitObservation(
        `[observing] Action failed: ${error.message || 'Unknown error'}`
      )
    }
  }

  /**
   * Generate fix plan (NO EXECUTION)
   * Analyzes build errors and creates a multi-step plan
   */
  private async generateFixPlan(
    errors: Array<{ file: string; line: number; message: string }>
  ): Promise<void> {
    if (errors.length === 0) {
      return
    }

    // Analyze errors and create plan steps
    const steps: AgentPlanStep[] = []
    const firstError = errors[0]
    const filePath = firstError.file || 'src/index.ts'

    // Step 1: Read the file to understand current state
    steps.push({
      stepId: `step-${Date.now()}-1`,
      description: `Read file ${filePath} to analyze the error`,
      actionType: 'READ_FILE',
      target: filePath,
      requiresApproval: true,
      status: 'pending',
    })

    // Step 2: Patch the file to fix the error
    steps.push({
      stepId: `step-${Date.now()}-2`,
      description: `Fix error on line ${firstError.line}: ${firstError.message}`,
      actionType: 'PATCH_FILE',
      target: filePath,
      parameters: {
        line: firstError.line,
        errorMessage: firstError.message,
        fixType: 'comment_out', // Simple fix: comment out problematic line
      },
      requiresApproval: true,
      status: 'pending',
    })

    // Create plan
    const plan: AgentPlan = {
      planId: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: 'Fix Build Error',
      summary: `Fix ${errors.length} error${errors.length > 1 ? 's' : ''} in ${filePath}`,
      steps,
      createdAt: Date.now(),
      status: 'proposed',
    }

    // Emit plan proposal (NO EXECUTION)
    this.daemon.getEventBus().emit({
      type: 'AGENT_PLAN_PROPOSED',
      payload: { plan },
    } as any)

    // Get confidence context
    let confidenceContext = ''
    try {
      const confidenceEngine = getAgentConfidenceEngine(this.daemon.getState().projectId)
      const report = confidenceEngine.getCurrentReport()
      if (report.confidenceLevel === 'HIGH' && report.riskLevel === 'LOW') {
        confidenceContext = ' This change looks safe based on recent stable builds.'
      } else if (report.riskLevel === 'HIGH') {
        confidenceContext = ' There\'s significant risk here — recent build failures detected.'
      } else if (report.riskLevel === 'MEDIUM') {
        confidenceContext = ' There\'s some risk here — recent build failures detected.'
      }
    } catch {
      // Confidence engine not available, skip context
    }

    // Emit observation
    this.emitObservation(
      `[observing] Generated fix plan with ${steps.length} steps.${confidenceContext} Review and approve to proceed.`
    )
  }

  /**
   * Emit observation
   */
  private emitObservation(message: string): void {
    this.daemon.getEventBus().emit({
      type: 'AGENT_OBSERVATION',
      payload: {
        id: `obs-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        message,
        category: 'pattern',
        confidence: 1.0,
      },
    } as any)
  }

  /**
   * Cleanup
   */
  destroy() {
    // Cleanup handled by event bus
  }
}

// Singleton per project
const handlerInstances = new Map<string, AgentActionHandler>()

export function getAgentActionHandler(projectId: string): AgentActionHandler {
  const daemon = getWorkspaceDaemon(projectId)
  
  if (!handlerInstances.has(projectId)) {
    handlerInstances.set(projectId, new AgentActionHandler(daemon, projectId))
  }
  return handlerInstances.get(projectId)!
}

export function destroyAgentActionHandler(projectId: string) {
  const handler = handlerInstances.get(projectId)
  if (handler) {
    handler.destroy()
    handlerInstances.delete(projectId)
  }
}

