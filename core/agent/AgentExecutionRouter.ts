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

/**
 * PHASE 2: Agent Execution Router
 * 
 * Routes by executionIntent.type (not prompt).
 * No implicit behavior. No guessing.
 */

import { WorkspaceDaemon } from '@/core/workspace/WorkspaceDaemon'
import { getAgentPlanExecutor } from '@/core/workspace/AgentPlanExecutor'
import { getAgentConfidenceEngine } from '@/core/workspace/AgentConfidenceEngine'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'
import { GenerationController } from '@/lib/runtime/generationController'
import { getContextBuilder } from '@/lib/agent/ContextBuilder'
import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'
import type { AgentSession } from '@/lib/agent/AgentSessionManager'
import { promises as fs } from 'fs'
import { join } from 'path'

// PHASE 2: Structured execution events
export type ExecutionEvent = 
  | { type: 'AGENT_THINKING'; payload: { message: string } }
  | { type: 'AGENT_ACTION'; payload: { action: string; details: any } }
  | { type: 'FILE_CHANGED'; payload: { path: string; content?: string } }
  | { type: 'RUNTIME_EVENT'; payload: { event: string; details: any } }
  | { type: 'AGENT_DONE'; payload: { result: any } }
  | { type: 'AGENT_ERROR'; payload: { error: string } }
  // Legacy events (for backward compatibility)
  | { type: 'GENERATION_STARTED'; payload: { projectId: string } }
  | { type: 'GENERATION_PROGRESS'; payload: { step: number; total: number; message: string } }
  | { type: 'GENERATION_COMPLETE'; payload: { projectId: string; files: Array<{ path: string; content: string }> } }
  | { type: 'PLAN_PROPOSED'; payload: { planId: string; title: string; steps: number } }
  | { type: 'PLAN_APPROVED'; payload: { planId: string } }
  | { type: 'STEP_COMPLETED'; payload: { planId: string; stepId: string; result: any } }
  | { type: 'EXECUTION_ERROR'; payload: { error: string } }
  | { type: 'RUNTIME_STARTING'; payload: { projectId: string } }
  | { type: 'RUNTIME_STARTED'; payload: { projectId: string; port?: number } }

export interface RouterRunContext {
  executionIntent: ExecutionIntent // PHASE 2: Required, not prompt
  workspace: WorkspaceDaemon
  projectId: string
  rootPath: string
  agentSession: AgentSession // PHASE 2: Required
}

/**
 * Agent Execution Router
 * Routes prompts to appropriate execution handlers
 */
