/**
 * Agent Plan Executor
 * 
 * Executes multi-step agent plans with explicit user approval per step.
 * 
 * RULES:
 * - One step at a time
 * - Checkpoint before each step
 * - User approval required for each step
 * - Rollback support per step
 */

import { WorkspaceDaemon, getWorkspaceDaemon } from './WorkspaceDaemon'
import { AgentPlan, AgentPlanStep, PlanExecutionContext } from './AgentPlan'

export class AgentPlanExecutor {
  private daemon: WorkspaceDaemon
  private projectId: string
  private activePlans: Map<string, { plan: AgentPlan; context: PlanExecutionContext }> = new Map()

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

    // Handle plan approval
    const handlePlanApproved = (payload: any) => {
      const { planId } = payload
      const planData = this.activePlans.get(planId)
      if (planData) {
        planData.plan.status = 'approved'
        // Start executing first step
        this.executeNextStep(planId)
      }
    }
    eventBus.on('AGENT_PLAN_APPROVED', handlePlanApproved)

    // Handle step approval
    const handleStepApproved = (payload: any) => {
      const { planId, stepId } = payload
      const planData = this.activePlans.get(planId)
      if (planData) {
        const step = planData.plan.steps.find((s) => s.stepId === stepId)
        if (step && step.status === 'pending') {
          step.status = 'approved'
          this.executeStep(planId, stepId)
        }
      }
    }
    eventBus.on('AGENT_PLAN_STEP_APPROVED', handleStepApproved)
  }

  /**
   * Register a plan for execution
   */
  registerPlan(plan: AgentPlan): void {
    const context: PlanExecutionContext = {
      planId: plan.planId,
      currentStepIndex: 0,
      checkpoints: new Map(),
    }
    this.activePlans.set(plan.planId, { plan, context })
  }

  /**
   * Execute next step in plan
   */
  private async executeNextStep(planId: string): Promise<void> {
    const planData = this.activePlans.get(planId)
    if (!planData) return

    const { plan, context } = planData
    const nextStep = plan.steps.find((s) => s.status === 'pending' || s.status === 'approved')

    if (!nextStep) {
      // All steps completed
      plan.status = 'completed'
      this.emitObservation(`[observing] Plan "${plan.title}" completed successfully.`)
      return
    }

    // If step is already approved, execute it
    if (nextStep.status === 'approved') {
      await this.executeStep(planId, nextStep.stepId)
    } else {
      // Step needs approval - emit event for UI to show approval button
      this.emitObservation(
        `[observing] Step ${plan.steps.indexOf(nextStep) + 1}/${plan.steps.length}: ${nextStep.description}. Click "Approve Step" to proceed.`
      )
    }
  }

  /**
   * Execute a specific step
   */
  private async executeStep(planId: string, stepId: string): Promise<void> {
    const planData = this.activePlans.get(planId)
    if (!planData) return

    const { plan, context } = planData
    const step = plan.steps.find((s) => s.stepId === stepId)
    if (!step) return

    // Safety Assertion 1: Plan must be approved
    if (plan.status !== 'approved' && plan.status !== 'executing') {
      this.emitObservation(`[observing] Plan not approved. Cannot execute step.`)
      return
    }

    // Safety Assertion 2: Step must be approved
    if (step.status !== 'approved') {
      this.emitObservation(`[observing] Step not approved. Cannot execute.`)
      return
    }

    plan.status = 'executing'
    step.status = 'executing'

    try {
      // Create checkpoint before step execution
      const checkpointId = await this.createCheckpoint(stepId)
      if (!checkpointId) {
        step.status = 'failed'
        step.error = 'Failed to create checkpoint'
        this.emitObservation(`[observing] Step failed: Could not create checkpoint.`)
        return
      }

      context.checkpoints.set(stepId, checkpointId)
      step.checkpointId = checkpointId

      // Execute step based on action type
      let result: any
      switch (step.actionType) {
        case 'READ_FILE':
          result = await this.executeReadFile(step.target!)
          break
        case 'PATCH_FILE':
          result = await this.executePatchFile(step.target!, step.parameters)
          break
        case 'RUN_COMMAND':
          result = await this.executeRunCommand(step.target!, step.parameters)
          break
        default:
          throw new Error(`Unknown action type: ${step.actionType}`)
      }

      step.result = result
      step.status = 'completed'

      // Emit step completion event
      this.daemon.getEventBus().emit({
        type: 'AGENT_PLAN_STEP_COMPLETED',
        payload: { planId, stepId, result },
      } as any)

      this.emitObservation(`[observing] Step completed: ${step.description}`)

      // Execute next step
      await this.executeNextStep(planId)

    } catch (error: any) {
      step.status = 'failed'
      step.error = error.message
      this.emitObservation(`[observing] Step failed: ${error.message}`)
    }
  }

  /**
   * Create checkpoint before step execution
   */
  private async createCheckpoint(stepId: string): Promise<string | null> {
    try {
      const response = await fetch('/api/runtime/checkpoint/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: this.projectId,
          description: `Before step ${stepId}`,
          type: 'pre-write',
        }),
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data.checkpoint?.id || null
    } catch {
      return null
    }
  }

  /**
   * Execute READ_FILE action
   */
  private async executeReadFile(filePath: string): Promise<any> {
    // This is a read-only operation, no checkpoint needed for read
    // But we still create checkpoint for consistency
    const response = await fetch(`/api/runtime/file/read?projectId=${this.projectId}&path=${encodeURIComponent(filePath)}`)
    
    if (!response.ok) {
      throw new Error(`Failed to read file: ${filePath}`)
    }

    const data = await response.json()
    return { content: data.content, filePath }
  }

  /**
   * Execute PATCH_FILE action
   */
  private async executePatchFile(filePath: string, parameters?: Record<string, any>): Promise<any> {
    const response = await fetch('/api/runtime/fix-build-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: this.projectId,
        errors: [
          {
            file: filePath,
            line: parameters?.line || 1,
            message: parameters?.errorMessage || 'Unknown error',
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to patch file')
    }

    const result = await response.json()

    // Dispatch FILE_CHANGED event
    this.daemon.dispatch({
      type: 'FILE_CHANGED',
      payload: {
        path: result.filePath,
        content: result.fixedContent,
      },
    })

    return result
  }

  /**
   * Execute RUN_COMMAND action
   */
  private async executeRunCommand(command: string, parameters?: Record<string, any>): Promise<any> {
    // For Phase G, we don't actually execute commands
    // This is a placeholder for future phases
    throw new Error('RUN_COMMAND not implemented in Phase G')
  }

  /**
   * Rollback a specific step
   */
  async rollbackStep(planId: string, stepId: string): Promise<void> {
    const planData = this.activePlans.get(planId)
    if (!planData) return

    const { plan, context } = planData
    const step = plan.steps.find((s) => s.stepId === stepId)
    if (!step || !step.checkpointId) return

    try {
      const response = await fetch('/api/runtime/checkpoint/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: this.projectId,
          checkpointId: step.checkpointId,
        }),
      })

      if (response.ok) {
        step.status = 'rolled_back'
        this.emitObservation(`[observing] Step rolled back: ${step.description}`)
      }
    } catch (error: any) {
      this.emitObservation(`[observing] Rollback failed: ${error.message}`)
    }
  }

  /**
   * Rollback entire plan
   */
  async rollbackPlan(planId: string): Promise<void> {
    const planData = this.activePlans.get(planId)
    if (!planData) return

    const { plan, context } = planData

    // Rollback steps in reverse order
    const executedSteps = plan.steps
      .filter((s) => s.status === 'completed' && s.checkpointId)
      .reverse()

    for (const step of executedSteps) {
      await this.rollbackStep(planId, step.stepId)
    }

    plan.status = 'cancelled'
    this.emitObservation(`[observing] Plan "${plan.title}" rolled back.`)
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
   * Get active plan
   */
  getPlan(planId: string): AgentPlan | null {
    return this.activePlans.get(planId)?.plan || null
  }

  /**
   * Cleanup
   */
  destroy() {
    this.activePlans.clear()
  }
}

// Singleton per project
const executorInstances = new Map<string, AgentPlanExecutor>()

export function getAgentPlanExecutor(projectId: string): AgentPlanExecutor {
  const daemon = getWorkspaceDaemon(projectId)

  if (!executorInstances.has(projectId)) {
    executorInstances.set(projectId, new AgentPlanExecutor(daemon, projectId))
  }
  return executorInstances.get(projectId)!
}

export function destroyAgentPlanExecutor(projectId: string) {
  const executor = executorInstances.get(projectId)
  if (executor) {
    executor.destroy()
    executorInstances.delete(projectId)
  }
}

