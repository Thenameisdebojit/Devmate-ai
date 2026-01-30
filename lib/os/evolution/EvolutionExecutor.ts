/**
 * PHASE F′-4: Evolution Executor
 * 
 * Executes confirmed evolution plans step-by-step with checkpoints.
 * Handles rollback and recovery on failure.
 */

import { getPendingEvolutionStore, type PendingEvolution } from './PendingEvolutionStore'
import { getProjectEvolutionEngineManager } from '../ProjectEvolutionEngineManager'
import { getFileMutationKernel } from '@/lib/workspace/FileMutationKernel'
import { checkpointEngine } from '@/lib/runtime/checkpointEngine'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Execution result
 */
export interface EvolutionExecutionResult {
  success: boolean
  evolutionId: string
  stepsCompleted: number
  totalSteps: number
  filesChanged: string[]
  error?: string
  checkpointId?: string
  planningCycle?: any // PHASE F′-6: Planning cycle generated after evolution
  critiqueReport?: any // PHASE F′-7: Critique report generated after evolution
}

/**
 * Evolution Executor
 * 
 * Executes evolution plans step-by-step with safety checks.
 */
export class EvolutionExecutor {
  /**
   * Execute a confirmed evolution plan
   */
  static async execute(
    evolutionId: string,
    onProgress?: (step: number, total: number, message: string) => void
  ): Promise<EvolutionExecutionResult> {
    const store = getPendingEvolutionStore()
    const evolution = store.getById(evolutionId)

    if (!evolution) {
      throw new Error(`Evolution ${evolutionId} not found`)
    }

    if (evolution.status !== 'executing') {
      throw new Error(`Evolution ${evolutionId} is not in executing status (current: ${evolution.status})`)
    }

    const { projectId, intents, stageSnapshot } = evolution

    try {
      // Get project root
      const rootPath = await WorkspaceRegistry.getRootPath(projectId)
      if (!rootPath) {
        throw new Error(`Root path not found for project ${projectId}`)
      }

      // Get PEE and transition to evolving stage
      const peeManager = getProjectEvolutionEngineManager()
      const pee = await peeManager.getEngine(projectId, rootPath)
      
      // Verify we're in evolving stage (should be set by confirmation)
      const currentStage = pee.getStage()
      if (currentStage !== 'evolving') {
        // PHASE A: Transition via Manager to persist to disk
        await peeManager.setStage(projectId, 'evolving', 'evolution')
      }

      // Create root checkpoint before execution
      onProgress?.(0, intents.length, 'Creating root checkpoint...')
      const rootCheckpoint = await checkpointEngine.createCheckpoint(
        projectId,
        rootPath,
        `Evolution root checkpoint: ${evolution.plan}`,
        'evolution-root'
      )

      const filesChanged: string[] = []
      let lastCheckpointId = rootCheckpoint.id

      // Execute each intent step-by-step
      for (let i = 0; i < intents.length; i++) {
        const intent = intents[i]
        const stepNum = i + 1

        try {
          onProgress?.(stepNum, intents.length, `Executing step ${stepNum}/${intents.length}: ${intent.description}`)

          // Create checkpoint for this step
          const stepCheckpoint = await checkpointEngine.createCheckpoint(
            projectId,
            rootPath,
            `Evolution step ${stepNum}: ${intent.description}`,
            'evolution-step'
          )

          // Execute intent based on type
          const stepResult = await this.executeIntent(intent, projectId, rootPath, stepCheckpoint.id)
          
          filesChanged.push(...stepResult.filesChanged)
          lastCheckpointId = stepCheckpoint.id

          onProgress?.(stepNum, intents.length, `Step ${stepNum} completed`)
        } catch (stepError: any) {
          // Step failed - rollback to last checkpoint
          console.error(`[EvolutionExecutor] Step ${stepNum} failed:`, stepError)
          
          try {
            await checkpointEngine.rollback(projectId, lastCheckpointId, rootPath)
            onProgress?.(stepNum, intents.length, `Step ${stepNum} failed, rolled back`)
          } catch (rollbackError: any) {
            console.error('[EvolutionExecutor] Rollback failed:', rollbackError)
          }

          // PHASE A: Transition back to editable via Manager to persist to disk
          await peeManager.setStage(projectId, 'editable', 'evolution')
          store.abort(evolutionId, `Step ${stepNum} failed: ${stepError.message}`)

          return {
            success: false,
            evolutionId,
            stepsCompleted: i,
            totalSteps: intents.length,
            filesChanged,
            error: `Step ${stepNum} failed: ${stepError.message}`,
            checkpointId: lastCheckpointId,
          }
        }
      }

      // All steps completed successfully
      // PHASE F′-5: Auto-evaluate and mark completed goals
      try {
        const { GoalResolver } = await import('@/lib/os/goals/GoalResolver')
        const completedGoals = await GoalResolver.autoMarkCompletedGoals(projectId)
        if (completedGoals.length > 0) {
          console.log(`[EvolutionExecutor] Auto-marked ${completedGoals.length} goal(s) as completed`)
        }
      } catch (error: any) {
        // Log but don't fail evolution if goal evaluation fails
        console.warn('[EvolutionExecutor] Failed to evaluate goals:', error)
      }

      // PHASE A: Transition back to editable via Manager to persist to disk
      await peeManager.setStage(projectId, 'editable', 'evolution')
      store.markCompleted(evolutionId)

      onProgress?.(intents.length, intents.length, 'Evolution complete')

      // PHASE F′-6: Generate next planning cycle after successful evolution
      let planningCycle = null
      try {
        const { PlanningEngine } = await import('@/lib/os/planning/PlanningEngine')
        planningCycle = await PlanningEngine.generatePlan(projectId)
        if (planningCycle) {
          console.log(`[EvolutionExecutor] Generated planning cycle with ${planningCycle.proposedNextSteps.length} suggested steps`)
        }
      } catch (error: any) {
        // Log but don't fail evolution if planning fails
        console.warn('[EvolutionExecutor] Failed to generate planning cycle:', error)
      }

      // PHASE F′-7: Generate critique report after successful evolution
      let critiqueReport = null
      try {
        const { CritiqueEngine } = await import('@/lib/os/critique/CritiqueEngine')
        critiqueReport = await CritiqueEngine.generateCritique(projectId, evolutionId)
        if (critiqueReport) {
          console.log(`[EvolutionExecutor] Generated critique report with ${critiqueReport.findings.length} finding(s)`)
        }
      } catch (error: any) {
        // Log but don't fail evolution if critique fails
        console.warn('[EvolutionExecutor] Failed to generate critique report:', error)
      }

      // PHASE F′-9: Handle long-horizon autonomy thread continuation
      let threadProposal = null
      try {
        const { LongHorizonController } = await import('@/lib/os/autonomy/LongHorizonController')
        await LongHorizonController.onEvolutionCompleted(projectId, evolutionId)
        
        if (critiqueReport) {
          await LongHorizonController.onCritiqueCompleted(projectId, critiqueReport)
        }

        // Check if thread should continue
        const checkResult = await LongHorizonController.checkAndProposeNext(projectId)
        if (checkResult.shouldContinue && checkResult.proposal) {
          threadProposal = checkResult.proposal
        }
      } catch (error: any) {
        // Log but don't fail evolution if thread management fails
        console.warn('[EvolutionExecutor] Failed to handle thread continuation:', error)
      }

      return {
        success: true,
        evolutionId,
        stepsCompleted: intents.length,
        totalSteps: intents.length,
        filesChanged,
        checkpointId: rootCheckpoint.id,
        planningCycle, // PHASE F′-6: Include planning cycle
        critiqueReport, // PHASE F′-7: Include critique report
        threadProposal, // PHASE F′-9: Include thread continuation proposal
      }
    } catch (error: any) {
      // Fatal error - rollback to root checkpoint
      console.error('[EvolutionExecutor] Fatal error:', error)

      try {
        const rootPath = await WorkspaceRegistry.getRootPath(projectId)
        const rootCheckpoint = checkpointEngine.getLatestCheckpoint(projectId)
        if (rootCheckpoint) {
          await checkpointEngine.rollback(projectId, rootCheckpoint.id, rootPath)
        }
      } catch (rollbackError: any) {
        console.error('[EvolutionExecutor] Fatal rollback failed:', rollbackError)
      }

      // PHASE A: Transition back to editable via Manager to persist to disk
      try {
        const rootPath = await WorkspaceRegistry.getRootPath(projectId)
        const peeManager = getProjectEvolutionEngineManager()
        await peeManager.getEngine(projectId, rootPath) // Ensure engine exists
        await peeManager.setStage(projectId, 'editable', 'evolution')
      } catch (peeError: any) {
        console.error('[EvolutionExecutor] Failed to transition stage:', peeError)
      }

      store.abort(evolutionId, error.message)

      return {
        success: false,
        evolutionId,
        stepsCompleted: 0,
        totalSteps: intents.length,
        filesChanged: [],
        error: error.message || 'Evolution execution failed',
      }
    }
  }