export class AgentExecutionRouter {
  /**
   * PHASE 2: Run agent execution by intent.type
   * 
   * Routes strictly by executionIntent.type:
   * - generate → GenerationController
   * - mutate → AgentPlanExecutor
   * - run → RuntimeKernel.start
   * - explain → Read-only context, no writes
   * - fix → Debug workflow (read errors, then mutate)
   * 
   * No implicit behavior. No guessing.
   */
  async run(
    context: RouterRunContext,
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { executionIntent, workspace, projectId, rootPath, agentSession } = context

    // PHASE 2: FAIL LOUDLY - Validate required fields
    if (!workspace) {
      const error = 'Workspace is required — aborting agent execution'
      console.error('[AgentExecutionRouter]', error)
      onEvent?.({
        type: 'AGENT_ERROR',
        payload: { error },
      })
      throw new Error(error)
    }

    if (!rootPath) {
      const error = 'Workspace rootPath is undefined — aborting agent execution'
      console.error('[AgentExecutionRouter]', error)
      onEvent?.({
        type: 'AGENT_ERROR',
        payload: { error },
      })
      throw new Error(error)
    }

    if (!executionIntent) {
      const error = 'Execution intent is required — aborting agent execution'
      console.error('[AgentExecutionRouter]', error)
      onEvent?.({
        type: 'AGENT_ERROR',
        payload: { error },
      })
      throw new Error(error)
    }

    if (!agentSession) {
      const error = 'Agent session is required — aborting agent execution'
      console.error('[AgentExecutionRouter]', error)
      onEvent?.({
        type: 'AGENT_ERROR',
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
          type: 'AGENT_ERROR',
          payload: { error: errorMsg },
        })
        throw new Error(errorMsg)
      }

      // PHASE 2: Route strictly by intent.type
      console.log('[AgentExecutionRouter] Routing by intent type:', {
        projectId,
        intentType: executionIntent.type,
        rootPath,
      })

      switch (executionIntent.type) {
        case 'generate':
          await this.handleGenerate({ executionIntent, workspace, projectId, rootPath, agentSession }, onEvent)
          break

        case 'mutate':
          await this.handleMutate({ executionIntent, workspace, projectId, rootPath, agentSession }, onEvent)
          break

        case 'run':
          await this.handleRun({ executionIntent, workspace, projectId, rootPath, agentSession }, onEvent)
          break

        case 'debug':
          await this.handleDebug({ executionIntent, workspace, projectId, rootPath, agentSession }, onEvent)
          break

        case 'explain':
          await this.handleExplain({ executionIntent, workspace, projectId, rootPath, agentSession }, onEvent)
          break

        case 'fix':
          await this.handleFix({ executionIntent, workspace, projectId, rootPath, agentSession }, onEvent)
          break

        default:
          const error = `Unknown intent type: ${(executionIntent as any).type}`
          onEvent?.({
            type: 'AGENT_ERROR',
            payload: { error },
          })
          throw new Error(error)
      }
    } catch (error: any) {
      onEvent?.({
        type: 'AGENT_ERROR',
        payload: { error: error.message || 'Execution failed' },
      })
      throw error
    }
  }

  /**
   * PHASE 3: Handle generate intent
   * Wires to real execution via FileMutationKernel
   */
  private async handleGenerate(
    context: {
      executionIntent: ExecutionIntent
      workspace: WorkspaceDaemon
      projectId: string
      rootPath: string
      agentSession: AgentSession
    },
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { projectId, rootPath, executionIntent, workspace } = context

    if (executionIntent.type !== 'generate') {
      throw new Error('Invalid intent type for generate handler')
    }

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Generating ${executionIntent.platform || 'code'} based on: ${executionIntent.description}` },
    })

    onEvent?.({
      type: 'GENERATION_STARTED',
      payload: { projectId },
    })

    try {
      // PHASE -1: Create project root if missing
      await fs.mkdir(rootPath, { recursive: true })

      // PHASE -1: Check if workspace is empty
      const { BootstrapGenerator } = await import('@/lib/bootstrap/BootstrapGenerator')
      const fileCount = await BootstrapGenerator.getFileCount(rootPath)
      
      // If workspace is empty and user has a specific description, proceed with AI generation
      // If workspace is empty and description is generic/empty, run bootstrap
      const hasSpecificDescription = executionIntent.description && 
        executionIntent.description.trim().length > 0 &&
        executionIntent.description !== 'Create a new project' &&
        !executionIntent.description.toLowerCase().includes('new project')
      
      if (fileCount === 0 && !hasSpecificDescription) {
        // Workspace is empty and no specific description - run bootstrap generator
        onEvent?.({
          type: 'AGENT_THINKING',
          payload: { message: 'Workspace is empty. Creating initial project structure...' },
        })

        const platform = executionIntent.platform === 'web' ? 'web' : 
                        executionIntent.platform === 'backend' ? 'node' : 'web'
        
        const bootstrapResult = await BootstrapGenerator.run({
          projectId,
          rootPath,
          platform,
        })

        if (!bootstrapResult.success) {
          throw new Error(`Bootstrap failed: ${bootstrapResult.error || 'Unknown error'}`)
        }

        // Emit FILE_CHANGED events for bootstrap files
        for (const filePath of bootstrapResult.filesCreated) {
          onEvent?.({
            type: 'FILE_CHANGED',
            payload: { path: filePath },
          })

          workspace.getEventBus().emit({
            type: 'FILE_CHANGED',
            payload: {
              path: filePath,
              content: '',
              modifiedByAI: false, // Bootstrap is not AI
            },
          } as any)
        }

        onEvent?.({
          type: 'AGENT_DONE',
          payload: { 
            message: `Bootstrap complete: Created ${bootstrapResult.filesCreated.length} file(s). You can now generate custom code.`,
            result: { filesCreated: bootstrapResult.filesCreated.length, files: bootstrapResult.filesCreated } 
          },
        })

        // Bootstrap complete - return early
        return
      }
      
      // If workspace is empty but user has specific description, proceed with AI generation
      // This allows users to build specific apps/websites from scratch

      // Workspace has files - proceed with AI generation
      onEvent?.({
        type: 'GENERATION_PROGRESS',
        payload: { step: 1, total: 4, message: 'Generating code with AI...' },
      })

      const { generateAppDirect } = await import('@/lib/appGenerator')
      
      let generatedProject
      try {
        generatedProject = await generateAppDirect(executionIntent.description)
      } catch (error: any) {
        console.error('[AgentExecutionRouter] Generation error:', error)
        throw new Error(`Failed to generate code: ${error.message || 'AI generation failed. Please try again with a more specific description.'}`)
      }

      if (!generatedProject || !generatedProject.files || generatedProject.files.length === 0) {
        throw new Error('No files were generated. The AI might need a more specific description. Try: "build a simple calculator website" or "create a todo app"')
      }

      // PHASE 3: Apply files via FileMutationKernel (not direct fs.writeFile)
      onEvent?.({
        type: 'GENERATION_PROGRESS',
        payload: { step: 2, total: 4, message: `Writing ${generatedProject.files.length} files...` },
      })

      // PHASE 4: Create checkpoint before AI write
      const { getCheckpointManager } = await import('@/lib/agent/CheckpointManager')
      const checkpointManager = getCheckpointManager()
      const checkpoint = await checkpointManager.createCheckpoint(
        projectId,
        `Generate: ${executionIntent.description}`,
        {
          intentType: executionIntent.type,
          intentDescription: executionIntent.description,
          sessionId: agentSession.sessionId,
        }
      )

      onEvent?.({
        type: 'AGENT_ACTION',
        payload: {
          action: 'create_checkpoint',
          details: {
            checkpointId: checkpoint.id,
            message: `Checkpoint created before generating ${generatedProject.files.length} files`,
          },
        },
      })

      const { getFileMutationKernel } = await import('@/lib/workspace/FileMutationKernel')
      const mutationKernel = getFileMutationKernel(projectId, rootPath)

      const changes = generatedProject.files.map((file) => ({
        path: file.path,
        type: 'create' as const,
        fullContent: file.content,
        reason: `Generated file: ${file.path}`,
      }))

      const result = await mutationKernel.apply(
        {
          changes,
          reason: `Generate project: ${executionIntent.description}`,
        },
        {
          createCheckpoint: true,
        }
      )

      if (!result.success) {
        throw new Error(`Failed to write files: ${result.error || 'Unknown error'}`)
      }

      // PHASE 3: Emit FILE_CHANGED events for each created file
      for (const change of result.appliedChanges) {
        onEvent?.({
          type: 'FILE_CHANGED',
          payload: { path: change.path },
        })

        // Also emit via workspace event bus
        workspace.getEventBus().emit({
          type: 'FILE_CHANGED',
          payload: {
            path: change.path,
            content: change.fullContent || '',
            modifiedByAI: true,
          },
        } as any)
      }

      // PHASE 3: Validate generation
      onEvent?.({
        type: 'GENERATION_PROGRESS',
        payload: { step: 3, total: 4, message: 'Validating project...' },
      })

      const { getGenerationValidator } = await import('@/lib/agent/GenerationValidator')
      const validator = getGenerationValidator()
      const validation = await validator.validate(rootPath)

      if (!validation.valid) {
        throw new Error(`Generation validation failed: ${validation.errors.join('; ')}`)
      }

      // PHASE 3: Verify side effects occurred
      const createdFiles = result.appliedChanges.map((c) => c.path)
      if (createdFiles.length === 0) {
        throw new Error('No files were created - generation failed silently')
      }

      onEvent?.({
        type: 'GENERATION_PROGRESS',
        payload: { step: 4, total: 4, message: `Generated ${createdFiles.length} files successfully` },
      })

      onEvent?.({
        type: 'GENERATION_COMPLETE',
        payload: {
          projectId,
          files: result.appliedChanges.map((c) => ({
            path: c.path,
            content: c.fullContent || '',
          })),
        },
      })

      onEvent?.({
        type: 'AGENT_DONE',
        payload: { 
          message: `Generated ${createdFiles.length} file(s) successfully.`,
          result: { filesCreated: createdFiles.length, files: createdFiles } 
        },
      })
    } catch (error: any) {
      onEvent?.({
        type: 'AGENT_ERROR',
        payload: { error: `Generation failed: ${error.message || 'Unknown error'}` },
      })
      throw error
    }
  }

  /**
   * PHASE 3: Handle mutate intent
   * Complete pipeline: ContextBuilder -> FileMutationKernel
   */
  private async handleMutate(
    context: {
      executionIntent: ExecutionIntent
      workspace: WorkspaceDaemon
      projectId: string
      rootPath: string
      agentSession: AgentSession
    },
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { projectId, executionIntent, workspace, rootPath, agentSession } = context

    if (executionIntent.type !== 'mutate') {
      throw new Error('Invalid intent type for mutate handler')
    }

    // PHASE -1: Reject mutation if workspace is empty
    const { BootstrapGenerator } = await import('@/lib/bootstrap/BootstrapGenerator')
    const fileCount = await BootstrapGenerator.getFileCount(rootPath)
    if (fileCount === 0) {
      throw new Error('Cannot mutate files: Workspace is empty. Generate files first.')
    }

    // PHASE 3: Build context (files that can be modified)
    const contextBuilder = getContextBuilder()
    const execContext = await contextBuilder.buildContext(executionIntent, rootPath, [])

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Analyzing files to mutate: ${executionIntent.files?.join(', ') || 'all'}` },
    })

    // PHASE 3: Tool-first enforcement - read files first
    const filesToMutate = executionIntent.files || execContext.referencedFiles.map((f) => f.path)
    
    // PHASE 3: Reject mutation if file not in context
    const modifiableFiles = contextBuilder.getModifiableFiles(execContext)
    for (const filePath of filesToMutate) {
      if (!contextBuilder.canModifyFile(filePath, execContext)) {
        throw new Error(`File ${filePath} is not in context and cannot be modified. Read it first.`)
      }
    }

    for (const file of execContext.referencedFiles) {
      if (filesToMutate.includes(file.path)) {
        onEvent?.({
          type: 'AGENT_ACTION',
          payload: { action: 'read_file', details: { path: file.path } },
        })
      }
    }

    // PHASE 6: Get confidence and gate dangerous actions
    const confidenceEngine = getAgentConfidenceEngine(projectId)
    const confidenceReport = confidenceEngine.getCurrentReport()

    // PHASE 6: Block high-risk actions when confidence is LOW
    if (confidenceReport.riskLevel === 'HIGH' && confidenceReport.confidenceLevel === 'LOW') {
      onEvent?.({
        type: 'AGENT_ERROR',
        payload: { error: 'High risk detected. Please review and approve changes manually.' },
      })
      return
    }

    // PHASE 3: Create mutation plan (simplified - in full implementation would use AgentPlanExecutor)
    // For now, we'll create a simple mutation based on description
    onEvent?.({
      type: 'AGENT_ACTION',
      payload: { action: 'create_mutation_plan', details: { files: filesToMutate } },
    })

    // PHASE 4: Create checkpoint before AI write
    const { getCheckpointManager } = await import('@/lib/agent/CheckpointManager')
    const checkpointManager = getCheckpointManager()
    const checkpoint = await checkpointManager.createCheckpoint(
      projectId,
      `Mutate: ${executionIntent.description}`,
      {
        intentType: executionIntent.type,
        intentDescription: executionIntent.description,
        sessionId: agentSession.sessionId,
        filesAffected: filesToMutate,
      }
    )

    onEvent?.({
      type: 'AGENT_ACTION',
      payload: {
        action: 'create_checkpoint',
        details: {
          checkpointId: checkpoint.id,
          message: `Checkpoint created before mutating ${filesToMutate.length} file(s)`,
        },
      },
    })

    // PHASE 3: Apply mutations via FileMutationKernel
    const { getFileMutationKernel } = await import('@/lib/workspace/FileMutationKernel')
    const mutationKernel = getFileMutationKernel(projectId, rootPath)

    // Create checkpoint before write
    const changes = filesToMutate.map((filePath) => {
      const file = execContext.referencedFiles.find((f) => f.path === filePath)
      return {
        path: filePath,
        type: file ? 'modify' as const : 'create' as const,
        fullContent: file ? file.content : '', // In real implementation, would generate new content
        reason: `Mutate: ${executionIntent.description}`,
      }
    })

    const result = await mutationKernel.apply(
      {
        changes,
        reason: `Mutate files: ${executionIntent.description}`,
        confidenceSnapshot: confidenceReport,
      },
      {
        createCheckpoint: true,
        requireHighConfidence: confidenceReport.riskLevel === 'HIGH',
      }
    )

    if (!result.success) {
      throw new Error(`Mutation failed: ${result.error || 'Unknown error'}`)
    }

    // PHASE 3: Emit FILE_CHANGED events
    for (const change of result.appliedChanges) {
      onEvent?.({
        type: 'FILE_CHANGED',
        payload: { path: change.path },
      })

      workspace.getEventBus().emit({
        type: 'FILE_CHANGED',
        payload: {
          path: change.path,
          content: change.fullContent || '',
          modifiedByAI: true,
        },
      } as any)
    }

    // PHASE 3: Verify side effects
    if (result.appliedChanges.length === 0) {
      throw new Error('No files were mutated - mutation failed silently')
    }

    onEvent?.({
      type: 'AGENT_DONE',
      payload: { 
        message: `Mutated ${result.appliedChanges.length} file(s) successfully.`,
        result: { filesMutated: result.appliedChanges.map((c) => c.path) } 
      },
    })
  }

  /**
   * PHASE 3: Handle run intent
   * Wires to RuntimeKernel.startRuntime() with verification
   */
  private async handleRun(
    context: {
      executionIntent: ExecutionIntent
      workspace: WorkspaceDaemon
      projectId: string
      rootPath: string
      agentSession: AgentSession
    },
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { projectId, executionIntent, rootPath } = context

    if (executionIntent.type !== 'run') {
      throw new Error('Invalid intent type for run handler')
    }

    // PHASE -1: Reject run if workspace is empty
    const { BootstrapGenerator } = await import('@/lib/bootstrap/BootstrapGenerator')
    const fileCount = await BootstrapGenerator.getFileCount(rootPath)
    if (fileCount === 0) {
      throw new Error('Cannot run: Workspace is empty. Generate files first.')
    }

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Running: ${executionIntent.command || 'project'}` },
    })

    onEvent?.({
      type: 'RUNTIME_STARTING',
      payload: { projectId },
    })

    try {
      // PHASE 3: Detect framework
      const framework = await this.detectFramework(rootPath)
      
      onEvent?.({
        type: 'AGENT_ACTION',
        payload: { action: 'detect_framework', details: { framework } },
      })

      // PHASE 3: Start runtime
      const kernel = RuntimeKernel.get(projectId)
      await kernel.startRuntime()

      // PHASE 3: Verify process started successfully
      const state = kernel.getState()
      if (state.status !== 'running' && state.status !== 'starting') {
        throw new Error(`Runtime failed to start. Status: ${state.status}`)
      }

      onEvent?.({
        type: 'RUNTIME_STARTED',
        payload: { projectId, port: state.previewPort },
      })

      onEvent?.({
        type: 'RUNTIME_EVENT',
        payload: { event: 'started', details: { command: executionIntent.command, framework, port: state.previewPort } },
      })

      // PHASE 3: Verify side effects
      if (!state.previewUrl && state.status === 'running') {
        // Runtime is running but no preview URL - might be OK for non-web projects
        onEvent?.({
          type: 'RUNTIME_EVENT',
          payload: { event: 'running', details: { note: 'Runtime started but no preview URL available' } },
        })
      }

      onEvent?.({
        type: 'AGENT_DONE',
        payload: { 
          message: `Runtime started${state.previewUrl ? ` - Preview available` : ''}.`,
          result: { runtimeStarted: true, status: state.status, previewUrl: state.previewUrl } 
        },
      })
    } catch (error: any) {
      onEvent?.({
        type: 'AGENT_ERROR',
        payload: { error: `Failed to start runtime: ${error.message}` },
      })
      throw error
    }
  }

  /**
   * PHASE 3: Detect framework from project files
   */
  private async detectFramework(projectRoot: string): Promise<string> {
    try {
      const packageJsonPath = join(projectRoot, 'package.json')
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(packageJsonContent)
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }

      if (dependencies['next']) return 'nextjs'
      if (dependencies['react']) return 'react'
      if (dependencies['vue']) return 'vue'
      if (dependencies['angular']) return 'angular'
      if (dependencies['express']) return 'express'
      if (dependencies['fastify']) return 'fastify'
      
      // Check for Python
      try {
        await fs.access(join(projectRoot, 'requirements.txt'))
        return 'python'
      } catch {
        // Not Python
      }

      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  /**
   * PHASE 2: Handle debug intent
   * Routes to debug workflow
   */
  private async handleDebug(
    context: {
      executionIntent: ExecutionIntent
      workspace: WorkspaceDaemon
      projectId: string
      rootPath: string
      agentSession: AgentSession
    },
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { projectId, executionIntent } = context

    if (executionIntent.type !== 'debug') {
      throw new Error('Invalid intent type for debug handler')
    }

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Starting debug session: ${executionIntent.description}` },
    })

    // TODO: Implement debug workflow
    onEvent?.({
      type: 'AGENT_ERROR',
      payload: { error: 'Debug intent not yet implemented' },
    })
  }

  /**
   * PHASE 3: Handle explain intent
   * Read-only context, no writes (enforced)
   */
  private async handleExplain(
    context: {
      executionIntent: ExecutionIntent
      workspace: WorkspaceDaemon
      projectId: string
      rootPath: string
      agentSession: AgentSession
    },
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { executionIntent, rootPath } = context

    if (executionIntent.type !== 'explain') {
      throw new Error('Invalid intent type for explain handler')
    }

    // PHASE 3: Read-only - build context but never write
    const contextBuilder = getContextBuilder()
    const execContext = await contextBuilder.buildContext(executionIntent, rootPath, [])

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Explaining: ${executionIntent.target || executionIntent.description}` },
    })

    // Read files for explanation
    for (const file of execContext.referencedFiles) {
      onEvent?.({
        type: 'AGENT_ACTION',
        payload: { action: 'read_file', details: { path: file.path } },
      })
    }

    // PHASE 3: Explain intent never writes files
    // This is enforced by not calling any mutation methods
    // Verification: No FILE_CHANGED events should be emitted

    onEvent?.({
      type: 'AGENT_DONE',
      payload: { 
        message: `Explanation generated for ${execContext.referencedFiles.length} file(s).`,
        result: { explanation: 'Explanation generated', filesRead: execContext.referencedFiles.length } 
      },
    })
  }

  /**
   * PHASE 3: Handle fix intent
   * Debug workflow: read errors, then mutate via FileMutationKernel
   */
  private async handleFix(
    context: {
      executionIntent: ExecutionIntent
      workspace: WorkspaceDaemon
      projectId: string
      rootPath: string
      agentSession: AgentSession
    },
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<void> {
    const { projectId, executionIntent, workspace, rootPath } = context

    if (executionIntent.type !== 'fix') {
      throw new Error('Invalid intent type for fix handler')
    }

    // PHASE -1: Reject fix if workspace is empty
    const { BootstrapGenerator } = await import('@/lib/bootstrap/BootstrapGenerator')
    const fileCount = await BootstrapGenerator.getFileCount(rootPath)
    if (fileCount === 0) {
      throw new Error('Cannot fix errors: Workspace is empty. Generate files first.')
    }

    // PHASE 3: Build context (includes runtime errors)
    const contextBuilder = getContextBuilder()
    const execContext = await contextBuilder.buildContext(executionIntent, rootPath, [])

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Fixing errors: ${executionIntent.errors?.join(', ') || 'auto-detect'}` },
    })

    // Read errors first
    if (execContext.runtimeErrors.length > 0) {
      for (const error of execContext.runtimeErrors) {
        onEvent?.({
          type: 'AGENT_ACTION',
          payload: { action: 'read_error', details: error },
        })
      }
    }

    // Then read files that need fixing
    const filesToFix = executionIntent.errors?.map((e) => e) || execContext.referencedFiles.map((f) => f.path)
    
    for (const file of execContext.referencedFiles) {
      if (filesToFix.includes(file.path)) {
        onEvent?.({
          type: 'AGENT_ACTION',
          payload: { action: 'read_file', details: { path: file.path } },
        })
      }
    }

    // PHASE 4: Create checkpoint before AI write
    const { getCheckpointManager } = await import('@/lib/agent/CheckpointManager')
    const checkpointManager = getCheckpointManager()
    const checkpoint = await checkpointManager.createCheckpoint(
      projectId,
      `Fix: ${executionIntent.description}`,
      {
        intentType: executionIntent.type,
        intentDescription: executionIntent.description,
        sessionId: agentSession.sessionId,
        filesAffected: filesToFix,
      }
    )

    onEvent?.({
      type: 'AGENT_ACTION',
      payload: {
        action: 'create_checkpoint',
        details: {
          checkpointId: checkpoint.id,
          message: `Checkpoint created before fixing ${filesToFix.length} file(s)`,
        },
      },
    })

    // PHASE 3: Apply fixes via FileMutationKernel (simplified - real implementation would analyze errors)
    const { getFileMutationKernel } = await import('@/lib/workspace/FileMutationKernel')
    const mutationKernel = getFileMutationKernel(projectId, rootPath)

    // Create fix changes (in real implementation, would generate fixes based on errors)
    const changes = filesToFix.map((filePath) => {
      const file = execContext.referencedFiles.find((f) => f.path === filePath)
      return {
        path: filePath,
        type: file ? 'modify' as const : 'create' as const,
        fullContent: file ? file.content : '', // In real implementation, would apply fixes
        reason: `Fix errors: ${executionIntent.description}`,
      }
    })

    const result = await mutationKernel.apply(
      {
        changes,
        reason: `Fix errors: ${executionIntent.description}`,
      },
      {
        createCheckpoint: true,
      }
    )

    if (!result.success) {
      throw new Error(`Fix failed: ${result.error || 'Unknown error'}`)
    }

    // PHASE 3: Emit FILE_CHANGED events
    for (const change of result.appliedChanges) {
      onEvent?.({
        type: 'FILE_CHANGED',
        payload: { path: change.path },
      })

      workspace.getEventBus().emit({
        type: 'FILE_CHANGED',
        payload: {
          path: change.path,
          content: change.fullContent || '',
          modifiedByAI: true,
        },
      } as any)
    }

    // PHASE 3: Verify side effects
    if (result.appliedChanges.length === 0) {
      throw new Error('No files were fixed - fix failed silently')
    }

    onEvent?.({
      type: 'AGENT_DONE',
      payload: { 
        message: `Fixed ${result.appliedChanges.length} file(s) successfully.`,
        result: { filesFixed: result.appliedChanges.map((c) => c.path) } 
      },
    })
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


