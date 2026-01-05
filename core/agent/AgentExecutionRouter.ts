/**
 * Agent Execution Router
 * 
 * Routes user prompts to appropriate handlers:
 * - GenerationController (empty workspace)
 * - AgentPlanExecutor (file mutations)
 * - RuntimeKernel (run/test/debug commands)
 * 
 * Deterministic routing - no guessing.
 */

import { WorkspaceDaemon } from '@/core/workspace/WorkspaceDaemon'
import { getAgentPlanExecutor } from '@/core/workspace/AgentPlanExecutor'
import { getAgentConfidenceEngine } from '@/core/workspace/AgentConfidenceEngine'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'
import { GenerationController } from '@/lib/runtime/generationController'
import { promises as fs } from 'fs'

export type ExecutionEvent = 
  | { type: 'GENERATION_STARTED'; payload: { projectId: string } }
  | { type: 'GENERATION_PROGRESS'; payload: { step: number; total: number; message: string } }
  | { type: 'GENERATION_COMPLETE'; payload: { projectId: string; files: Array<{ path: string; content: string }> } }
  | { type: 'PLAN_PROPOSED'; payload: { planId: string; title: string; steps: number } }
  | { type: 'PLAN_APPROVED'; payload: { planId: string } }
  | { type: 'STEP_COMPLETED'; payload: { planId: string; stepId: string; result: any } }
  | { type: 'EXECUTION_ERROR'; payload: { error: string } }
  | { type: 'RUNTIME_STARTING'; payload: { projectId: string } }
  | { type: 'RUNTIME_STARTED'; payload: { projectId: string; port?: number } }

export interface ExecutionContext {
  projectId: string
  projectPath: string
  prompt: string
  domain?: string
}

export interface RouterRunContext {
  prompt: string
  workspace: WorkspaceDaemon
  projectId: string
  rootPath: string
}

/**
 * Agent Execution Router
 * Routes prompts to appropriate execution handlers
 */
export class AgentExecutionRouter {
  /**
   * Run agent execution with workspace from registry
   * 
   * TASK 4: Accept workspace as required argument
   * - NEVER fetch or construct workspace internally
   * - Throw if workspace or rootPath is missing
   * - Determine routing via explicit fileCount
   */
  async run(
    context: RouterRunContext,
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { prompt, workspace, projectId, rootPath } = context

    // TASK 4: Throw if workspace is missing
    if (!workspace) {
      const error = 'Workspace is required — aborting agent execution'
      console.error('[AgentExecutionRouter]', error)
      onEvent?.({
        type: 'EXECUTION_ERROR',
        payload: { error },
      })
      throw new Error(error)
    }

    // TASK 4: Throw if rootPath is undefined
    if (!rootPath) {
      const error = 'Workspace rootPath is undefined — aborting agent execution'
      console.error('[AgentExecutionRouter]', error)
      onEvent?.({
        type: 'EXECUTION_ERROR',
        payload: { error },
      })
      throw new Error(error)
    }

    try {
      // Verify project directory exists
      try {
        await fs.access(rootPath)
      } catch (error: any) {
        const errorMsg = `Workspace directory does not exist: ${rootPath} — aborting agent execution`
        console.error('[AgentExecutionRouter]', errorMsg)
        onEvent?.({
          type: 'EXECUTION_ERROR',
          payload: { error: errorMsg },
        })
        throw new Error(errorMsg)
      }

      // TASK 4: Determine routing via explicit fileCount
      const fileCount = await this.getFileCount(rootPath)
      
      console.log('[AgentExecutionRouter] Routing decision:', {
        projectId,
        rootPath,
        fileCount,
      })

      // TASK 4: Explicit routing based on file count
      if (fileCount === 0) {
        // Empty workspace → GenerationController
        await this.handleGeneration({ prompt, workspace, projectId, rootPath }, onEvent)
      } else {
        // Existing workspace → AgentPlanExecutor
        await this.handleMutation({ prompt, workspace, projectId, rootPath }, onEvent)
      }
    } catch (error: any) {
      onEvent?.({
        type: 'EXECUTION_ERROR',
        payload: { error: error.message || 'Execution failed' },
      })
      throw error
    }
  }

