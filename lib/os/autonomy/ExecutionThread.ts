/**
 * PHASE F′-9: Execution Thread
 * 
 * Represents an active execution thread pursuing a goal over time.
 * The system maintains temporal ownership of intent.
 */

/**
 * Execution Thread
 * 
 * Represents "The system is actively pursuing this goal over time."
 * Rules:
 * - One active thread per project
 * - Thread persists across reloads
 * - Thread NEVER executes without confirmation
 */
export type ExecutionThread = {
  projectId: string
  goalId: string
  status: 'active' | 'paused' | 'completed' | 'aborted'
  currentGoalNodeId: string | null // Current GoalNode being pursued
  lastEvolutionId?: string // Last evolution executed in this thread
  lastCritiqueId?: string // Last critique report generated
  startedAt: number
  updatedAt: number
  pausedAt?: number
  completedAt?: number
  abortedAt?: number
  abortReason?: string
}