  /**
   * Execute a single intent
   * 
   * Routes through AgentExecutionRouter handlers, which will respect
   * the evolving stage and architect role capabilities.
   */
  private static async executeIntent(
    intent: ExecutionIntent,
    projectId: string,
    rootPath: string,
    checkpointId: string
  ): Promise<{ filesChanged: string[] }> {
    // Get workspace and session
    const workspace = await WorkspaceRegistry.get(projectId)
    const { getAgentSessionManager } = await import('@/lib/agent/AgentSessionManager')
    const sessionManager = getAgentSessionManager()
    const session = sessionManager.getOrCreateSession(`evolution-${projectId}`, projectId, 'app-generator')

    // Route through AgentExecutionRouter
    // Note: The router will check PEE, but since we're in evolving stage,
    // it will allow the execution
    const { getAgentExecutionRouter } = await import('@/core/agent/AgentExecutionRouter')
    const router = getAgentExecutionRouter()

    const filesChanged: string[] = []
    const fileChangeEvents: string[] = []

    // Execute intent via router (it will handle the actual work)
    await router.run({
      executionIntent: intent,
      workspace,
      projectId,
      rootPath,
      agentSession: session,
    }, (event) => {
      // Track file changes
      if (event.type === 'FILE_CHANGED') {
        const path = event.payload.path
        if (path && !fileChangeEvents.includes(path)) {
          fileChangeEvents.push(path)
          filesChanged.push(path)
        }
      }
    })

    return { filesChanged }
  }
}
