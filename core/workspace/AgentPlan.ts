/**
 * Agent Plan Data Model
 * 
 * Defines the structure for multi-step agent plans that require
 * explicit user approval before execution.
 */

export type AgentPlan = {
  planId: string
  title: string
  summary: string
  steps: AgentPlanStep[]
  createdAt: number
  status: 'proposed' | 'approved' | 'executing' | 'completed' | 'cancelled'
}

export type AgentPlanStep = {
  stepId: string
  description: string
  actionType: 'READ_FILE' | 'PATCH_FILE' | 'RUN_COMMAND'
  target?: string // File path or command
  parameters?: Record<string, any> // Additional parameters for the action
  requiresApproval: true
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'rolled_back' | 'failed'
  checkpointId?: string // Checkpoint created before this step
  result?: any // Result of step execution
  error?: string // Error if step failed
}

export interface PlanExecutionContext {
  planId: string
  currentStepIndex: number
  checkpoints: Map<string, string> // stepId -> checkpointId
}