  /**
   * Get file count in workspace (TASK 3: Explicit count, no guessing)
   */
  private async getFileCount(projectPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true })
      
      // Count only files (not directories), excluding hidden files
      const fileCount = entries.filter(
        (entry) => entry.isFile() && !entry.name.startsWith('.')
      ).length

      return fileCount
    } catch (error: any) {
      // If directory doesn't exist or can't be read, return 0
      if (error.code === 'ENOENT') {
        return 0
      }
      throw error
    }
  }

  /**
   * Handle generation (empty workspace)
   */
  private async handleGeneration(
    context: { prompt: string; workspace: WorkspaceDaemon; projectId: string; rootPath: string },
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { projectId, rootPath, workspace } = context

    // TASK 4: Workspace is passed as dependency
    if (!workspace) {
      throw new Error('Workspace is required for generation')
    }

    onEvent?.({
      type: 'GENERATION_STARTED',
      payload: { projectId },
    })

    // Use GenerationController with workspace dependency
    const generationController = new GenerationController(projectId, rootPath)
    
    // For now, emit events that generation would happen
    // In a real implementation, this would call generationController methods
    // This is a placeholder that preserves the architecture
    
    onEvent?.({
      type: 'GENERATION_PROGRESS',
      payload: { step: 1, total: 3, message: 'Analyzing requirements...' },
    })

    // Note: Actual generation would happen via existing /api/generate-app route
    // This router just orchestrates the decision-making
    // The generation itself is handled by the existing API route
  }

  /**
   * Handle mutation (existing workspace)
   */
  private async handleMutation(
    context: { prompt: string; workspace: WorkspaceDaemon; projectId: string; rootPath: string },
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { projectId, prompt, workspace } = context

    // TASK 4: Workspace is passed as dependency (never create it here)
    if (!workspace) {
      throw new Error('Workspace is required for mutation')
    }

    // Get plan executor (it will use the workspace from registry internally)
    const planExecutor = getAgentPlanExecutor(projectId)
    const confidenceEngine = getAgentConfidenceEngine(projectId)

    // Check confidence before proceeding
    const confidenceReport = confidenceEngine.getCurrentReport()
    
    if (confidenceReport.riskLevel === 'HIGH' && confidenceReport.confidenceLevel === 'LOW') {
      // High risk - require explicit approval
      onEvent?.({
        type: 'EXECUTION_ERROR',
        payload: { error: 'High risk detected. Please review and approve changes manually.' },
      })
      return
    }

    // Emit observation that agent is analyzing
    workspace.getEventBus().emit({
      type: 'AGENT_OBSERVATION',
      payload: {
        id: `obs-${Date.now()}`,
        timestamp: Date.now(),
        message: `Analyzing prompt: "${prompt.substring(0, 100)}..."`,
        category: 'analysis',
        confidence: confidenceReport.confidenceScore,
      },
    } as any)

    // The actual plan creation happens via AgentActionHandler
    // which listens to build errors and creates plans
    // For prompt-based mutations, we'd need to extend AgentActionHandler
    // For now, this router just orchestrates the decision

    // Note: In a full implementation, this would:
    // 1. Analyze the prompt to determine what files need changes
    // 2. Create a plan via AgentActionHandler or directly
    // 3. Emit PLAN_PROPOSED events
    // 4. Wait for approval
    // 5. Execute via AgentPlanExecutor (which uses FileMutationKernel)
  }

  /**
   * Start runtime after successful generation/mutation
   */
  async startRuntime(projectId: string, onEvent?: (event: ExecutionEvent) => void): Promise<void> {
    try {
      onEvent?.({
        type: 'RUNTIME_STARTING',
        payload: { projectId },
      })

      const kernel = RuntimeKernel.get(projectId)
      await kernel.startRuntime()

      onEvent?.({
        type: 'RUNTIME_STARTED',
        payload: { projectId },
      })
    } catch (error: any) {
      onEvent?.({
        type: 'EXECUTION_ERROR',
        payload: { error: `Failed to start runtime: ${error.message}` },
      })
      throw error
    }
  }
}

// Singleton instance
let routerInstance: AgentExecutionRouter | null = null

export function getAgentExecutionRouter(): AgentExecutionRouter {
  if (!routerInstance) {
    routerInstance = new AgentExecutionRouter()
  }
  return routerInstance
}

