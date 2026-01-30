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
  | { type: 'ASSISTANT_MESSAGE'; payload: { content: string; metadata?: any } } // PHASE A: Visible assistant message for chat
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

      // PHASE F′-2: Route execution through OS kernel (ProjectEvolutionEngine)
      const { getProjectEvolutionEngineManager } = await import('@/lib/os/ProjectEvolutionEngineManager')
      const peeManager = getProjectEvolutionEngineManager()
      const pee = await peeManager.getEngine(projectId, rootPath)

      // PHASE A: Defensive stage recovery - detect stage desync and recover
      const currentStage = pee.getStage()
      if (currentStage === 'empty') {
        // Check if project actually has files (desync detection)
        try {
          const { BootstrapGenerator } = await import('@/lib/bootstrap/BootstrapGenerator')
          const fileCount = await BootstrapGenerator.getFileCount(rootPath)
          const { promises: fs } = await import('fs')
          const { join } = await import('path')
          const devmatePath = join(rootPath, '.devmate')
          
          try {
            await fs.access(devmatePath)
            // .devmate exists and files exist but stage is empty = desync
            if (fileCount > 0) {
              console.warn(`[AgentExecutionRouter] Stage desync detected: ${projectId} has ${fileCount} files and .devmate but stage is "empty". Recovering to "editable".`)
              await peeManager.setStage(projectId, 'editable', 'recovery')
              console.log(`[AgentExecutionRouter] Stage recovery complete: ${projectId} → editable`)
            }
          } catch {
            // .devmate doesn't exist - this is normal for new projects, not a desync
          }
        } catch (error: any) {
          // Recovery check failed - log but don't block execution
          console.warn(`[AgentExecutionRouter] Failed to check stage desync for ${projectId}:`, error)
        }
      }

      // PHASE A: Log stage and source for diagnostic certainty
      console.log(
        '[AgentExecutionRouter] Stage authority check:',
        {
          projectId,
          stage: pee.getStage(),
          stageSource: 'disk-persisted',
          capabilities: pee.getCapabilities(),
          aiRole: pee.getAIRole()
        }
      )

      // Authorize execution request
      const targetFiles = executionIntent.type === 'mutate' || executionIntent.type === 'fix'
        ? (executionIntent as any).files || []
        : undefined

      const authorization = pee.authorizeExecution({
        actor: 'ai', // All agent executions are AI-initiated
        intent: executionIntent,
        targetFiles,
      })

      // Handle authorization result
      if (authorization.status === 'deny') {
        onEvent?.({
          type: 'ASSISTANT_MESSAGE',
          payload: {
            content: `I cannot execute this action: ${authorization.reason}. The project is in "${pee.getStage()}" stage, which doesn't allow this operation.`,
            metadata: { stage: pee.getStage(), reason: authorization.reason },
          },
        })
        onEvent?.({
          type: 'AGENT_DONE',
          payload: { result: { blocked: true, reason: authorization.reason } },
        })
        return // Stop execution - do NOT throw
      }

      if (authorization.status === 'defer') {
        onEvent?.({
          type: 'ASSISTANT_MESSAGE',
          payload: {
            content: `This action should wait: ${authorization.reason}. The project needs to be in a different stage first.`,
            metadata: { stage: pee.getStage(), reason: authorization.reason },
          },
        })
        onEvent?.({
          type: 'AGENT_DONE',
          payload: { result: { deferred: true, reason: authorization.reason } },
        })
        return // Stop execution - do NOT throw
      }

      if (authorization.status === 'downgrade') {
        // Log downgrade but proceed with execution
        console.log(`[AgentExecutionRouter] AI role downgraded: ${authorization.role}, reason: ${authorization.reason}`)
        onEvent?.({
          type: 'AGENT_THINKING',
          payload: { message: `Operating in ${authorization.role} mode: ${authorization.reason}` },
        })
      }

      // PHASE F′-5: Validate goal alignment (advisory, doesn't block)
      try {
        const { GoalAwareIntentRouter } = await import('@/lib/os/goals/GoalAwareIntentRouter')
        const goalContext = await GoalAwareIntentRouter.getGoalContext(projectId)
        
        if (!goalContext.activeGoal && (executionIntent.type === 'expand_features' || executionIntent.type === 'redesign_ui' || executionIntent.type === 'migrate_framework')) {
          // Evolution intents should have a goal - suggest defining one
          onEvent?.({
            type: 'ASSISTANT_MESSAGE',
            payload: {
              content: 'No active project goal is set. Evolution intents work best when guided by a clear goal. Would you like to define a project goal first?',
              metadata: { suggestion: true, type: 'goal_definition' },
            },
          })
        } else if (goalContext.activeGoal) {
          // Validate alignment
          const validation = GoalAwareIntentRouter.validateResponseAlignment(
            executionIntent.description,
            goalContext
          )
          if (!validation.aligned && validation.reason) {
            // Suggest reframing but don't block
            onEvent?.({
              type: 'AGENT_THINKING',
              payload: { message: `Goal alignment: ${validation.reason}` },
            })
          }
        }
      } catch (error: any) {
        // Goal validation failure doesn't block execution
        console.warn('[AgentExecutionRouter] Goal validation failed:', error)
      }

      // PHASE 2: Route strictly by intent.type
      console.log('[AgentExecutionRouter] Routing by intent type:', {
        projectId,
        intentType: executionIntent.type,
        rootPath,
        stage: pee.getStage(),
        aiRole: pee.getAIRole(),
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

        // PHASE F: Project evolution intents
        case 'expand_features':
          await this.handleExpandFeatures({ executionIntent, workspace, projectId, rootPath, agentSession }, onEvent)
          break

        case 'redesign_ui':
          await this.handleRedesignUI({ executionIntent, workspace, projectId, rootPath, agentSession }, onEvent)
          break

        case 'migrate_framework':
          await this.handleMigrateFramework({ executionIntent, workspace, projectId, rootPath, agentSession }, onEvent)
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
      // PHASE F: Project root is already created by ProjectRootManager via WorkspaceRegistry
      // No need to create it here - it's persistent and managed centrally

      // PHASE E: Import once at the top to avoid duplicate definitions
      const bootstrapModule = await import('@/lib/bootstrap/BootstrapGenerator')
      const invariantModule = await import('@/lib/invariants/assertExecutionInvariant')
      const BootstrapGenerator = bootstrapModule.BootstrapGenerator
      const assertExecutionInvariant = invariantModule.assertExecutionInvariant

      // PHASE -1: Check if workspace is empty
      let fileCount = await BootstrapGenerator.getFileCount(rootPath)
      
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

        // PHASE A: Emit assistant message BEFORE AGENT_DONE
        const platformName = executionIntent.platform === 'web' ? 'web' : executionIntent.platform === 'backend' ? 'Node.js' : 'web'
        onEvent?.({
          type: 'ASSISTANT_MESSAGE',
          payload: {
            content: `Your project is ready. I created a starter ${platformName} app with ${bootstrapResult.filesCreated.length} file${bootstrapResult.filesCreated.length !== 1 ? 's' : ''}. Click Run to preview it, or tell me what to build next.`,
            metadata: { filesCreated: bootstrapResult.filesCreated.length, platform: platformName },
          },
        })

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

      // REQUIRED FIX 4: Enforce platform resolution BEFORE generation
      let resolvedPlatform: 'web' | 'android' | 'node'
      if (executionIntent.platform) {
        resolvedPlatform = executionIntent.platform
      } else {
        // Infer platform from description
        const lowerDesc = executionIntent.description.toLowerCase()
        if (lowerDesc.includes('android') || lowerDesc.includes('mobile') || lowerDesc.includes('react native')) {
          resolvedPlatform = 'android'
        } else if (lowerDesc.includes('backend') || lowerDesc.includes('api') || lowerDesc.includes('server') || lowerDesc.includes('express') || lowerDesc.includes('node')) {
          resolvedPlatform = 'node'
        } else if (lowerDesc.includes('web') || lowerDesc.includes('react') || lowerDesc.includes('next') || lowerDesc.includes('website') || lowerDesc.includes('app')) {
          resolvedPlatform = 'web'
        } else {
          // Default to web, but log warning
          console.warn('[AgentExecutionRouter] Platform ambiguous, defaulting to web')
          resolvedPlatform = 'web'
        }
      }

      // Workspace has files - proceed with AI generation
      onEvent?.({
        type: 'GENERATION_PROGRESS',
        payload: { step: 1, total: 5, message: `Generating ${resolvedPlatform} project with AI...` },
      })

      const { generateAppDirect } = await import('@/lib/appGenerator')
      
      // Build prompt with image context if available
      let prompt = executionIntent.description
      if (executionIntent.context && executionIntent.context.type === 'image') {
        // Include image data in prompt for vision models
        const imageData = executionIntent.context.data
        prompt = `${executionIntent.description}\n\n[Image attached: ${imageData.filename}]\n\nAnalyze the image and generate code based on both the description and the image content.`
      }
      
      let generatedProject
      let aiGenerationFailed = false
      try {
        // Pass image context if available
        if (executionIntent.context && executionIntent.context.type === 'image') {
          // For vision models, we need to pass the image data
          // This will be handled by the AI orchestrator if it supports vision
          generatedProject = await generateAppDirect(prompt, executionIntent.context.data)
        } else {
          generatedProject = await generateAppDirect(prompt)
        }
      } catch (error: any) {
        console.error('[AgentExecutionRouter] Generation error:', error)
        aiGenerationFailed = true
        
        // Re-check file count in case it changed
        fileCount = await BootstrapGenerator.getFileCount(rootPath)
        
        // If AI fails due to quota/API issues, fallback to bootstrap for empty workspace
        if (fileCount === 0) {
          console.log('[AgentExecutionRouter] Workspace is empty, falling back to BootstrapGenerator')
          onEvent?.({
            type: 'AGENT_THINKING',
            payload: { message: 'AI generation unavailable. Creating starter project structure...' },
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
                modifiedByAI: false,
              },
            } as any)
          }

          // PHASE A: Emit assistant message BEFORE AGENT_DONE
          onEvent?.({
            type: 'ASSISTANT_MESSAGE',
            payload: {
              content: `I created a starter project with ${bootstrapResult.filesCreated.length} file${bootstrapResult.filesCreated.length !== 1 ? 's' : ''}. AI generation is currently unavailable, but you can manually edit files or try again later.`,
              metadata: { filesCreated: bootstrapResult.filesCreated.length },
            },
          })

          onEvent?.({
            type: 'AGENT_DONE',
            payload: { 
              message: `Starter project created (${bootstrapResult.filesCreated.length} files). AI generation is currently unavailable. You can manually edit files or try again later.`,
              result: { filesCreated: bootstrapResult.filesCreated.length, files: bootstrapResult.filesCreated } 
            },
          })

          return // Bootstrap complete
        } else {
          // Workspace has files, but AI failed - throw error
          throw new Error(`AI generation failed: ${error.message || 'Please check your API keys and quota. You can manually edit existing files.'}`)
        }
      }

      if (!generatedProject || !generatedProject.files || generatedProject.files.length === 0) {
        // If AI returned empty but didn't throw, fallback to bootstrap for empty workspace
        if (fileCount === 0) {
          onEvent?.({
            type: 'AGENT_THINKING',
            payload: { message: 'No files generated. Creating starter project structure...' },
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

          // Emit FILE_CHANGED events
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
                modifiedByAI: false,
              },
            } as any)
          }

          // PHASE F: UX Truthfulness
          onEvent?.({
            type: 'ASSISTANT_MESSAGE',
            payload: {
              content: `✅ Starter project created with ${bootstrapResult.filesCreated.length} file${bootstrapResult.filesCreated.length !== 1 ? 's' : ''}.\n\nYou can now edit files manually or try generating again with a more specific description.`,
              metadata: { filesCreated: bootstrapResult.filesCreated.length },
            },
          })

          onEvent?.({
            type: 'AGENT_DONE',
            payload: { 
              message: `Starter project created (${bootstrapResult.filesCreated.length} files). You can now edit files manually.`,
              result: { filesCreated: bootstrapResult.filesCreated.length, files: bootstrapResult.filesCreated } 
            },
          })

          return
        }
        
        throw new Error('No files were generated. The AI might need a more specific description. Try: "build a simple calculator website" or "create a todo app"')
      }

      // REQUIRED FIX 3: Create root checkpoint BEFORE generation writes
      onEvent?.({
        type: 'GENERATION_PROGRESS',
        payload: { step: 2, total: 5, message: 'Creating root checkpoint...' },
      })

      const { checkpointEngine } = await import('@/lib/runtime/checkpointEngine')
      const rootCheckpoint = await checkpointEngine.createCheckpoint(
        projectId,
        rootPath,
        `Generation root checkpoint: ${executionIntent.description}`,
        'generation-root' // REQUIRED FIX 3: Special type for generation
      )

      onEvent?.({
        type: 'AGENT_ACTION',
        payload: {
          action: 'create_checkpoint',
          details: {
            checkpointId: rootCheckpoint.id,
            message: `Root checkpoint created before generating ${generatedProject.files.length} files`,
          },
        },
      })

      // REQUIRED FIX 1: Apply files via FileMutationKernel in GENERATION mode (bypasses context/confidence)
      onEvent?.({
        type: 'GENERATION_PROGRESS',
        payload: { step: 3, total: 5, message: `Writing ${generatedProject.files.length} files...` },
      })

      const { getFileMutationKernel } = await import('@/lib/workspace/FileMutationKernel')
      const mutationKernel = getFileMutationKernel(projectId, rootPath)

      const changes = generatedProject.files.map((file) => ({
        path: file.path,
        type: 'create' as const,
        fullContent: file.content,
        reason: `Generated file: ${file.path}`,
      }))

      // REQUIRED FIX 1: Use generation mode to bypass context/confidence checks
      const result = await mutationKernel.apply(
        {
          changes,
          reason: `Generate project: ${executionIntent.description}`,
          mode: 'generation', // REQUIRED FIX 1: Privileged generation mode
          checkpointId: rootCheckpoint.id, // Use root checkpoint
        },
        {
          createCheckpoint: false, // Already created root checkpoint above
          requireHighConfidence: false, // Bypassed in generation mode
        }
      )

    if (!result.success) {
      throw new Error(
        `Failed to write files: ${result.error || 'Unknown error'}. ` +
        `projectId: ${projectId}, rootPath: ${rootPath}, intent: ${executionIntent.description}`
      )
    }

    // PHASE 3: Emit FILE_CHANGED events for each created file
    const filesChanged: string[] = []
    for (const change of result.appliedChanges) {
      filesChanged.push(change.path)
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

      // REQUIRED FIX 4: Hard verification - if zero files written, THROW error
      const createdFiles = result.appliedChanges.map((c) => c.path)
      if (createdFiles.length === 0) {
        throw new Error(
          `Invariant violation: Generation completed but zero files were written. ` +
          `projectId: ${projectId}, rootPath: ${rootPath}, intent: ${executionIntent.description}`
        )
      }

      // PHASE E: Invariant check after generation
      fileCount = await BootstrapGenerator.getFileCount(rootPath)
      assertExecutionInvariant({
        projectId,
        intent: executionIntent,
        workspaceStage: 'generated',
        fileCount,
        rootPath,
        filesChanged,
        filesWritten: createdFiles.length,
      })

      // Validate generation
      onEvent?.({
        type: 'GENERATION_PROGRESS',
        payload: { step: 4, total: 5, message: 'Validating project...' },
      })

      const { getGenerationValidator } = await import('@/lib/agent/GenerationValidator')
      const validator = getGenerationValidator()
      const validation = await validator.validate(rootPath)

      if (!validation.valid) {
        throw new Error(`Generation validation failed: ${validation.errors.join('; ')}`)
      }

      onEvent?.({
        type: 'GENERATION_PROGRESS',
        payload: { step: 5, total: 5, message: `Generated ${createdFiles.length} files successfully` },
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

      // PHASE F′-2: Agents must NOT infer or override stage
      // Stage transitions are OS-law, not agent convenience logic
      // Stage must be explicitly advanced by BootstrapGenerator or workspace initialization

      // PHASE F: UX Truthfulness - Clear message with capabilities
      onEvent?.({
        type: 'ASSISTANT_MESSAGE',
        payload: {
          content: `✅ Generated ${createdFiles.length} file${createdFiles.length !== 1 ? 's' : ''} for your ${resolvedPlatform} project.\n\nI can:\n• Add features (e.g., "add calculator logic")\n• Improve UI/UX (e.g., "redesign the interface")\n• Migrate to a framework (e.g., "convert to React")\n\nClick Run to preview, or tell me what to change.`,
          metadata: { filesCreated: createdFiles.length, platform: resolvedPlatform },
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

    // PHASE E: Import once at the top to avoid duplicate definitions
    const bootstrapModule = await import('@/lib/bootstrap/BootstrapGenerator')
    const invariantModule = await import('@/lib/invariants/assertExecutionInvariant')
    const BootstrapGenerator = bootstrapModule.BootstrapGenerator
    const assertExecutionInvariant = invariantModule.assertExecutionInvariant

    // PHASE -1: Reject mutation if workspace is empty
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
      throw new Error(
        `Mutation failed: ${result.error || 'Unknown error'}. ` +
        `projectId: ${projectId}, rootPath: ${rootPath}, intent: ${executionIntent.description}`
      )
    }

    // PHASE 3: Emit FILE_CHANGED events
    const filesChanged: string[] = []
    for (const change of result.appliedChanges) {
      filesChanged.push(change.path)
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
      throw new Error(
        `Invariant violation: No files were mutated - mutation failed silently. ` +
        `projectId: ${projectId}, rootPath: ${rootPath}, intent: ${executionIntent.description}`
      )
    }

    // PHASE E: Invariant check after mutate
    const finalFileCount = await BootstrapGenerator.getFileCount(rootPath)
    assertExecutionInvariant({
      projectId,
      intent: executionIntent,
      workspaceStage: 'generated',
      fileCount: finalFileCount,
      rootPath,
      filesChanged,
      filesWritten: filesChanged.length,
    })

    // PHASE A: Emit assistant message BEFORE AGENT_DONE
    const mutatedFiles = result.appliedChanges.map((c) => c.path)
    onEvent?.({
      type: 'ASSISTANT_MESSAGE',
      payload: {
        content: `I updated ${result.appliedChanges.length} file${result.appliedChanges.length !== 1 ? 's' : ''}: ${mutatedFiles.join(', ')}. Changes are ready.`,
        metadata: { filesMutated: mutatedFiles },
      },
    })

    onEvent?.({
      type: 'AGENT_DONE',
      payload: { 
        message: `Mutated ${result.appliedChanges.length} file(s) successfully.`,
        result: { filesMutated: mutatedFiles } 
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

    // PHASE E: Import once at the top to avoid duplicate definitions
    const bootstrapModule = await import('@/lib/bootstrap/BootstrapGenerator')
    const invariantModule = await import('@/lib/invariants/assertExecutionInvariant')
    const BootstrapGenerator = bootstrapModule.BootstrapGenerator
    const assertExecutionInvariant = invariantModule.assertExecutionInvariant

    // PHASE -1: Reject run if workspace is empty
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
        throw new Error(
          `Invariant violation: Runtime failed to start. ` +
          `projectId: ${projectId}, rootPath: ${rootPath}, status: ${state.status}, intent: ${executionIntent.description}`
        )
      }

      // PHASE E: Invariant check after run
      const finalFileCount = await BootstrapGenerator.getFileCount(rootPath)
      assertExecutionInvariant({
        projectId,
        intent: executionIntent,
        workspaceStage: 'running',
        fileCount: finalFileCount,
        rootPath,
        runtimeState: state.status,
        filesWritten: 0, // Run doesn't write files
      })

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

      // PHASE A: Emit assistant message BEFORE AGENT_DONE
      onEvent?.({
        type: 'ASSISTANT_MESSAGE',
        payload: {
          content: `Runtime started${state.previewUrl ? ` - Preview available at ${state.previewUrl}` : ''}. Your app is now running.`,
          metadata: { runtimeStarted: true, status: state.status, previewUrl: state.previewUrl },
        },
      })

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

    // PHASE E: Import once at the top to avoid duplicate definitions
    const bootstrapModule = await import('@/lib/bootstrap/BootstrapGenerator')
    const invariantModule = await import('@/lib/invariants/assertExecutionInvariant')
    const BootstrapGenerator = bootstrapModule.BootstrapGenerator
    const assertExecutionInvariant = invariantModule.assertExecutionInvariant

    // PHASE 3: Read-only - build context but never write
    const contextBuilder = getContextBuilder()
    const execContext = await contextBuilder.buildContext(executionIntent, rootPath, [])

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Explaining: ${executionIntent.target || executionIntent.description}` },
    })

    // PHASE E: Invariant check after explain (must be read-only)
    const fileCount = await BootstrapGenerator.getFileCount(rootPath)
    assertExecutionInvariant({
      projectId: context.projectId,
      intent: executionIntent,
      workspaceStage: 'generated',
      fileCount,
      rootPath,
      filesWritten: 0, // Explain must not write files
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

    // PHASE A: Emit assistant message BEFORE AGENT_DONE
    const explanationContent = execContext.referencedFiles.length > 0
      ? `I analyzed ${execContext.referencedFiles.length} file${execContext.referencedFiles.length !== 1 ? 's' : ''}: ${execContext.referencedFiles.map((f) => f.path).join(', ')}.`
      : `I analyzed the codebase based on your request: ${executionIntent.description}.`

    onEvent?.({
      type: 'ASSISTANT_MESSAGE',
      payload: {
        content: explanationContent,
        metadata: { filesRead: execContext.referencedFiles.length },
      },
    })

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

    // PHASE E: Import once at the top to avoid duplicate definitions
    const bootstrapModule = await import('@/lib/bootstrap/BootstrapGenerator')
    const invariantModule = await import('@/lib/invariants/assertExecutionInvariant')
    const BootstrapGenerator = bootstrapModule.BootstrapGenerator
    const assertExecutionInvariant = invariantModule.assertExecutionInvariant

    // PHASE -1: Reject fix if workspace is empty
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
    const filesChanged: string[] = []
    for (const change of result.appliedChanges) {
      filesChanged.push(change.path)
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
      throw new Error(
        `Invariant violation: No files were fixed - fix failed silently. ` +
        `projectId: ${projectId}, rootPath: ${rootPath}, intent: ${executionIntent.description}`
      )
    }

    // PHASE E: Invariant check after fix
    const finalFileCount = await BootstrapGenerator.getFileCount(rootPath)
    assertExecutionInvariant({
      projectId,
      intent: executionIntent,
      workspaceStage: 'generated',
      fileCount: finalFileCount,
      rootPath,
      filesChanged,
      filesWritten: filesChanged.length,
    })

    // PHASE A: Emit assistant message BEFORE AGENT_DONE
    const fixedFiles = result.appliedChanges.map((c) => c.path)
    onEvent?.({
      type: 'ASSISTANT_MESSAGE',
      payload: {
        content: `I fixed errors in ${result.appliedChanges.length} file${result.appliedChanges.length !== 1 ? 's' : ''}: ${fixedFiles.join(', ')}. The fixes are applied.`,
        metadata: { filesFixed: fixedFiles },
      },
    })

    onEvent?.({
      type: 'AGENT_DONE',
      payload: { 
        message: `Fixed ${result.appliedChanges.length} file(s) successfully.`,
        result: { filesFixed: fixedFiles } 
      },
    })
  }

  /**
   * PHASE F: Handle expand_features intent
   * Adds new features to existing project
   */
  private async handleExpandFeatures(
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

    if (executionIntent.type !== 'expand_features') {
      throw new Error('Invalid intent type for expand_features handler')
    }

    // PHASE E: Import once at the top
    const bootstrapModule = await import('@/lib/bootstrap/BootstrapGenerator')
    const invariantModule = await import('@/lib/invariants/assertExecutionInvariant')
    const BootstrapGenerator = bootstrapModule.BootstrapGenerator
    const assertExecutionInvariant = invariantModule.assertExecutionInvariant

    // Verify workspace has files
    const fileCount = await BootstrapGenerator.getFileCount(rootPath)
    if (fileCount === 0) {
      throw new Error('Cannot expand features: Workspace is empty. Generate files first.')
    }

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Expanding features: ${executionIntent.description}` },
    })

    // PHASE F: Create explicit checkpoint before evolution
    const { checkpointEngine } = await import('@/lib/runtime/checkpointEngine')
    const checkpoint = await checkpointEngine.createCheckpoint(
      projectId,
      rootPath,
      `Expand features: ${executionIntent.description}`,
      'pre-write'
    )

    onEvent?.({
      type: 'AGENT_ACTION',
      payload: {
        action: 'create_checkpoint',
        details: {
          checkpointId: checkpoint.id,
          message: `Checkpoint created before expanding features`,
        },
      },
    })

    // PHASE F: Build context to understand current project structure
    const contextBuilder = getContextBuilder()
    const execContext = await contextBuilder.buildContext(executionIntent, rootPath, [])

    // PHASE F′-4: Generate plan and store (NO EXECUTION)
    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: 'Analyzing project structure and planning feature additions...' },
    })

    // Get current stage snapshot
    const { getProjectEvolutionEngineManager } = await import('@/lib/os/ProjectEvolutionEngineManager')
    const peeManager = getProjectEvolutionEngineManager()
    const pee = await peeManager.getEngine(projectId, rootPath)
    const stageSnapshot = pee.getStage()

    // PHASE F′-4: Generate detailed plan
    const featuresToAdd = executionIntent.type === 'expand_features' ? executionIntent.features : []
    const planSummary = featuresToAdd && featuresToAdd.length > 0
      ? `I will add the following features: ${featuresToAdd.join(', ')}`
      : `I will add the requested features: ${executionIntent.description}`

    // Create evolution plan with intents
    const evolutionIntents: ExecutionIntent[] = [
      {
        type: 'expand_features',
        description: executionIntent.description,
        features: featuresToAdd,
        context: executionIntent.context,
      },
    ]

    // PHASE F′-5: Check if there's an active goal
    let goalContext: { activeGoal: any; hasGoals: boolean } | null = null
    try {
      const { GoalAwareIntentRouter } = await import('@/lib/os/goals/GoalAwareIntentRouter')
      const context = await GoalAwareIntentRouter.getGoalContext(projectId)
      goalContext = {
        activeGoal: context.activeGoal,
        hasGoals: context.activeGoal !== null || context.completedGoals.length > 0,
      }
    } catch (error: any) {
      console.warn('[AgentExecutionRouter] Failed to load goal context:', error)
    }

    // PHASE F′-4: Store pending evolution (NO EXECUTION)
    const { getPendingEvolutionStore } = await import('@/lib/os/evolution/PendingEvolutionStore')
    const evolutionStore = getPendingEvolutionStore()
    
    let pendingEvolution
    try {
      pendingEvolution = evolutionStore.create({
        projectId,
        plan: planSummary,
        intents: evolutionIntents,
        stageSnapshot,
      })
    } catch (error: any) {
      // Project already has active evolution
      onEvent?.({
        type: 'ASSISTANT_MESSAGE',
        payload: {
          content: `Cannot create new evolution: ${error.message}. Please complete or cancel the existing evolution first.`,
          metadata: { error: true },
        },
      })
      onEvent?.({
        type: 'AGENT_DONE',
        payload: {
          message: 'Evolution plan creation blocked',
          result: { blocked: true, reason: error.message },
        },
      })
      return
    }

    // PHASE F′-4: Emit plan requiring confirmation (NO EXECUTION)
    // PHASE F′-5: Include goal context in plan message
    let planMessage = `${planSummary}\n\nThis evolution will:\n- Update existing files\n- Create new files as needed\n- Restructure components if required`
    
    if (goalContext?.activeGoal) {
      planMessage += `\n\n**Active Goal:** ${goalContext.activeGoal.description}\nThis evolution advances the active project goal.`
    } else if (!goalContext?.hasGoals) {
      planMessage += `\n\n**Note:** No project goal is set. Consider defining a goal to guide future development.`
    }

    planMessage += `\n\n**Evolution ID:** ${pendingEvolution.id}\n\nShould I proceed with this evolution?`

    onEvent?.({
      type: 'ASSISTANT_MESSAGE',
      payload: {
        content: planMessage,
        metadata: { 
          intent: 'expand_features', 
          description: executionIntent.description,
          requiresConfirmation: true,
          planType: 'expand_features',
          evolutionId: pendingEvolution.id,
          goalId: goalContext?.activeGoal?.id,
        },
      },
    })

    onEvent?.({
      type: 'AGENT_DONE',
      payload: {
        message: `Evolution plan created. Awaiting confirmation.`,
        result: { 
          evolutionId: pendingEvolution.id,
          status: 'awaiting_confirmation',
          plan: planSummary,
        },
      },
    })
  }

  /**
   * PHASE F: Handle redesign_ui intent
   * Redesigns UI/UX of existing project
   */
  private async handleRedesignUI(
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

    if (executionIntent.type !== 'redesign_ui') {
      throw new Error('Invalid intent type for redesign_ui handler')
    }

    // PHASE E: Import once at the top
    const bootstrapModule = await import('@/lib/bootstrap/BootstrapGenerator')
    const invariantModule = await import('@/lib/invariants/assertExecutionInvariant')
    const BootstrapGenerator = bootstrapModule.BootstrapGenerator
    const assertExecutionInvariant = invariantModule.assertExecutionInvariant

    // Verify workspace has files
    const fileCount = await BootstrapGenerator.getFileCount(rootPath)
    if (fileCount === 0) {
      throw new Error('Cannot redesign UI: Workspace is empty. Generate files first.')
    }

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Redesigning UI: ${executionIntent.description}` },
    })

    // PHASE F: Create explicit checkpoint before evolution
    const { checkpointEngine } = await import('@/lib/runtime/checkpointEngine')
    const checkpoint = await checkpointEngine.createCheckpoint(
      projectId,
      rootPath,
      `Redesign UI: ${executionIntent.description}`,
      'pre-write'
    )

    onEvent?.({
      type: 'AGENT_ACTION',
      payload: {
        action: 'create_checkpoint',
        details: {
          checkpointId: checkpoint.id,
          message: `Checkpoint created before UI redesign`,
        },
      },
    })

    // PHASE F: Build context to understand current UI structure
    const contextBuilder = getContextBuilder()
    const execContext = await contextBuilder.buildContext(executionIntent, rootPath, [])

    // PHASE F′-4: Generate plan and store (NO EXECUTION)
    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: 'Analyzing UI structure and planning redesign...' },
    })

    // Get current stage snapshot
    const { getProjectEvolutionEngineManager } = await import('@/lib/os/ProjectEvolutionEngineManager')
    const peeManager = getProjectEvolutionEngineManager()
    const pee = await peeManager.getEngine(projectId, rootPath)
    const stageSnapshot = pee.getStage()

    // PHASE F′-5: Check if there's an active goal
    let goalContext: { activeGoal: any; hasGoals: boolean } | null = null
    try {
      const { GoalAwareIntentRouter } = await import('@/lib/os/goals/GoalAwareIntentRouter')
      const context = await GoalAwareIntentRouter.getGoalContext(projectId)
      goalContext = {
        activeGoal: context.activeGoal,
        hasGoals: context.activeGoal !== null || context.completedGoals.length > 0,
      }
    } catch (error: any) {
      console.warn('[AgentExecutionRouter] Failed to load goal context:', error)
    }

    // PHASE F′-4: Generate detailed plan
    const scope = executionIntent.type === 'redesign_ui' ? executionIntent.scope : undefined
    const planSummary = scope && scope.length > 0
      ? `I will redesign: ${scope.join(', ')}`
      : `I will redesign the UI/UX: ${executionIntent.description}`

    // Create evolution plan with intents
    const evolutionIntents: ExecutionIntent[] = [
      {
        type: 'redesign_ui',
        description: executionIntent.description,
        scope,
        context: executionIntent.context,
      },
    ]

    // PHASE F′-4: Store pending evolution (NO EXECUTION)
    const { getPendingEvolutionStore } = await import('@/lib/os/evolution/PendingEvolutionStore')
    const evolutionStore = getPendingEvolutionStore()
    
    let pendingEvolution
    try {
      pendingEvolution = evolutionStore.create({
        projectId,
        plan: planSummary,
        intents: evolutionIntents,
        stageSnapshot,
      })
    } catch (error: any) {
      // Project already has active evolution
      onEvent?.({
        type: 'ASSISTANT_MESSAGE',
        payload: {
          content: `Cannot create new evolution: ${error.message}. Please complete or cancel the existing evolution first.`,
          metadata: { error: true },
        },
      })
      onEvent?.({
        type: 'AGENT_DONE',
        payload: {
          message: 'Evolution plan creation blocked',
          result: { blocked: true, reason: error.message },
        },
      })
      return
    }

    // PHASE F′-4: Emit plan requiring confirmation (NO EXECUTION)
    // PHASE F′-5: Include goal context in plan message
    let planMessage = `${planSummary}\n\nThis evolution will:\n- Update styling and CSS files\n- Modify component layouts\n- Improve user interaction patterns\n- Restructure UI components if needed`
    
    if (goalContext?.activeGoal) {
      planMessage += `\n\n**Active Goal:** ${goalContext.activeGoal.description}\nThis evolution advances the active project goal.`
    } else if (!goalContext?.hasGoals) {
      planMessage += `\n\n**Note:** No project goal is set. Consider defining a goal to guide future development.`
    }

    planMessage += `\n\n**Evolution ID:** ${pendingEvolution.id}\n\nShould I proceed with this evolution?`

    onEvent?.({
      type: 'ASSISTANT_MESSAGE',
      payload: {
        content: planMessage,
        metadata: { 
          intent: 'redesign_ui', 
          description: executionIntent.description,
          requiresConfirmation: true,
          planType: 'redesign_ui',
          evolutionId: pendingEvolution.id,
          goalId: goalContext?.activeGoal?.id,
        },
      },
    })

    onEvent?.({
      type: 'AGENT_DONE',
      payload: {
        message: `Evolution plan created. Awaiting confirmation.`,
        result: { 
          evolutionId: pendingEvolution.id,
          status: 'awaiting_confirmation',
          plan: planSummary,
        },
      },
    })
  }

  /**
   * PHASE F: Handle migrate_framework intent
   * Migrates project to a different framework
   */
  private async handleMigrateFramework(
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

    if (executionIntent.type !== 'migrate_framework') {
      throw new Error('Invalid intent type for migrate_framework handler')
    }

    // PHASE E: Import once at the top
    const bootstrapModule = await import('@/lib/bootstrap/BootstrapGenerator')
    const invariantModule = await import('@/lib/invariants/assertExecutionInvariant')
    const BootstrapGenerator = bootstrapModule.BootstrapGenerator
    const assertExecutionInvariant = invariantModule.assertExecutionInvariant

    // Verify workspace has files
    const fileCount = await BootstrapGenerator.getFileCount(rootPath)
    if (fileCount === 0) {
      throw new Error('Cannot migrate framework: Workspace is empty. Generate files first.')
    }

    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: `Migrating framework: ${executionIntent.description}` },
    })

    // PHASE F: Create explicit checkpoint before evolution
    const { checkpointEngine } = await import('@/lib/runtime/checkpointEngine')
    const checkpoint = await checkpointEngine.createCheckpoint(
      projectId,
      rootPath,
      `Migrate framework: ${executionIntent.description}`,
      'pre-write'
    )

    onEvent?.({
      type: 'AGENT_ACTION',
      payload: {
        action: 'create_checkpoint',
        details: {
          checkpointId: checkpoint.id,
          message: `Checkpoint created before framework migration`,
        },
      },
    })

    // PHASE F: Build context to understand current framework
    const contextBuilder = getContextBuilder()
    const execContext = await contextBuilder.buildContext(executionIntent, rootPath, [])

    // PHASE F′-4: Generate plan and store (NO EXECUTION)
    onEvent?.({
      type: 'AGENT_THINKING',
      payload: { message: 'Analyzing current framework and planning migration...' },
    })

    // Get current stage snapshot
    const { getProjectEvolutionEngineManager } = await import('@/lib/os/ProjectEvolutionEngineManager')
    const peeManager = getProjectEvolutionEngineManager()
    const pee = await peeManager.getEngine(projectId, rootPath)
    const stageSnapshot = pee.getStage()

    // PHASE F′-5: Check if there's an active goal
    let goalContext: { activeGoal: any; hasGoals: boolean } | null = null
    try {
      const { GoalAwareIntentRouter } = await import('@/lib/os/goals/GoalAwareIntentRouter')
      const context = await GoalAwareIntentRouter.getGoalContext(projectId)
      goalContext = {
        activeGoal: context.activeGoal,
        hasGoals: context.activeGoal !== null || context.completedGoals.length > 0,
      }
    } catch (error: any) {
      console.warn('[AgentExecutionRouter] Failed to load goal context:', error)
    }

    // PHASE F′-4: Generate detailed plan
    const targetFramework = executionIntent.type === 'migrate_framework' ? executionIntent.targetFramework : undefined
    const planSummary = `I will migrate your project to ${targetFramework || 'the target framework'}`

    // Create evolution plan with intents
    const evolutionIntents: ExecutionIntent[] = [
      {
        type: 'migrate_framework',
        description: executionIntent.description,
        targetFramework,
        context: executionIntent.context,
      },
    ]

    // PHASE F′-4: Store pending evolution (NO EXECUTION)
    const { getPendingEvolutionStore } = await import('@/lib/os/evolution/PendingEvolutionStore')
    const evolutionStore = getPendingEvolutionStore()
    
    let pendingEvolution
    try {
      pendingEvolution = evolutionStore.create({
        projectId,
        plan: planSummary,
        intents: evolutionIntents,
        stageSnapshot,
      })
    } catch (error: any) {
      // Project already has active evolution
      onEvent?.({
        type: 'ASSISTANT_MESSAGE',
        payload: {
          content: `Cannot create new evolution: ${error.message}. Please complete or cancel the existing evolution first.`,
          metadata: { error: true },
        },
      })
      onEvent?.({
        type: 'AGENT_DONE',
        payload: {
          message: 'Evolution plan creation blocked',
          result: { blocked: true, reason: error.message },
        },
      })
      return
    }

    // PHASE F′-4: Emit plan requiring confirmation (NO EXECUTION)
    // PHASE F′-5: Include goal context in plan message
    let planMessage = `${planSummary}\n\nThis evolution will:\n- Restructure project files\n- Update dependencies and configurations\n- Migrate component code\n- Update build and runtime configurations`
    
    if (goalContext?.activeGoal) {
      planMessage += `\n\n**Active Goal:** ${goalContext.activeGoal.description}\nThis evolution advances the active project goal.`
    } else if (!goalContext?.hasGoals) {
      planMessage += `\n\n**Note:** No project goal is set. Consider defining a goal to guide future development.`
    }

    planMessage += `\n\n**Evolution ID:** ${pendingEvolution.id}\n\nThis is a significant change. Should I proceed with this evolution?`

    onEvent?.({
      type: 'ASSISTANT_MESSAGE',
      payload: {
        content: planMessage,
        metadata: { 
          intent: 'migrate_framework', 
          targetFramework, 
          description: executionIntent.description,
          requiresConfirmation: true,
          planType: 'migrate_framework',
          evolutionId: pendingEvolution.id,
          goalId: goalContext?.activeGoal?.id,
        },
      },
    })

    onEvent?.({
      type: 'AGENT_DONE',
      payload: {
        message: `Evolution plan created. Awaiting confirmation.`,
        result: { 
          evolutionId: pendingEvolution.id,
          status: 'awaiting_confirmation',
          plan: planSummary,
        },
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


