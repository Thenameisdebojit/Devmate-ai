/**
 * PHASE F′-9: Long-Horizon Controller
 * 
 * Decides what happens next in an execution thread.
 * Never executes directly - only proposes next steps.
 */

import { getExecutionThreadStore, type ExecutionThread } from './ExecutionThreadStore'
import { getGoalTreeStore } from '../goals/GoalTreeStore'
import { GoalProgressResolver } from '../goals/GoalProgressResolver'
import { PlanningEngine } from '../planning/PlanningEngine'
import { getProjectEvolutionEngineManager } from '../ProjectEvolutionEngineManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import type { AutonomyMode } from '../ProjectEvolutionEngine'

/**
 * Long-Horizon Controller
 * 
 * Manages execution threads and determines next steps.
 * Rules:
 * - Never executes directly
 * - Always requires confirmation
 * - Respects all safety gates
 */
export class LongHorizonController {
  /**
   * Check if execution thread should continue
   * 
   * Returns next step proposal or null if thread should pause/complete.
   */
  static async checkAndProposeNext(
    projectId: string
  ): Promise<{ shouldContinue: boolean; proposal?: any; reason?: string }> {
    try {
      const threadStore = getExecutionThreadStore()
      const thread = await threadStore.getThread(projectId)

      // No thread or thread not active
      if (!thread || thread.status !== 'active') {
        return { shouldContinue: false, reason: 'No active execution thread' }
      }

      // Get project state
      const rootPath = await WorkspaceRegistry.getRootPath(projectId)
      if (!rootPath) {
        return { shouldContinue: false, reason: 'Project root path not found' }
      }

      // Check autonomy mode
      const peeManager = getProjectEvolutionEngineManager()
      const pee = await peeManager.getEngine(projectId, rootPath)
      const autonomyMode = pee.getAutonomyMode()

      // Only continue if in long-horizon mode
      if (autonomyMode !== 'long-horizon') {
        return { shouldContinue: false, reason: 'Autonomy mode is not long-horizon' }
      }

      // Check project stage
      const stage = pee.getStage()
      if (stage !== 'editable') {
        return { shouldContinue: false, reason: `Project is in ${stage} stage, cannot continue thread` }
      }

      // Resolve progress for goal tree
      const treeStore = getGoalTreeStore()
      await GoalProgressResolver.resolveProgress(projectId, thread.goalId)

      // Get next executable GoalNode
      const nextNodes = await treeStore.getNextExecutableNodes(projectId, thread.goalId)

      if (nextNodes.length === 0) {
        // No more executable nodes - complete thread
        await threadStore.completeThread(projectId)
        return {
          shouldContinue: false,
          reason: 'All goal nodes completed',
          proposal: {
            type: 'completion',
            message: 'All sub-goals have been completed. The execution thread is now complete.',
          },
        }
      }

      // Select highest priority node (first in list, already sorted)
      const nextNode = nextNodes[0]

      // Generate plan for this node
      const planningCycle = await PlanningEngine.generatePlan(projectId)

      if (!planningCycle || planningCycle.proposedNextSteps.length === 0) {
        return { shouldContinue: false, reason: 'No planning steps available' }
      }

      // Find step that matches the GoalNode
      const matchingStep = planningCycle.proposedNextSteps.find(
        step => step.goalNodeId === nextNode.id
      ) || planningCycle.proposedNextSteps[0]

      // Propose next evolution
      return {
        shouldContinue: true,
        proposal: {
          type: 'evolution',
          goalNodeId: nextNode.id,
          goalNodeDescription: nextNode.description,
          plannedStep: matchingStep,
          planningCycle,
          message: `Next step toward your goal: ${matchingStep.description}. Should I proceed?`,
        },
      }
    } catch (error: any) {
      console.error('[LongHorizonController] Failed to check thread:', error)
      return { shouldContinue: false, reason: `Error: ${error.message}` }
    }
  }

  /**
   * Handle evolution completion in thread context
   * 
   * After evolution completes, check if thread should continue.
   */
  static async onEvolutionCompleted(
    projectId: string,
    evolutionId: string
  ): Promise<void> {
    try {
      const threadStore = getExecutionThreadStore()
      const thread = await threadStore.getThread(projectId)

      if (!thread || thread.status !== 'active') {
        return // No active thread
      }

      // Update thread with last evolution
      await threadStore.updateThread(projectId, {
        lastEvolutionId: evolutionId,
        updatedAt: Date.now(),
      })

      // Check if thread should continue
      const checkResult = await this.checkAndProposeNext(projectId)

      if (checkResult.shouldContinue && checkResult.proposal) {
        // Thread should continue - proposal will be emitted by caller
        console.log(`[LongHorizonController] Thread continuing: ${checkResult.proposal.message}`)
      } else {
        // Thread should pause or complete
        if (checkResult.reason?.includes('completed')) {
          console.log(`[LongHorizonController] Thread completed: ${checkResult.reason}`)
        } else {
          console.log(`[LongHorizonController] Thread paused: ${checkResult.reason}`)
        }
      }
    } catch (error: any) {
      console.error('[LongHorizonController] Failed to handle evolution completion:', error)
    }
  }

  /**
   * Handle critique completion in thread context
   * 
   * After critique completes, update thread state.
   */
  static async onCritiqueCompleted(
    projectId: string,
    critiqueReport: any
  ): Promise<void> {
    try {
      const threadStore = getExecutionThreadStore()
      const thread = await threadStore.getThread(projectId)

      if (!thread || thread.status !== 'active') {
        return // No active thread
      }

      // Update thread with critique info
      // Note: critiqueReport.id might not exist, so we use evolutionId as reference
      await threadStore.updateThread(projectId, {
        updatedAt: Date.now(),
      })

      // If critique found issues, thread may need to pause for user review
      if (critiqueReport.findings && critiqueReport.findings.length > 0) {
        const highSeverityFindings = critiqueReport.findings.filter(
          (f: any) => f.severity === 'high'
        )

        if (highSeverityFindings.length > 0) {
          // High severity issues - pause thread for user review
          await threadStore.pauseThread(projectId)
          console.log(`[LongHorizonController] Thread paused due to high-severity critique findings`)
        }
      }
    } catch (error: any) {
      console.error('[LongHorizonController] Failed to handle critique completion:', error)
    }
  }

  /**
   * Pause thread (called on user request or error)
   */
  static async pauseThread(projectId: string, reason?: string): Promise<void> {
    try {
      const threadStore = getExecutionThreadStore()
      await threadStore.pauseThread(projectId)
      console.log(`[LongHorizonController] Thread paused: ${reason || 'User request'}`)
    } catch (error: any) {
      console.error('[LongHorizonController] Failed to pause thread:', error)
    }
  }

  /**
   * Abort thread (called on user request or fatal error)
   */
  static async abortThread(projectId: string, reason?: string): Promise<void> {
    try {
      const threadStore = getExecutionThreadStore()
      await threadStore.abortThread(projectId, reason)
      console.log(`[LongHorizonController] Thread aborted: ${reason || 'User request'}`)
    } catch (error: any) {
      console.error('[LongHorizonController] Failed to abort thread:', error)
    }
  }
}
